// components/settings/ClubManagementCard.tsx
// Gestion du club pour les joueurs (rejoindre, voir, quitter)

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, Alert, ActivityIndicator } from "react-native";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db, auth } from "../../services/firebase";
import { theme } from "../../constants/theme";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  findClubByInviteCode,
  normalizeInviteCode,
  setClubMembership,
  removeClubMembership,
} from "../../repositories/clubsRepo";
import { showToast } from "../../utils/toast";

const palette = theme.colors;

export function ClubManagementCard() {
  const uid = auth.currentUser?.uid ?? null;

  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [inputCode, setInputCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Écouter le profil utilisateur pour le clubId
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    const ref = doc(db, "users", uid);
    return onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as any;
        const cid = typeof data?.clubId === "string" ? data.clubId.trim() : null;
        setClubId(cid || null);
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [uid]);

  // Récupérer les infos du club (une seule fois, pas de listener)
  useEffect(() => {
    if (!clubId) {
      setClubName(null);
      setInviteCode(null);
      return;
    }

    let cancelled = false;

    const fetchClub = async () => {
      try {
        const ref = doc(db, "clubs", clubId);
        const snap = await getDoc(ref);
        if (cancelled) return;

        if (snap.exists()) {
          const data = snap.data() as any;
          setClubName(typeof data?.name === "string" ? data.name : null);
          setInviteCode(typeof data?.inviteCode === "string" ? data.inviteCode : null);
        } else {
          setClubName(null);
          setInviteCode(null);
        }
      } catch {
        // Permissions error - on affiche quand même le clubId
        if (!cancelled) {
          setClubName(null);
          setInviteCode(null);
        }
      }
    };

    fetchClub();

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const handleJoinClub = async () => {
    if (!uid) return;

    const code = normalizeInviteCode(inputCode);
    if (!code || code.length < 4) {
      showToast({ type: "warn", title: "Code invalide", message: "Entre un code d'invitation valide." });
      return;
    }

    setJoining(true);
    try {
      const club = await findClubByInviteCode(code);
      if (!club) {
        showToast({ type: "warn", title: "Club introuvable", message: "Aucun club ne correspond à ce code." });
        setJoining(false);
        return;
      }

      // Ajouter le joueur au club
      await setClubMembership({ clubId: club.id, uid, role: "player" });

      // Mettre à jour le profil utilisateur
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, { clubId: club.id });

      showToast({ type: "success", title: "Bienvenue !", message: `Tu as rejoint le club "${club.name}".` });
      setInputCode("");
    } catch (e: any) {
      showToast({ type: "error", title: "Erreur", message: e?.message ?? "Impossible de rejoindre le club." });
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveClub = async () => {
    if (!uid || !clubId) return;

    Alert.alert(
      "Quitter le club ?",
      "Tu ne verras plus les recommandations de ton coach.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Quitter",
          style: "destructive",
          onPress: async () => {
            setLeaving(true);
            try {
              // Retirer le joueur du club
              await removeClubMembership({ clubId, uid });

              // Mettre à jour le profil utilisateur
              const userRef = doc(db, "users", uid);
              await updateDoc(userRef, { clubId: null });

              showToast({ type: "success", title: "C'est fait", message: "Tu as quitté le club." });
            } catch (e: any) {
              showToast({ type: "error", title: "Erreur", message: e?.message ?? "Impossible de quitter le club." });
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <Card variant="soft" style={styles.card}>
        <ActivityIndicator color={palette.accent} />
      </Card>
    );
  }

  // Si le joueur est dans un club
  if (clubId) {
    return (
      <Card variant="soft" style={styles.card}>
        <View style={styles.clubHeader}>
          <View style={styles.clubIconWrap}>
            <Ionicons name="people" size={20} color={palette.accent} />
          </View>
          <View style={styles.clubInfo}>
            <Text style={styles.clubName}>{clubName ?? "Club"}</Text>
            <Text style={styles.clubCode}>Code: {inviteCode ?? "—"}</Text>
          </View>
          <Badge label="Membre" tone="ok" />
        </View>
        <Text style={styles.clubDescription}>
          Ton coach peut suivre ta progression et t'envoyer des recommandations.
        </Text>
        <Button
          label={leaving ? "Départ..." : "Quitter le club"}
          variant="ghost"
          size="sm"
          onPress={handleLeaveClub}
          disabled={leaving}
        />
      </Card>
    );
  }

  // Si le joueur n'est pas dans un club
  return (
    <Card variant="soft" style={styles.card}>
      <View style={styles.noClubHeader}>
        <Ionicons name="people-outline" size={24} color={palette.sub} />
        <Text style={styles.noClubTitle}>Rejoindre un club</Text>
      </View>
      <Text style={styles.noClubDescription}>
        Entre le code d'invitation de ton coach pour rejoindre ton club et bénéficier d'un suivi personnalisé.
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          value={inputCode}
          onChangeText={setInputCode}
          placeholder="Ex: FKSF1234"
          placeholderTextColor={palette.sub}
          style={styles.input}
          autoCapitalize="characters"
          maxLength={10}
        />
        <Button
          label={joining ? "..." : "Rejoindre"}
          onPress={handleJoinClub}
          disabled={joining || !inputCode.trim()}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 12,
  },
  clubHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  clubIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.text,
  },
  clubCode: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 2,
  },
  clubDescription: {
    fontSize: 12,
    color: palette.sub,
    lineHeight: 16,
  },
  noClubHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noClubTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.text,
  },
  noClubDescription: {
    fontSize: 12,
    color: palette.sub,
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
    color: palette.text,
    backgroundColor: palette.card,
    letterSpacing: 1,
  },
});
