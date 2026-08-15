// screens/DeleteAccountScreen.tsx
// Suppression de compte (exigence Apple/Google) — étape de confirmation :
// conséquences listées, ré-authentification par mot de passe, puis appel de la
// Cloud Function `deleteAccount`. Style destructif SOBRE (palette.danger du
// design system, pas de rouge criard nouveau).

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";

import { Screen } from "../components/ui/Screen";
import { Card } from "../components/ui/Card";
import { resolveAppSpace, type AppSpace } from "../domain/appSpace";
import { resolveClubOwnerAuthority } from "../domain/clubRoles";
import { theme } from "../constants/theme";
import { auth, db } from "../services/firebase";
import {
  finalizeLocalAccountDeletion,
  reauthenticateWithPassword,
  requestServerAccountDeletion,
} from "../services/accountDeletion";
import { deletionErrorMessage } from "../services/accountDeletionHelpers";
import { showToast } from "../utils/toast";
import { useHaptics } from "../hooks/useHaptics";
import { trackEvent } from "../services/analytics";

const palette = theme.colors;

const PLAYER_CONSEQUENCES = [
  "Ton profil joueur (poste, niveau, objectif, matériel)",
  "Ton historique de séances et ta progression de cycle",
  "Tes tests terrain et ta charge d'entraînement",
  "Ton lien avec ton club (ta fiche disparaît côté coach)",
  "Ton compte de connexion (email)",
];

// Un compte coach n'a ni séances ni tests terrain : conséquences propres à
// l'espace coach (cf. functions/src/deleteAccount.ts — la purge n'efface QUE
// users/{uid} + son membership, jamais le club lui-même).
const COACH_CONSEQUENCES = [
  "Ton profil coach",
  "Ton accès à l'espace coach (cadre de la semaine, effectif, suivi des joueurs)",
  "Ton compte de connexion (email)",
];

export default function DeleteAccountScreen() {
  const nav = useNavigation<any>();
  const haptics = useHaptics();
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  // Garde anti-double-tap : la navigation démonte l'écran après succès, mais un
  // second tap pendant l'attente ne doit jamais relancer le flux.
  const runningRef = useRef(false);

  // Écran partagé joueur/coach (monté dans AppStack ET CoachStack) : on adapte
  // les conséquences affichées à l'espace RÉEL du compte.
  //
  // La source a changé (juillet 2026) : on lisait `users/{uid}.role`, un champ
  // que l'utilisateur écrit lui-même et que le transfert de propriété ne touche
  // jamais. Un joueur devenu propriétaire du club lisait donc les conséquences
  // « joueur » alors qu'il perdait un espace coach — et n'importe qui pouvait
  // s'afficher les conséquences coach en modifiant son propre document. On
  // dérive maintenant de l'appartenance (cf. domain/appSpace.ts), exactement
  // comme la navigation. Best-effort : en cas d'échec de lecture, conséquences
  // joueur (comportement historique inchangé).
  const [space, setSpace] = useState<AppSpace>("player");
  // Un coach qui a créé son club (ownerUid) et supprime son compte laisse le
  // club orphelin : la purge serveur ne touche jamais clubs/{clubId} (voir
  // functions/src/deleteAccount.ts). On le signale honnêtement à l'écran.
  const [isCoachOwner, setIsCoachOwner] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", uid));
        const data = userSnap.data() as { clubId?: unknown } | undefined;
        const clubId = typeof data?.clubId === "string" && data.clubId.trim() ? data.clubId.trim() : null;
        if (cancelled) return;
        if (!clubId) return;

        // L'appartenance : la seule source que le serveur contrôle, et celle
        // dont la navigation dérive déjà l'espace affiché.
        const memberSnap = await getDoc(doc(db, "clubs", clubId, "members", uid));
        if (cancelled) return;
        // LES DEUX AXES, lus ensemble. L'espace coach dépend des permissions
        // d'encadrement seules — le statut de joueur ne l'ouvre ni ne le ferme.
        const membre = memberSnap.exists()
          ? (memberSnap.data() as { accessRole?: unknown; playerStatus?: unknown })
          : null;
        const myAccessRole = membre?.accessRole ?? null;
        const resolvedSpace = resolveAppSpace({
          statut: "lu",
          accessRole: myAccessRole,
          playerStatus: membre?.playerStatus ?? null,
        });
        if (resolvedSpace !== "coach") return;
        setSpace("coach");

        // Propriétaire au sens du prédicat COMPLET (désignation ET appartenance) :
        // lui seul laisserait un club orphelin derrière lui. Un encadrant qui
        // porte le rôle sans la désignation — ou l'inverse — n'est pas
        // propriétaire, et on ne lui annonce pas une conséquence qui n'est pas
        // la sienne.
        const clubSnap = await getDoc(doc(db, "clubs", clubId));
        if (cancelled) return;
        const ownerUid = clubSnap.exists() ? (clubSnap.data() as { ownerUid?: unknown })?.ownerUid : null;
        setIsCoachOwner(resolveClubOwnerAuthority({ ownerUid, myAccessRole, uid }) === "authorized");
      } catch {
        // Best-effort : conséquences joueur par défaut déjà en place.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const consequences = space === "coach" ? COACH_CONSEQUENCES : PLAYER_CONSEQUENCES;
  const canSubmit = password.length > 0 && !busy;

  const performDeletion = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    Keyboard.dismiss();
    // Capturé AVANT la suppression : sert à purger les clés locales par uid.
    const uid = auth.currentUser?.uid ?? null;

    try {
      // 1. Ré-authentification (l'app n'a que email/mot de passe).
      await reauthenticateWithPassword(password);

      // 2. Purge serveur (Firestore + compte Auth) via la Cloud Function.
      await requestServerAccountDeletion();
    } catch (err) {
      haptics.error();
      const { title, message } = deletionErrorMessage(err);
      showToast({ type: "error", title, message });
      runningRef.current = false;
      setBusy(false);
      return;
    }

    // 3. Succès : purge locale + retour au flux d'accueil. Le signOut fait
    // basculer le RootNavigator sur l'auth stack — cet écran est démonté.
    trackEvent("account_deleted");
    haptics.success();
    await finalizeLocalAccountDeletion(uid);
    showToast({
      type: "success",
      title: "Compte supprimé",
      message: "Toutes tes données ont été effacées.",
    });
  };

  const confirmDeletion = () => {
    if (!canSubmit) return;
    // Pattern de confirmation destructive existant (cf. SettingsScreen).
    Alert.alert(
      "Supprimer ton compte ?",
      "Cette action est définitive. Toutes tes données d'entraînement seront effacées.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer définitivement",
          style: "destructive",
          onPress: () => void performDeletion(),
        },
      ]
    );
  };

  return (
    <Screen
      scroll
      keyboardAvoiding
      // Wrapper TouchableWithoutFeedback supprimé (P1-16, motif b708fe9) : le
      // clavier se ferme par glissement, via le ScrollView interne de <Screen>.
      scrollProps={{ keyboardDismissMode: "on-drag", keyboardShouldPersistTaps: "handled" }}
    >
        <View style={styles.container}>
          <Text style={styles.title}>Tu es sur le point de supprimer ton compte</Text>
          <Text style={styles.subtitle}>
            Cette action est définitive et immédiate. Aucune récupération possible.
          </Text>

          <Card variant="soft" style={styles.card}>
            <Text style={styles.cardTitle}>Ce qui sera effacé définitivement</Text>
            {consequences.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <Ionicons name="close-circle-outline" size={16} color={palette.danger} style={styles.bulletIcon} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </Card>

          {isCoachOwner ? (
            <Card variant="soft" style={[styles.card, styles.warnCard]}>
              <View style={styles.bulletRow}>
                <Ionicons name="warning-outline" size={18} color={palette.warn} style={styles.bulletIcon} />
                <Text style={styles.warnText}>
                  <Text style={styles.warnTextBold}>Tu es le gestionnaire de ce club. </Text>
                  Ton club restera actif mais sans gestionnaire : les joueurs resteront inscrits, mais
                  plus personne ne pourra régler le cadre de la semaine ni consulter leur suivi. Pour
                  transférer la gestion avant de partir, écris-nous à kyllian@fks-app.com.
                </Text>
              </View>
            </Card>
          ) : null}

          <Card variant="soft" style={styles.card}>
            <Text style={styles.cardTitle}>Confirme avec ton mot de passe</Text>
            <Text style={styles.cardHint}>
              Par sécurité, on vérifie que c'est bien toi ({auth.currentUser?.email ?? "compte FKS"}).
            </Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={palette.muted} style={styles.inputIcon} />
              <TextInput
                placeholder="Mot de passe"
                placeholderTextColor={palette.muted}
                secureTextEntry={!showPwd}
                autoComplete="current-password"
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                editable={!busy}
                returnKeyType="done"
                style={styles.input}
              />
              <Pressable onPress={() => setShowPwd((v) => !v)} style={styles.eye}>
                <Ionicons
                  name={showPwd ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={palette.muted}
                />
              </Pressable>
            </View>
          </Card>

          <Pressable
            onPress={confirmDeletion}
            disabled={!canSubmit}
            accessibilityLabel="Supprimer définitivement mon compte"
            style={({ pressed }) => [
              styles.deleteCta,
              pressed && styles.deleteCtaPressed,
              !canSubmit && styles.deleteCtaDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={palette.danger} />
            ) : (
              <Text style={styles.deleteCtaText}>Supprimer définitivement mon compte</Text>
            )}
          </Pressable>

          <Pressable onPress={() => nav.goBack()} disabled={busy} style={styles.cancel}>
            <Text style={styles.cancelText}>Annuler et garder mon compte</Text>
          </Pressable>
        </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 16 },
  title: { color: palette.text, fontSize: 20, fontWeight: "800", marginTop: 8 },
  subtitle: { color: palette.sub, fontSize: 13, minHeight: 18 },

  card: { padding: 14, gap: 10 },
  cardTitle: { color: palette.text, fontSize: 14, fontWeight: "700" },
  cardHint: { color: palette.sub, fontSize: 12, minHeight: 16 },

  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletIcon: { marginTop: 1 },
  bulletText: { color: palette.sub, fontSize: 13, flex: 1 },

  warnCard: { borderColor: palette.warn },
  warnText: { color: palette.text, fontSize: 13, lineHeight: 18, flex: 1 },
  warnTextBold: { fontWeight: "700" },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: palette.text, fontSize: 15 },
  eye: { padding: 4 },

  deleteCta: {
    minHeight: 52,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "transparent",
  },
  deleteCtaPressed: { opacity: 0.7 },
  deleteCtaDisabled: { opacity: 0.5 },
  deleteCtaText: { color: palette.danger, fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },

  cancel: { alignItems: "center", paddingVertical: 12 },
  cancelText: { color: palette.sub, fontSize: 13, fontWeight: "600" },
});
