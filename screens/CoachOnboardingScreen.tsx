// screens/CoachOnboardingScreen.tsx
// Création d'un club par un coach/staff.
// Le coach pilote le contexte du club ; il ne génère pas les séances (c'est FKS le prépa).

import React, { useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Keyboard, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getAuth, signOut } from "firebase/auth";

import { ScreenContainer } from "../components/ui/ScreenContainer";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { coachColors, coachRadius } from "../components/coach/coachUi";
import { createClubAsCoach, nouvelIdentifiantClub } from "../repositories/clubsRepo";
import {
  enregistrerEtapeClub,
  estRefusPermission,
  libererIdClub,
  remplacerReservationClub,
  reserverIdClub,
} from "../services/reservationClub";
import { showToast } from "../utils/toast";
import { useHaptics } from "../hooks/useHaptics";
import { withTimeout, TimeoutError } from "../utils/errorHandler";

const palette = coachColors;

// Plafond d'agrandissement du titre (cf. MonCorpsScreen). Cap global : 1,3
// (config/textScaling).
const PLAFOND_TITRE = 1.2;

type CoachOnboardingScreenProps = {
  /**
   * SORTIE DE SECOURS QUAND CET ÉCRAN EST LE POINT D'ARRIVÉE.
   *
   * Fournie par le gate d'onboarding lorsque l'intention coach a été déclarée sur
   * l'écran d'accueil : la création de club est alors la PREMIÈRE route de la
   * pile, donc `goBack()` ne mène nulle part et « Retour » serait un bouton qui
   * ment. Le geste devient « Je suis joueur finalement », et c'est le navigateur
   * qui décide où il repose la personne (questionnaire joueur).
   *
   * Absente quand l'écran est ouvert depuis le profil : il y a un écran derrière,
   * « Retour » suffit et reste le comportement d'origine.
   */
  onRetourJoueur?: () => void;
};

export default function CoachOnboardingScreen({ onRetourJoueur }: CoachOnboardingScreenProps = {}) {
  const navigation = useNavigation<any>();
  const haptics = useHaptics();

  const [clubName, setClubName] = useState("");
  const [coachName, setCoachName] = useState("");
  const [loading, setLoading] = useState(false);
  // Verrou d'intention : posé AVANT l'alerte de confirmation, il ferme le
  // double-tap que `loading` (posé après) laissait passer — deux appuis rapides
  // ouvraient deux alertes, donc deux clubs (erratum 3 de l'audit).
  //
  // DEUX PIÈCES, ET LES DEUX SONT NÉCESSAIRES. La ref est SYNCHRONE : deux taps
  // dans la même frame partagent la closure du même rendu, et un `useState`
  // seul les laisserait tous les deux passer (React n'a pas encore re-rendu).
  // L'état, lui, sert à l'UI — il grise le bouton. Même idiome que le verrou de
  // génération (screens/newSession/echecGeneration).
  const verrouCreationRef = useRef(false);
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);

  /** Rend la main : le geste est terminé (annulé, échoué, ou abouti). */
  const relacherVerrou = () => {
    verrouCreationRef.current = false;
    setConfirmationOuverte(false);
  };

  const canSubmit = clubName.trim().length >= 2 && !loading && !confirmationOuverte;

  // Un seul geste de sortie affiché, celui qui est VRAI ici : revenir en arrière
  // s'il y a un arrière, renoncer à l'espace coach sinon.
  const peutRevenir = navigation.canGoBack?.() ?? false;
  const sortie = peutRevenir
    ? { label: "Retour", icon: "chevron-back" as const, onPress: () => navigation.goBack() }
    : onRetourJoueur
      ? { label: "Je suis joueur finalement", icon: "person-outline" as const, onPress: onRetourJoueur }
      : null;

  const handleSortie = () => {
    haptics.impactLight();
    sortie?.onPress();
  };

  const handleLogout = async () => {
    haptics.impactLight();
    try {
      await signOut(getAuth());
      // Le listener auth du RootNavigator renvoie vers la connexion.
    } catch (e) {
      if (__DEV__) console.warn("[CoachOnboarding] signOut failed", e);
      showToast({ type: "error", title: "Erreur", message: "Déconnexion impossible. Réessaie." });
    }
  };

  // Confirmation OBLIGATOIRE avant la création (décision Kyllian 15/08,
  // P1-07 inventaire clubs) : créer un club bascule TOUT le compte en espace
  // coach, sans retour possible sans le support. Deux boutons explicites,
  // aucun « oui » par défaut — le choix mis en avant est « Annuler ».
  const handleCreate = () => {
    if (!canSubmit) return;
    Keyboard.dismiss();

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      haptics.error();
      showToast({ type: "error", title: "Connexion requise", message: "Reconnecte-toi pour créer ton club." });
      return;
    }

    // VERROU POSÉ AVANT L'ALERTE, PAS APRÈS (erratum 3 de l'audit
    // d'inscription : `loading` n'était posé que dans `doCreate`, une fois
    // l'alerte confirmée). Deux appuis rapides ouvraient DEUX alertes, donc
    // deux créations — et deux clubs. Le verrou est distinct de `loading` :
    // celui-ci pilote l'overlay « Création de ton club… », qu'on n'affiche pas
    // pendant qu'une alerte attend une réponse.
    if (verrouCreationRef.current) return;
    verrouCreationRef.current = true;
    setConfirmationOuverte(true);
    Alert.alert(
      "Créer un espace entraîneur ?",
      "Tu crées un espace ENTRAÎNEUR pour gérer des joueurs. Cette action est définitive sur ce compte.",
      [
        { text: "Annuler", style: "cancel", onPress: relacherVerrou },
        { text: "Créer mon espace entraîneur", onPress: () => void doCreate(user.uid) },
      ],
      // `onDismiss` : sur Android, un tap hors de l'alerte la ferme sans
      // déclencher « Annuler » — sans ça le bouton restait verrouillé à vie.
      { cancelable: true, onDismiss: relacherVerrou }
    );
  };

  /**
   * LA CRÉATION, ET POURQUOI ELLE EST IDEMPOTENTE.
   *
   * Trois écritures séquentielles (club, appartenance propriétaire, pointeur
   * `users/{uid}.clubId`) que les règles Firestore INTERDISENT de grouper : dans
   * un `writeBatch`, chaque opération est évaluée contre l'état antérieur au
   * batch, l'appartenance créée dans le même batch reste invisible de
   * `userClubIdIsLegitimate()` (firestore.rules:429-434), la troisième écriture
   * est refusée et le batch étant tout-ou-rien PLUS AUCUN coach ne pourrait
   * créer de club (erratum 2 de l'audit d'inscription 2026-09).
   *
   * Faute d'atomicité possible côté client, on réserve l'identifiant AVANT la
   * première écriture et on le réutilise à chaque réessai : le réessai réécrit
   * le même club au lieu d'en fabriquer un second (P1-03 — une 4G capricieuse
   * laissait un club orphelin par appui). Libéré au succès.
   *
   * ET LA RÉSERVATION PORTE LA PROGRESSION, pas seulement l'identifiant. Sans
   * elle, le réessai rejouait la 1ʳᵉ écriture sur un club DÉJÀ écrit : ce n'est
   * plus une création mais une UPDATE, que les règles refusent tant que
   * l'appartenance propriétaire n'existe pas (firestore.rules:783 →
   * `myAccessRole() == "owner"`). Dans l'entrelacement que produit exactement un
   * timeout — écriture 1 passée, écriture 2 pas passée —, chaque réessai était
   * donc refusé, la réservation jamais libérée, et le coach BLOQUÉ À VIE sur son
   * compte (R2 de la contre-vérification du 05/09). On reprend à l'étape
   * suivante ; et si une écriture est refusée quand même, on jette la
   * réservation et on repart sur un identifiant neuf plutôt que d'insister.
   *
   * Délai de garde 15 s (P1-27) : hors réseau, l'écriture pend sans fin et
   * l'overlay gelait à jamais. Au timeout, on ne SAIT pas si l'écriture est
   * arrivée : le message le dit, et le RootNavigator relit `users/{uid}.clubId`
   * au démarrage suivant — s'il est là, l'espace coach s'ouvre sans rien
   * redemander.
   */
  const doCreate = async (uid: string) => {
    try {
      setLoading(true);
      const reservation = await reserverIdClub(uid, nouvelIdentifiantClub);
      await withTimeout(createClubAsCoach({
        name: clubName.trim(),
        uid,
        coachName: coachName.trim() || null,
        clubId: reservation.clubId,
        etapeDejaFaite: reservation.etape,
        // Notée sur le disque au fur et à mesure : une app tuée entre deux
        // écritures doit savoir où reprendre, pas repartir de zéro.
        onEtapeFaite: (etape) => enregistrerEtapeClub(uid, reservation.clubId, etape),
      }), 15000);
      await libererIdClub(uid);
      haptics.success();
      // Plus de code annoncé ici : il n'est plus créé avec le club. Le coach le
      // génère quand il en a besoin (onglet Semaine), et il ne s'affiche qu'à
      // ce moment-là — le dire tout de suite évite de le chercher.
      showToast({
        type: "success",
        title: "Club créé !",
        message: "Génère ton code d'invitation depuis l'onglet Semaine.",
      });
      // Le RootNavigator bascule tout seul : il lit `users/{uid}.clubId`, s'abonne
      // à l'appartenance `clubs/{clubId}/members/{uid}` (écrite juste avant avec
      // le rôle propriétaire) et en dérive l'espace coach. Rien d'autre à faire ici.
    } catch (error) {
      if (error instanceof TimeoutError) {
        haptics.warning();
        // MESSAGE HONNÊTE : au timeout, on ne SAIT pas si l'écriture est
        // arrivée — elle a très bien pu atterrir après notre garde de 15 s.
        // Dire « impossible de créer » serait une affirmation qu'on ne peut pas
        // tenir. La réservation est CONSERVÉE : le réessai réécrira le même
        // club, et au prochain démarrage le navigateur relit
        // `users/{uid}.clubId` — s'il est là, il ouvre l'espace coach sans rien
        // redemander.
        showToast({
          type: "warn",
          title: "La création a peut-être abouti, on vérifie",
          message: "Ta saisie est conservée. Réessaie dans un instant : on reprendra là où ça s'est arrêté.",
        });
        return;
      }
      if (estRefusPermission(error)) {
        // REFUS INATTENDU : notre idée de la progression ne correspond plus à
        // l'état réel du serveur (document déjà écrit d'une façon qu'on n'a pas
        // notée, appartenance disparue, autre appareil passé par là…).
        // S'entêter sur le même identifiant ne peut que refaire refuser — c'est
        // précisément ce qui enfermait le coach. On jette et on repart neuf.
        if (__DEV__) console.warn("[CoachOnboarding] écriture refusée, réservation remplacée");
        await remplacerReservationClub(uid, nouvelIdentifiantClub);
        haptics.warning();
        showToast({
          type: "warn",
          title: "On recommence proprement.",
          message: "Ta saisie est conservée. Appuie à nouveau sur « Créer mon club ».",
        });
        return;
      }
      if (__DEV__) console.error("[CoachOnboarding] create club failed:", error);
      haptics.error();
      showToast({ type: "error", title: "Erreur", message: "Impossible de créer le club. Réessaie." });
    } finally {
      setLoading(false);
      relacherVerrou();
    }
  };

  return (
    // AUDIT TACTILE (recette 03/08, même défaut que b708fe9 sur Register/Login) :
    // un TouchableWithoutFeedback enveloppait TOUT ce sous-arbre pour fermer le
    // clavier. Il pose un responder sur l'ensemble des descendants — les deux
    // champs de saisie et les trois boutons de cet écran compris — et avale les
    // taps au lieu de les laisser passer. Il est supprimé ; le clavier se ferme
    // par glissement (`keyboardDismissMode: "on-drag"`), et `handleCreate` fait
    // toujours son `Keyboard.dismiss()` explicite à la validation.
    <ScreenContainer
      keyboardAvoiding
      safeAreaStyle={styles.screenBg}
      contentContainerStyle={styles.screenBg}
      scrollProps={{ keyboardDismissMode: "on-drag" }}
    >
      <View style={styles.wrap}>
        <View style={styles.headerRow}>
          {sortie ? (
            <TouchableOpacity
              style={styles.backRow}
              onPress={handleSortie}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={sortie.label}
            >
              <Ionicons name={sortie.icon} size={20} color={palette.sub} />
              <Text style={styles.backText}>{sortie.label}</Text>
            </TouchableOpacity>
          ) : (
            // Aucun geste de sortie honnête ici : on garde la place pour que
            // « Se déconnecter » reste à droite, sans afficher de faux bouton.
            <View />
          )}
          <TouchableOpacity
            style={styles.backRow}
            onPress={handleLogout}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Se déconnecter"
          >
            <Ionicons name="log-out-outline" size={18} color={palette.sub} />
            <Text style={styles.backText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={26} color={palette.accent} />
          </View>
          <Text style={styles.title} maxFontSizeMultiplier={PLAFOND_TITRE}>Espace coach</Text>
          <Text style={styles.subtitle}>
            Crée ton club, partage le code à tes joueurs, suis leur préparation. FKS construit la prépa, toi tu donnes
            le terrain.
          </Text>
        </View>

        <Card variant="soft" style={styles.card}>
          <Text style={styles.label}>Nom du club</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: FC Exemple U17"
            placeholderTextColor={palette.muted}
            value={clubName}
            onChangeText={setClubName}
            autoCapitalize="words"
            maxLength={60}
          />

          <Text style={styles.label}>Ton nom (optionnel)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Coach Marvin"
            placeholderTextColor={palette.muted}
            value={coachName}
            onChangeText={setCoachName}
            autoCapitalize="words"
            maxLength={40}
          />

          <Button
            label={loading ? "Création..." : "Créer mon club"}
            onPress={handleCreate}
            disabled={!canSubmit}
            fullWidth
            style={styles.primaryBtn}
          />
        </Card>

        <Text style={styles.note}>
          Tu généreras ensuite un code d'invitation, valable 14 jours. Tes joueurs le saisissent à
          l'inscription pour rejoindre le club.
        </Text>
      </View>

      <LoadingOverlay visible={loading} message="Création de ton club..." />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenBg: {
    backgroundColor: palette.bg,
  },
  wrap: {
    flex: 1,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  backText: {
    color: palette.sub,
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    gap: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: palette.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.sub,
  },
  card: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: coachRadius.card,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
    marginTop: 10,
    letterSpacing: 0.1,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: coachRadius.chip,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.card,
  },
  primaryBtn: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
    shadowColor: palette.accent,
    borderRadius: 10,
    marginTop: 8,
  },
  note: {
    fontSize: 12.5,
    lineHeight: 17,
    color: palette.muted,
  },
});
