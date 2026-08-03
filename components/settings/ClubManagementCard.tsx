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
import { removeClubMembership } from "../../repositories/clubsRepo";
import { clubMembershipCopy } from "../../domain/clubRoles";
import { joinClubWithInviteCode } from "../../services/clubInvites";
import { showToast } from "../../utils/toast";
import { ClubDataDisclosure } from "../club/ClubDataDisclosure";

const palette = theme.colors;

/**
 * Les DEUX axes de l'appartenance, lus dans le MÊME instantané : permissions
 * d'encadrement (`accessRole`) et statut de joueur (`playerStatus`). Les lire
 * séparément laisserait afficher un état mi-ancien mi-nouveau — et c'est
 * précisément la combinaison des deux qui décrit un entraîneur-joueur.
 */
function lireAppartenance(snap: { exists: () => boolean; data: () => unknown }): {
  accessRole: unknown;
  playerStatus: unknown;
} {
  if (!snap.exists()) return { accessRole: null, playerStatus: null };
  const data = (snap.data() ?? {}) as { accessRole?: unknown; playerStatus?: unknown };
  return { accessRole: data.accessRole ?? null, playerStatus: data.playerStatus ?? null };
}

export function ClubManagementCard() {
  const uid = auth.currentUser?.uid ?? null;

  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  // Son PROPRE rôle dans le club. Lu pour DIRE la vérité, jamais pour accorder
  // un droit : l'autorité se décide côté serveur et côté règles, jamais ici.
  const [monAppartenance, setMonAppartenance] = useState<{ accessRole: unknown; playerStatus: unknown }>({
    accessRole: null,
    playerStatus: null,
  });
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

  // Récupérer les infos du club (une seule fois, pas de listener).
  // Le code d'invitation n'est PLUS lisible ici : il n'existe plus dans le
  // document club (seule son empreinte vit côté serveur). Un joueur n'a donc
  // plus aucun moyen de rediffuser le code de son club — c'était une porte
  // ouverte, ce n'est plus une fonctionnalité.
  //
  // Le RÔLE est lu dans le même mouvement (document toujours lisible par son
  // propriétaire : `allow read: isOwner(memberId)`). Il ne change rien à ce qui
  // est permis — il change ce qui est DIT, et il retire un bouton qui ne pourrait
  // pas marcher pour un propriétaire (cf. domain/clubRoles.clubMembershipCopy).
  useEffect(() => {
    if (!clubId || !uid) {
      setClubName(null);
      setMonAppartenance({ accessRole: null, playerStatus: null });
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
        } else {
          setClubName(null);
        }
      } catch {
        // Permissions error - on affiche quand même le clubId
        if (!cancelled) setClubName(null);
      }

      try {
        const memberSnap = await getDoc(doc(db, "clubs", clubId, "members", uid));
        if (cancelled) return;
        setMonAppartenance(lireAppartenance(memberSnap));
      } catch {
        // Lecture ratée : on ne DÉDUIT rien. Sans rôle lu, la carte reste sur son
        // affichage neutre de membre — accuser la base sur un incident réseau
        // serait un mensonge de plus.
        if (!cancelled) setMonAppartenance({ accessRole: null, playerStatus: null });
      }
    };

    fetchClub();

    return () => {
      cancelled = true;
    };
  }, [clubId, uid]);

  // Le front ne juge PLUS un code : il le transmet et affiche la réponse du
  // serveur. Plus de contrôle de longueur (qui refusait localement des codes
  // parfaitement valides), plus de "Club introuvable" décidé ici, et surtout
  // plus de `e?.message` brut — un joueur français ne doit jamais lire
  // "Missing or insufficient permissions".
  const handleJoinClub = async () => {
    if (!uid) return;
    if (!inputCode.trim()) return;

    setJoining(true);
    const outcome = await joinClubWithInviteCode(inputCode);
    setJoining(false);

    if (!outcome.ok) {
      showToast({ type: "warn", title: "Club non rejoint", message: outcome.message });
      return;
    }

    // Le clubId du profil est écrit par le serveur ; le listener onSnapshot
    // ci-dessus le reflète. On ne le réécrit pas ici : ce serait une seconde
    // source de vérité, et elle pourrait mentir.
    showToast({
      type: "success",
      title: "Bienvenue !",
      message: outcome.clubName
        ? `Tu as rejoint le club "${outcome.clubName}".`
        : "Tu as rejoint ton club.",
    });
    setInputCode("");
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
            } catch {
              // Message FR maîtrisé : le message brut de Firebase est en anglais.
              showToast({ type: "error", title: "Erreur", message: "Impossible de quitter le club. Réessaie." });
              // Le rôle a pu changer pendant que l'écran était ouvert (un
              // transfert de propriété, par exemple) : on le relit, pour que la
              // carte cesse de proposer un geste devenu impossible.
              try {
                const memberSnap = await getDoc(doc(db, "clubs", clubId, "members", uid));
                setMonAppartenance(lireAppartenance(memberSnap));
              } catch {
                // Rien à conclure d'un second échec : on laisse l'affichage tel quel.
              }
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
    const appartenance = clubMembershipCopy(monAppartenance);
    return (
      <Card variant="soft" style={styles.card}>
        <View style={styles.clubHeader}>
          <View style={styles.clubIconWrap}>
            <Ionicons name="people" size={20} color={palette.accent} />
          </View>
          <View style={styles.clubInfo}>
            <Text style={styles.clubName}>{clubName ?? "Club"}</Text>
            <Text style={styles.clubCode}>{appartenance.statut}</Text>
          </View>
          <Badge label={appartenance.badge} tone="ok" />
        </View>
        <Text style={styles.clubDescription}>
          Ton coach peut suivre ta progression et régler le cadre de vos séances (intensité, objectif
          de la semaine).
        </Text>
        {/* Le joueur DÉJÀ dans un club doit pouvoir relire ce que son
            encadrement voit — pas seulement au moment où il tape son code. */}
        <ClubDataDisclosure />
        {appartenance.peutQuitter ? (
          <Button
            label={leaving ? "Départ..." : "Quitter le club"}
            variant="ghost"
            size="sm"
            onPress={handleLeaveClub}
            disabled={leaving}
          />
        ) : (
          // Pas de bouton grisé, pas de bouton qui échoue : la raison, et le
          // geste. Un refus prononcé par la base ne doit pas arriver au joueur
          // sous la forme d'un « Réessaie » qui ne marchera jamais.
          <Text style={styles.empechement}>{appartenance.empechement}</Text>
        )}
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
      {/* Divulgation AVANT la saisie : le joueur sait ce qu'il partage avant de
          taper son code. Elle n'exige rien et ne désactive pas le bouton. */}
      <ClubDataDisclosure />
      <View style={styles.inputRow}>
        <TextInput
          value={inputCode}
          onChangeText={setInputCode}
          placeholder="Ex: ABCDE-FGHJK"
          placeholderTextColor={palette.sub}
          style={styles.input}
          autoCapitalize="characters"
          autoCorrect={false}
          // Pas de maxLength serré : le format du code appartient au serveur.
          // L'ancien plafond de 10 caractères aurait tronqué le code actuel.
          maxLength={24}
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
  // `minHeight` et jamais `height` (règle d'or du socle visuel) : ce texte est
  // long, et il ne doit pas être coupé au milieu d'une explication.
  empechement: {
    fontSize: 12,
    color: palette.sub,
    lineHeight: 17,
    minHeight: 17,
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
