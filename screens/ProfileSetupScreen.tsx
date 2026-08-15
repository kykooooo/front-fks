// screens/ProfileSetupScreen.tsx
// Setup profil multi-étapes — même DA que le reste de l'app

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  BackHandler,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Screen } from "../components/ui/Screen";
import { Button } from "../components/ui/Button";
import { BrandMark } from "../components/ui/BrandMark";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getAuth, signOut } from "firebase/auth";
import { useHaptics } from "../hooks/useHaptics";
import { auth as firebaseAuth, db } from "../services/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import {
  joinClubWithInviteCode,
  normalizeInviteCodeInput,
} from "../services/clubInvites";
import { saveProfileThenAttachClub } from "./profileSetup/attachClub";
import { ClubDataDisclosure } from "../components/club/ClubDataDisclosure";
import { MICROCYCLES, MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../domain/microcycles";
// Catégories proposées au sélecteur : U13 retirée (décision produit 2026-07, cf.
// domain/types.ts). Un profil déjà en 'U13' n'apparaît sélectionné dans aucun
// chip ci-dessous → l'étape 0 le bloque tant qu'il n'a pas repick une catégorie.
import { SELECTABLE_AGE_CATEGORIES } from "../domain/types";
// Consentement parental RGPD (< 15 ans). Sa liste interne garde "U13" en
// défense en profondeur (profil legacy U13 qui repick) : code mort inoffensif
// tant que U13 n'est pas sélectionnable, voulu — cf. domain/parentalConsent.ts.
import {
  requiresParentalConsent,
  isParentalConsentBlocking,
  consentCheckedAfterCategoryChange,
  isStoredParentalConsent,
  buildParentalConsent,
  type ParentalConsent,
} from "../domain/parentalConsent";
import { PRIVACY_POLICY } from "../utils/legalContent";
import { recommendMicrocycle } from "../domain/recommendMicrocycle";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { showToast } from "../utils/toast";
import { withTimeout, TimeoutError } from "../utils/errorHandler";
import { runShake } from "../utils/animations";
import { theme } from "../constants/theme";
import { trackEvent } from "../services/analytics";

// 5 → 4 étapes (mai 2026) : le matériel (29 cases, ≥1 obligatoire) sort du
// setup — cf. docs/onboarding-design.md §4.6/§4.3 (design validé par le
// fondateur). Le lieu + le matériel se choisissent à la première génération
// (NewSessionScreen), là où l'app a déjà les bons défauts. L'accès salle
// reste demandé ici : il nourrit le contexte IA + la reco de lieu.
const TOTAL_STEPS = 4;
const palette = theme.colors;

// Poids approximatifs de densité par étape, en nombre de zones interactives
// (DA Polish, direction A) : la barre "Étape n/4" linéaire annonçait 25% à
// l'étape 1 alors qu'elle concentre ~60% des champs du parcours (audit DA
// 2026-07, §4.12 — Identité: ~15 zones vs Salle: ~3). La barre reflète
// maintenant l'effort réel, sans déplacer aucun champ entre étapes.
const STEP_DENSITY_WEIGHTS = [15, 8, 5, 3] as const;
const STEP_DENSITY_TOTAL = STEP_DENSITY_WEIGHTS.reduce((sum, w) => sum + w, 0);

/* ─── Steps config ─── */
const STEPS: { label: string; icon: keyof typeof Ionicons.glyphMap; subtitle: string }[] = [
  { label: "Identité", icon: "person-outline", subtitle: "Dis-nous qui tu es" },
  { label: "Objectif", icon: "flag-outline", subtitle: "Quel est ton but ?" },
  { label: "Club", icon: "people-outline", subtitle: "Tes entraînements & matchs" },
  { label: "Salle", icon: "barbell-outline", subtitle: "Ton accès salle" },
];

/* ─── Constants ─── */
const positions = ["Gardien", "Defenseur", "Milieu", "Attaquant"] as const;
const levels = ["Amateur", "Regional", "National", "Semi-pro", "Pro"] as const;
const dominantFeet = ["Pied droit", "Pied gauche", "Ambidextre"] as const;
const objectives = [
  "Etre en forme toute la saison",
  "Gagner en vitesse / explosivite",
  "Mieux encaisser les entraînements et les matchs",
  "Reprendre apres une blessure",
] as const;
const fksSessionsOptions = ["1", "2", "3", "4"] as const;

// Question optionnelle "reprise" (boucle de suivi joueur, Lot 6) : jours estimes
// depuis le dernier entrainement regulier, en jours ESTIMES pour rester simple
// (l'utilisateur ne connait pas son gap au jour pres) -- lu ensuite par
// detectTrainingGap (domain/tracking/resumption.ts) comme filet quand aucun
// historique de seance FKS n'est encore connu (nouvel utilisateur). Skippable :
// valeur null en base tant que non repondu, jamais de valeur inventee.
const SELF_REPORTED_GAP_OPTIONS = [
  { id: "lt2w", label: "Moins de 2 semaines", days: 0 },
  { id: "2to4w", label: "2 à 4 semaines", days: 21 },
  { id: "1to3m", label: "1 à 3 mois", days: 60 },
  { id: "gt3m", label: "Plus de 3 mois", days: 120 },
] as const;
type SelfReportedGapOptionId = (typeof SELF_REPORTED_GAP_OPTIONS)[number]["id"];

// ⚠️ Les valeurs de `positions`, `levels` et `objectives` sont PERSISTÉES en Firestore
// et comparées à des allowlists SANS accents côté Cloud Functions (functions/src/coachLabels.ts)
// + matching substring dans recommendMicrocycle. On ne les modifie donc JAMAIS :
// ces maps servent uniquement à afficher un libellé accentué dans l'UI.
const POSITION_DISPLAY_LABELS: Partial<Record<(typeof positions)[number], string>> = {
  Defenseur: "Défenseur",
};
const LEVEL_DISPLAY_LABELS: Partial<Record<(typeof levels)[number], string>> = {
  Regional: "Régional",
};
const OBJECTIVE_DISPLAY_LABELS: Partial<Record<(typeof objectives)[number], string>> = {
  "Etre en forme toute la saison": "Être en forme toute la saison",
  "Gagner en vitesse / explosivite": "Gagner en vitesse / explosivité",
  "Reprendre apres une blessure": "Reprendre après une blessure",
};

const daysOfWeek = [
  { id: "mon", label: "Lun" }, { id: "tue", label: "Mar" }, { id: "wed", label: "Mer" },
  { id: "thu", label: "Jeu" }, { id: "fri", label: "Ven" }, { id: "sat", label: "Sam" },
  { id: "sun", label: "Dim" },
];

const toggleInList = (value: string, list: string[], setter: (next: string[]) => void) => {
  setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
};

/* ══════════════════════════════════════════ */
type ProfileSetupScreenProps = {
  /** Fourni par RootNavigator pendant l'onboarding : bascule immédiate vers l'app
   *  après enregistrement réussi (le listener Firestore reste la source durable).
   *  Absent quand l'écran est ouvert en édition depuis l'app déjà complète. */
  onProfileCompleted?: () => void;
};

export default function ProfileSetupScreen({ onProfileCompleted }: ProfileSetupScreenProps = {}) {
  const navigation = useNavigation<any>();
  const haptics = useHaptics();
  // Mode édition : écran ouvert depuis Profil/Réglages (header natif "Profil" déjà présent).
  const isEditMode = !onProfileCompleted;
  const activeCycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const setMicrocycleGoal = useSessionsStore((s) => s.setMicrocycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);
  const scrollRef = useRef<ScrollView>(null);

  /* ─── Step state ─── */
  const [step, setStep] = useState(0);

  /* ─── Form state ─── */
  const [firstName, setFirstName] = useState("");
  const [clubId, setClubId] = useState("");
  const [clubInviteCode, setClubInviteCode] = useState("");
  const [position, setPosition] = useState("");
  const [ageCategory, setAgeCategory] = useState("");
  // Consentement parental (RGPD < 15 ans) : case cochée dans l'UI + modal politique.
  const [parentalConsentChecked, setParentalConsentChecked] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  // Preuve déjà stockée en Firestore (prefill) : réutilisée au save pour ne pas
  // réécrire acceptedAt à chaque édition du profil (la preuve d'origine prime).
  const storedParentalConsentRef = useRef<ParentalConsent | null>(null);
  const [level, setLevel] = useState("");
  const [dominantFoot, setDominantFoot] = useState("");
  const [mainObjective, setMainObjective] = useState("");
  const [targetFksSessionsPerWeek, setTargetFksSessionsPerWeek] = useState("");
  // Reprise (optionnel, skippable) -- cf. SELF_REPORTED_GAP_OPTIONS plus haut.
  const [selfReportedGapOption, setSelfReportedGapOption] = useState<SelfReportedGapOptionId | "">("");
  // clubTrainingsPerWeek/matchesPerWeek : plus de saisie manuelle numérique
  // (double emploi avec les chips jours, corrigé sur ordre du fondateur) —
  // dérivées de clubTrainingDays.length / matchDays.length au moment du
  // handleSave. Mêmes noms/types en base, aucun changement de contrat.
  const [hasClubTrainings, setHasClubTrainings] = useState<"oui" | "non" | "">("");
  const [clubTrainingDays, setClubTrainingDays] = useState<string[]>([]);
  const [matchDays, setMatchDays] = useState<string[]>([]);
  const [hasGymAccess, setHasGymAccess] = useState<"oui" | "occasionnel" | "non" | "">("");
  // gymEquipment/homeEquipment/hasHomeEquipment : plus de grille dans le setup
  // (docs/onboarding-design.md §4.6, "les 29 cases de matériel disparaissent").
  // Ces états ne sont plus modifiables ici — on les garde uniquement pour
  // repasser sans perte au save une valeur déjà en base (édition d'un profil
  // pré-existant). Un nouveau profil part sur des défauts sûrs ([] / false).
  const [gymEquipment, setGymEquipment] = useState<string[]>([]);
  const [hasHomeEquipment, setHasHomeEquipment] = useState<"oui" | "non" | "">("");
  const [homeEquipment, setHomeEquipment] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);


  const shake = useRef(new Animated.Value(0)).current;
  const stepFade = useRef(new Animated.Value(1)).current;
  // Départ du chrono setup (funnel analytics), consommé par profile_completed.
  const setupStartRef = useRef(Date.now());

  const cycleId = isMicrocycleId(activeCycleGoal) ? activeCycleGoal : null;
  const cycleLabel = cycleId ? MICROCYCLES[cycleId].label : null;
  const cycleProgress = Math.min(MICROCYCLE_TOTAL_SESSIONS_DEFAULT, Math.max(0, Math.trunc(microcycleSessionIndex ?? 0)));

  /* ─── Prefill ─── */
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    // Fallback si le doc Firestore n'a pas (encore) de prénom : le setDoc du Register
    // peut arriver après ce getDoc one-shot (course), on récupère le displayName auth.
    const fallbackFirstName = user.displayName?.trim() ?? "";
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      const d = snap.data();
      const docFirstName = d && typeof d.firstName === "string" ? d.firstName.trim() : "";
      if (docFirstName) setFirstName(docFirstName);
      else if (fallbackFirstName) setFirstName(fallbackFirstName);
      if (!d) return;
      if (typeof d.clubId === "string") setClubId(d.clubId);
      if (typeof d.position === "string") setPosition(d.position);
      if (typeof d.ageCategory === "string") setAgeCategory(d.ageCategory);
      // Consentement parental déjà donné (édition d'un profil U15 existant) :
      // on pré-coche pour ne pas redemander, et on garde la preuve d'origine.
      if (isStoredParentalConsent(d.parentalConsent)) {
        storedParentalConsentRef.current = d.parentalConsent;
        if (
          typeof d.ageCategory === "string" &&
          requiresParentalConsent(d.ageCategory) &&
          d.parentalConsent.ageCategoryAtConsent === d.ageCategory
        ) {
          setParentalConsentChecked(true);
        }
      }
      if (typeof d.level === "string") setLevel(d.level);
      if (typeof d.dominantFoot === "string") setDominantFoot(d.dominantFoot);
      if (typeof d.mainObjective === "string") setMainObjective(d.mainObjective);
      if (d.targetFksSessionsPerWeek != null) setTargetFksSessionsPerWeek(String(d.targetFksSessionsPerWeek));
      if (typeof d.selfReportedGapDays === "number") {
        const found = SELF_REPORTED_GAP_OPTIONS.find((o) => o.days === d.selfReportedGapDays);
        if (found) setSelfReportedGapOption(found.id);
      }
      // clubTrainingsPerWeek/matchesPerWeek ne sont plus prefillés depuis leur
      // valeur en base : ils sont redérivés de clubTrainingDays/matchDays
      // (prefillés juste après) à chaque save.
      if (typeof d.hasClubTrainings === "string") {
        setHasClubTrainings(d.hasClubTrainings === "oui" ? "oui" : d.hasClubTrainings === "non" ? "non" : "");
      }
      if (Array.isArray(d.clubTrainingDays)) setClubTrainingDays(d.clubTrainingDays);
      if (Array.isArray(d.matchDays)) setMatchDays(d.matchDays);
      if (typeof d.matchDay === "string" && (!d.matchDays || !d.matchDays.length)) setMatchDays([d.matchDay]);
      if (typeof d.hasGymAccess === "string") {
        setHasGymAccess(d.hasGymAccess === "regular" ? "oui" : d.hasGymAccess === "occasional" ? "occasionnel" : "non");
      }
      if (Array.isArray(d.gymEquipment)) setGymEquipment(d.gymEquipment);
      if (typeof d.hasHomeEquipment === "boolean") setHasHomeEquipment(d.hasHomeEquipment ? "oui" : "non");
      if (Array.isArray(d.homeEquipment)) setHomeEquipment(d.homeEquipment);
    }).catch((err) => {
      if (__DEV__) console.error("[ProfileSetup] Failed to prefill profile:", err);
      showToast({ type: "warn", title: "Profil", message: "Impossible de charger ton profil. Vérifie ta connexion et réessaie." });
    });
  }, []);

  useEffect(() => {
    // Non → jours club masqués et vidés ; clubTrainingsPerWeek dérivé
    // (clubTrainingDays.length) retombe naturellement à 0 au save.
    if (hasClubTrainings !== "oui") {
      setClubTrainingDays([]);
    }
  }, [hasClubTrainings]);

  useEffect(() => {
    if (hasGymAccess === "non") setGymEquipment([]);
  }, [hasGymAccess]);

  // Changement de catégorie : pas de consentement fantôme. Quitter U15 décoche ;
  // y revenir impose de re-cocher explicitement (logique pure testée dans
  // domain/__tests__/parentalConsent.test.ts).
  useEffect(() => {
    setParentalConsentChecked((cur) => consentCheckedAfterCategoryChange(ageCategory, cur));
  }, [ageCategory]);

  useEffect(() => {
    if (hasHomeEquipment === "non") setHomeEquipment([]);
  }, [hasHomeEquipment]);

  // Prédicat UNIQUE pour toute la surface consentement (case affichée + bouton
  // "Suivant" désactivé). Gaté sur SELECTABLE : un profil legacy 'U13' ne voit
  // PAS la case et son bouton reste actif → au tap, validateStep le bloque sur
  // "Choisis ta catégorie" (le seul garde pertinent tant qu'il n'a pas repick).
  // Sans ce gate, isParentalConsentBlocking('U13', false) désactiverait le
  // bouton sans case visible = soft-lock.
  const showParentalConsent =
    (SELECTABLE_AGE_CATEGORIES as readonly string[]).includes(ageCategory) &&
    requiresParentalConsent(ageCategory);

  /* ─── Helpers ─── */
  const fail = (title: string, message?: string) => {
    runShake(shake);
    haptics.warning();
    showToast({ type: "error", title, message });
  };

  const hapticSelect = () => {
    haptics.impactLight();
  };

  const animateTransition = (next: number) => {
    Animated.timing(stepFade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      Animated.timing(stepFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  /* ─── Validation per step ─── */
  const validateStep = (): boolean => {
    switch (step) {
      case 0:
        if (!firstName.trim()) { fail("Champs manquants", "Merci d'indiquer ton prénom."); return false; }
        if (!positions.includes(position as any)) { fail("Champs manquants", "Choisis ton poste."); return false; }
        // Chemin de décision unique, ordonné : (1) catégorie sélectionnable
        // (un profil legacy U13 échoue ici → il doit repick), (2) seulement
        // ensuite, consentement parental si la catégorie choisie est < 15 ans.
        if (!SELECTABLE_AGE_CATEGORIES.includes(ageCategory as any)) { fail("Champs manquants", "Choisis ta catégorie."); return false; }
        if (isParentalConsentBlocking(ageCategory, parentalConsentChecked)) {
          fail("Accord parental requis", "Coche la case pour confirmer l'accord de ton parent ou responsable légal.");
          return false;
        }
        if (!levels.includes(level as any)) { fail("Champs manquants", "Indique ton niveau."); return false; }
        if (!dominantFeet.includes(dominantFoot as any)) { fail("Champs manquants", "Choisis ton pied fort."); return false; }
        return true;
      case 1:
        if (!objectives.includes(mainObjective as any)) { fail("Champs manquants", "Choisis ton objectif principal."); return false; }
        if (!fksSessionsOptions.includes(targetFksSessionsPerWeek as any)) { fail("Champs manquants", "Indique tes séances FKS / semaine."); return false; }
        return true;
      case 2: {
        // clubTrainingsPerWeek/matchesPerWeek n'existent plus en saisie : ils
        // sont dérivés des jours cochés (clubTrainingDays/matchDays), donc
        // plus rien à valider côté nombre ici.
        if (!hasClubTrainings) { fail("Champs manquants", "Indique si tu as des entraînements club."); return false; }
        if (hasClubTrainings === "oui" && clubTrainingDays.length === 0) { fail("Champs manquants", "Précise les jours d'entraînement club."); return false; }
        return true;
      }
      case 3:
        // Plus de validation matériel (docs/onboarding-design.md §4.6) : le
        // matériel se choisit à la première génération, jamais un blocage ici.
        if (!hasGymAccess) { fail("Champs manquants", "Indique si tu as accès à une salle."); return false; }
        return true;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (!validateStep()) return;
    if (!isEditMode) {
      trackEvent("profile_step_completed", { step: step + 1, stepLabel: STEPS[step].label, totalSteps: TOTAL_STEPS });
    }
    haptics.impactMedium();
    if (step < TOTAL_STEPS - 1) animateTransition(step + 1);
  };

  const goBack = () => {
    haptics.impactLight();
    if (step > 0) animateTransition(step - 1);
  };

  /* ─── Back hardware Android : étape précédente au lieu de quitter l'app ─── */
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step > 0) {
        goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleLogout = async () => {
    haptics.impactLight();
    try {
      await signOut(firebaseAuth);
      // Le listener auth du RootNavigator renvoie automatiquement vers la connexion.
    } catch (e) {
      if (__DEV__) console.warn("[ProfileSetup] signOut failed", e);
      showToast({ type: "error", title: "Erreur", message: "Déconnexion impossible. Réessaie." });
    }
  };

  /* ─── Save ─── */
  const handleSave = async () => {
    if (!validateStep()) return;
    if (!isEditMode) {
      trackEvent("profile_step_completed", { step: step + 1, stepLabel: STEPS[step].label, totalSteps: TOTAL_STEPS });
    }
    const targetFksSessions = Number(targetFksSessionsPerWeek);
    // Dérivé des jours cochés (plus de saisie numérique séparée — double
    // emploi corrigé sur ordre du fondateur) : mêmes noms/types en base,
    // aucun changement de contrat côté backend.
    const trainings = clubTrainingDays.length;
    const matches = matchDays.length;
    // Rattachement club = parcours COACH (Cloud Function joinClubWithInviteCode).
    // normalizeInviteCodeInput vient de services/clubInvites (coach) ; le
    // normalizeInviteCode de da-polish tape sur repositories/clubsRepo, dont la
    // lecture directe de inviteCodes/* est FERMEE par les regles coach (§7.3).
    const normalizedInvite = normalizeInviteCodeInput(clubInviteCode);

    // Auto-assign : si aucun cycle actif, on applique la reco basée sur l'objectif
    // pour que le joueur atterrisse sur l'accueil avec un cycle prêt (zéro étape morte).
    const autoCycleId = isMicrocycleId(activeCycleGoal)
      ? null
      : recommendMicrocycle({ mainObjective, lastTestPlaylist: null }).id;

    try {
      setLoading(true);
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) { fail("Connexion requise", "Connecte-toi pour enregistrer ton profil."); return; }

      // Club DÉJÀ rattaché (édition de profil) : on le repasse tel quel. Un
      // nouveau rattachement, lui, est écrit par le serveur (Cloud Function),
      // APRÈS l'enregistrement du profil — voir screens/profileSetup/attachClub.
      const existingClubId: string | null = clubId?.trim() ? clubId.trim() : null;

      // Délai de garde 15 s (P1-05) : hors réseau, le setDoc pend sans fin et
      // l'overlay « Enregistrement… » gelait à jamais — force-kill = tout le
      // questionnaire perdu. Au timeout : toast honnête, les réponses restent
      // en place, « Terminer » se retape (setDoc merge idempotent). Si
      // l'écriture atterrit après coup (réseau revenu), le listener du
      // RootNavigator voit profileCompleted et bascule tout seul.
      const attach = await withTimeout(saveProfileThenAttachClub(
        {
          saveProfile: () =>
            setDoc(doc(db, "users", user.uid), {
              uid: user.uid,
              firstName: firstName.trim(),
              clubId: existingClubId,
              position, ageCategory, level, dominantFoot, mainObjective,
              targetFksSessionsPerWeek: targetFksSessions,
              // Reprise (optionnel) -- null tant que non repondu, jamais de valeur inventee.
              selfReportedGapDays: selfReportedGapOption
                ? (SELF_REPORTED_GAP_OPTIONS.find((o) => o.id === selfReportedGapOption)?.days ?? null)
                : null,
              clubTrainingsPerWeek: trainings,
              matchesPerWeek: matches,
              hasClubTrainings, clubTrainingDays,
              matchDay: matchDays[0] ?? null, matchDays,
              hasGymAccess: hasGymAccess === "oui" ? "regular" : hasGymAccess === "occasionnel" ? "occasional" : "none",
              // Repasse tel quel (pas d'UI ici pour les modifier) : [] / false pour
              // un nouveau profil, valeur prefillée inchangée pour un profil édité
              // — jamais undefined, jamais de perte silencieuse de données existantes.
              gymEquipment,
              hasHomeEquipment: hasHomeEquipment === "oui",
              homeEquipment,
              // Preuve de consentement parental (RGPD < 15 ans). Hors catégories
              // mineures, le champ n'est pas touché : une preuve historique éventuelle
              // reste en base (accountability), merge:true ne l'efface pas.
              ...(requiresParentalConsent(ageCategory)
                ? { parentalConsent: buildParentalConsent(ageCategory, storedParentalConsentRef.current) }
                : {}),
              profileCompleted: true,
              ...(autoCycleId
                ? {
                    microcycleGoal: autoCycleId,
                    goal: autoCycleId,
                    programGoal: autoCycleId,
                    microcycleStatus: "active",
                    microcycleTotalSessions: MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
                    microcycleSessionIndex: 0,
                    microcycleStartedAt: serverTimestamp(),
                  }
                : {}),
              updatedAt: serverTimestamp(),
            }, { merge: true }).then(() => undefined),
          joinClub: joinClubWithInviteCode,
        },
        normalizedInvite,
      ), 15000);

      if (attach.status !== "skipped") {
        // Mesure du taux d'échec du code club. On ne sait plus POURQUOI un code
        // est refusé (le serveur ne le dit pas, par conception) : l'événement ne
        // porte donc qu'un booléen, jamais une cause inventée.
        trackEvent("club_code_checked", { valid: attach.status === "joined" });
      }

      if (autoCycleId) {
        setMicrocycleGoal(autoCycleId);
        trackEvent("cycle_reco_shown", { cycleId: autoCycleId });
      }

      if (!isEditMode) {
        trackEvent("profile_completed", {
          durationSec: Math.round((Date.now() - setupStartRef.current) / 1000),
        });
      }

      haptics.success();
      if (attach.status === "failed") {
        // Le profil EST enregistré : on le dit d'abord, on explique le club
        // ensuite, et on laisse entrer. Aucune saisie n'est perdue, le joueur
        // pourra réessayer depuis Profil → Mon club.
        showToast({
          type: "warn",
          title: "Profil enregistré, club non rejoint",
          message: attach.message ?? "",
        });
      } else if (attach.status === "joined") {
        showToast({
          type: "success",
          title: "Profil enregistré",
          message: attach.clubName
            ? `Tu as rejoint ${attach.clubName}.`
            : "Tu as rejoint ton club.",
        });
      } else {
        showToast({ type: "success", title: "Profil enregistré", message: "Configuration terminée !" });
      }

      // Pont local : bascule immédiate vers l'app sans attendre le onSnapshot Firestore
      // (le listener RootNavigator reste la source durable).
      // En mode édition (ouvert depuis Profil/Réglages), on referme simplement l'écran.
      if (onProfileCompleted) {
        onProfileCompleted();
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (error) {
      if (error instanceof TimeoutError) {
        // Rien n'est perdu : le state du questionnaire est intact, l'écran
        // reste ouvert, et l'écriture partie peut encore atterrir toute seule.
        haptics.warning();
        showToast({
          type: "warn",
          title: "Impossible d'enregistrer pour le moment",
          message: "Vérifie ta connexion. Tes réponses sont conservées — réessaie dans un instant.",
        });
        return;
      }
      if (__DEV__) console.error("Erreur sauvegarde profil:", error);
      runShake(shake);
      haptics.error();
      showToast({ type: "error", title: "Erreur", message: "Impossible d'enregistrer le profil." });
    } finally {
      setLoading(false);
    }
  };

  /* ─── Render helpers ─── */
  // hitSlop (audit tactile 2026-07) : Choice frôle les 44pt (padding 14 +
  // texte), Chip est en-dessous (~37pt, padding 10) — très sollicité (poste,
  // catégorie, niveau, jours, objectif...). hitSlop agrandit la zone tactile
  // sans toucher au visuel (mêmes couleurs/tailles).
  //
  // Grammaire de sélection (DA Polish, direction A §2) : `Choice` pour tout
  // choix UNIQUE (ligne pleine largeur + checkmark-circle) ; `Chip` réservé
  // aux choix COURTS et MULTIPLES/NUMÉRIQUES où une grille compacte a du
  // sens (jours de la semaine, séances/semaine). Catégorie et Pied fort
  // étaient en Chip sans que cette logique s'applique (choix uniques
  // courts) — passés en Choice.
  const Choice = ({ label: lbl, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity
      style={[styles.choice, selected && styles.choiceSelected]}
      onPress={() => { hapticSelect(); onPress(); }}
      activeOpacity={0.7}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{lbl}</Text>
      {selected && (
        <Ionicons name="checkmark-circle" size={20} color={palette.accent} />
      )}
    </TouchableOpacity>
  );

  const Chip = ({ label: lbl, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={() => { hapticSelect(); onPress(); }}
      activeOpacity={0.7}
      // hitSlop volontairement petit (4pt) : les chips sont dans une grille
      // avec gap:10, un hitSlop plus large ferait se chevaucher les zones
      // tactiles de deux chips voisins. Le gros de la correction vient du
      // padding vertical du style `chip` (10 -> 14, cf. plus bas).
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{lbl}</Text>
    </TouchableOpacity>
  );

  /* ─── Step content ─── */
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Text style={styles.fieldLabel}>Prénom</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Kylian"
              placeholderTextColor={palette.muted}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Code club (optionnel)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: ABCDE-FGHJK"
              placeholderTextColor={palette.muted}
              value={clubInviteCode}
              onChangeText={setClubInviteCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {/* Le code n'est vérifié que par le serveur, APRÈS l'enregistrement
                du profil : rien de ce qui est saisi ici ne peut être perdu à
                cause d'un code refusé. */}
            <Text style={styles.fieldHelp}>
              Ton coach te le donne. Tu peux aussi le renseigner plus tard depuis ton profil.
            </Text>
            {/* Divulgation : quelles catégories d'infos le club verra. Elle
                INFORME, elle ne demande rien et ne bloque rien — ni le champ
                ci-dessus, ni le bouton « Continuer ». */}
            <ClubDataDisclosure style={styles.disclosure} />

            <Text style={styles.fieldLabel}>Poste</Text>
            {positions.map((p) => (
              <Choice key={p} label={POSITION_DISPLAY_LABELS[p] ?? p} selected={position === p} onPress={() => setPosition(p)} />
            ))}

            <Text style={styles.fieldLabel}>Catégorie</Text>
            {SELECTABLE_AGE_CATEGORIES.map((c) => (
              <Choice key={c} label={c} selected={ageCategory === c} onPress={() => setAgeCategory(c)} />
            ))}

            {/* Consentement parental — affiché uniquement pour une catégorie
                 SÉLECTIONNABLE < 15 ans (RGPD). Un legacy U13 ne voit rien ici
                 tant qu'il n'a pas repick (cf. showParentalConsent). */}
            {showParentalConsent && (
              <>
                <Text style={styles.fieldLabel}>Accord parental</Text>
                <Text style={styles.consentHint}>
                  Avant 15 ans, l'accord de ton parent ou responsable légal est obligatoire pour utiliser FKS.
                </Text>
                <View style={styles.consentBox}>
                  <Pressable
                    onPress={() => { hapticSelect(); setParentalConsentChecked(!parentalConsentChecked); }}
                    style={styles.consentCheckbox}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: parentalConsentChecked }}
                  >
                    <Ionicons
                      name={parentalConsentChecked ? "checkbox" : "square-outline"}
                      size={20}
                      color={parentalConsentChecked ? palette.accent : palette.muted}
                    />
                  </Pressable>
                  <Text style={styles.consentText}>
                    Je confirme que mon parent ou responsable légal a lu et accepté la{" "}
                    <Text
                      style={styles.consentLink}
                      onPress={() => { hapticSelect(); setPrivacyVisible(true); }}
                    >
                      politique de confidentialité
                    </Text>{" "}
                    de FKS.
                  </Text>
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>Niveau</Text>
            {levels.map((l) => (
              <Choice key={l} label={LEVEL_DISPLAY_LABELS[l] ?? l} selected={level === l} onPress={() => setLevel(l)} />
            ))}

            <Text style={styles.fieldLabel}>Pied fort</Text>
            {dominantFeet.map((f) => (
              <Choice key={f} label={f} selected={dominantFoot === f} onPress={() => setDominantFoot(f)} />
            ))}

            <TouchableOpacity
              style={styles.coachLink}
              onPress={() => { haptics.impactLight(); navigation.navigate("CoachOnboarding"); }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="people-outline" size={16} color={palette.accent} />
              <Text style={styles.coachLinkText}>Tu fais partie du staff ? Crée ton club coach</Text>
            </TouchableOpacity>
          </>
        );

      case 1:
        return (
          <>
            <View style={styles.cycleCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cycleLabel}>
                  {cycleLabel ? `${cycleLabel} · ${cycleProgress}/${MICROCYCLE_TOTAL_SESSIONS_DEFAULT}` : "Aucun cycle actif"}
                </Text>
                <Text style={styles.cycleHint}>Gère ton cycle depuis l'accueil ou le profil.</Text>
              </View>
              {/* Lien texte accent (DA Polish §1.5) — c'était le seul bouton
                  *outline bleu* du parcours, en concurrence directe avec
                  "Suivant" au milieu de l'étape. */}
              <TouchableOpacity
                style={styles.cycleLink}
                onPress={() => {
                  // Couverture haptique (recette 03/08, « du tactile partout ») :
                  // ce lien ouvre une modale plein écran sans le moindre retour
                  // au doigt, alors que tous les chips de l'étape en ont un.
                  hapticSelect();
                  navigation.navigate("CycleModal", { mode: cycleLabel ? "manage" : "select", origin: "profile" });
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={cycleLabel ? "Gérer mon cycle" : "Choisir un cycle"}
              >
                <Text style={styles.cycleButtonText}>{cycleLabel ? "Gérer" : "Choisir"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Objectif principal avec FKS</Text>
            {objectives.map((o) => (
              <Choice key={o} label={OBJECTIVE_DISPLAY_LABELS[o] ?? o} selected={mainObjective === o} onPress={() => setMainObjective(o)} />
            ))}

            <Text style={styles.fieldLabel}>Séances FKS / semaine (hors club)</Text>
            <View style={styles.chipRow}>
              {fksSessionsOptions.map((o) => (
                <Chip key={o} label={o} selected={targetFksSessionsPerWeek === o} onPress={() => setTargetFksSessionsPerWeek(o)} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Depuis quand n'as-tu pas eu d'entraînement régulier ? (optionnel)</Text>
            <View style={styles.chipRowWrap}>
              {SELF_REPORTED_GAP_OPTIONS.map((o) => (
                <Chip
                  key={o.id}
                  label={o.label}
                  selected={selfReportedGapOption === o.id}
                  onPress={() => setSelfReportedGapOption((cur) => (cur === o.id ? "" : o.id))}
                />
              ))}
            </View>
          </>
        );

      case 2:
        return (
          <>
            <Text style={styles.fieldLabel}>As-tu des entraînements club ?</Text>
            <View style={styles.chipRow}>
              <Chip label="Oui" selected={hasClubTrainings === "oui"} onPress={() => setHasClubTrainings("oui")} />
              <Chip label="Non" selected={hasClubTrainings === "non"} onPress={() => setHasClubTrainings("non")} />
            </View>

            {hasClubTrainings === "oui" ? (
              <>
                <Text style={styles.fieldLabel}>Quels jours t'entraînes-tu avec ton club ?</Text>
                <View style={styles.chipRowWrap}>
                  {daysOfWeek.map((d) => (
                    <Chip key={d.id} label={d.label} selected={clubTrainingDays.includes(d.id)}
                      onPress={() => toggleInList(d.id, clubTrainingDays, setClubTrainingDays)} />
                  ))}
                </View>
                <Text style={styles.hintText}>On calcule ta charge club à partir de tes jours.</Text>
              </>
            ) : hasClubTrainings === "non" ? (
              <Text style={styles.hintText}>Aucun entraînement club pris en compte.</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Quel(s) jour(s) as-tu match habituellement ?</Text>
            <View style={styles.chipRowWrap}>
              {daysOfWeek.map((d) => (
                <Chip key={`m${d.id}`} label={d.label} selected={matchDays.includes(d.id)}
                  onPress={() => toggleInList(d.id, matchDays, setMatchDays)} />
              ))}
            </View>
            {matchDays.length === 0 && (
              <Text style={styles.hintText}>Aucun match sélectionné.</Text>
            )}

          </>
        );

      case 3:
        return (
          <>
            <Text style={styles.fieldLabel}>Accès à une salle de musculation ?</Text>
            <View style={styles.chipRow}>
              <Chip label="Oui régulièrement" selected={hasGymAccess === "oui"} onPress={() => setHasGymAccess("oui")} />
              <Chip label="De temps en temps" selected={hasGymAccess === "occasionnel"} onPress={() => setHasGymAccess("occasionnel")} />
              <Chip label="Non" selected={hasGymAccess === "non"} onPress={() => setHasGymAccess("non")} />
            </View>

            {/* Plus de grille de matériel dans le setup : elle se choisit à la
                première génération (NewSessionScreen), avec les bons défauts
                selon le lieu. */}
            <Text style={styles.hintText}>
              Le matériel exact, tu le choisiras au moment de ta séance.
            </Text>
          </>
        );

      default:
        return null;
    }
  };

  const isLastStep = step === TOTAL_STEPS - 1;
  const progressPercent =
    (STEP_DENSITY_WEIGHTS.slice(0, step + 1).reduce((sum, w) => sum + w, 0) / STEP_DENSITY_TOTAL) * 100;
  // RGPD < 15 ans : "Suivant" désactivé tant que la case parentale n'est pas
  // cochée à l'étape catégorie. Toujours false pour U17/U18/Senior — et pour un
  // legacy U13 (showParentalConsent=false : la case est cachée, le désactiver
  // le soft-lockerait ; c'est validateStep qui le bloque sur la catégorie).
  const consentBlocksNext =
    step === 0 && showParentalConsent && isParentalConsentBlocking(ageCategory, parentalConsentChecked);

  return (
    <Screen style={styles.safeArea}>
      {/* Android : behavior undefined (défaut système) — "height" est notoirement bugué sur la new arch. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* AUDIT TACTILE (recette 03/08, même défaut que b708fe9 sur
            Register/Login) : un TouchableWithoutFeedback enveloppait tout cet
            arbre pour fermer le clavier au tap. Il pose un responder sur TOUS ses
            descendants — les deux champs de saisie, les ~40 chips et choix, les
            cases de consentement, le pied de page — et avale les taps au lieu de
            les laisser passer. Supprimé : le clavier se ferme par glissement
            (`keyboardDismissMode="on-drag"` sur le ScrollView ci-dessous), et
            `keyboardShouldPersistTaps="handled"` garde un tap sur un autre champ
            fonctionnel. */}
        <View style={{ flex: 1 }}>

          {/* ─── Top bar : marque + changer de compte (onboarding uniquement,
               masquée en mode édition où le header natif "Profil" fait doublon) ─── */}
          {!isEditMode && (
            <View style={styles.topBar}>
              <BrandMark size="sm" style={styles.brandMark} />
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogout}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="log-out-outline" size={16} color={palette.sub} />
                <Text style={styles.logoutText}>Changer de compte</Text>
              </TouchableOpacity>
            </View>
          )}

            {/* ─── Progress section ─── */}
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressStep}>Étape {step + 1}/{TOTAL_STEPS}</Text>
                <Text style={styles.progressName}>{STEPS[step].label}</Text>
              </View>
              <View style={styles.progressBarBg}>
                {/* Aplat accent (DA Polish lot0 §1.4) : le dégradé bleu->orange
                    violait "orange réservé aux CTA" (theme.ts) sur un élément
                    qui n'est pas un CTA. */}
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>

            {/* ─── Content ─── */}
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={{ opacity: stepFade, transform: [{ translateX: shake }] }}>

                {/* Step header */}
                <View style={styles.stepHeader}>
                  {/* Aplat accentSoft + icône accent (DA Polish lot0 §1.4),
                      cohérent avec le Home qui n'a aucun dégradé. */}
                  <View style={styles.stepIconCircle}>
                    <Ionicons name={STEPS[step].icon} size={24} color={palette.accent} />
                  </View>
                  <View>
                    <Text style={styles.stepTitle}>{STEPS[step].label}</Text>
                    <Text style={styles.stepSubtitle}>{STEPS[step].subtitle}</Text>
                  </View>
                </View>

                {/* Card container */}
                <View style={styles.card}>
                  {renderStep()}
                </View>

              </Animated.View>
            </ScrollView>

            {/* ─── Footer ─── */}
            <View style={styles.footer}>
              {step > 0 ? (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={goBack}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                >
                  <Ionicons name="chevron-back" size={20} color={palette.sub} />
                  <Text style={styles.backText}>Retour</Text>
                </TouchableOpacity>
              ) : null}

              {/* Étape 1 (DA Polish) : pleine largeur — avant, un `<View
                  flex:1/>` vide à gauche laissait "Suivant" occuper les 2/3
                  droits, un CTA seul et décentré qui lisait "pas fini". */}
              <View style={step > 0 ? styles.nextButtonWrap : styles.nextButtonWrapFull}>
                <Button
                  label={isLastStep ? "Terminer" : "Suivant"}
                  onPress={isLastStep ? handleSave : goNext}
                  disabled={loading || consentBlocksNext}
                  variant="primary"
                  size="lg"
                  fullWidth
                  style={styles.ctaShadowOff}
                  rightAccessory={
                    <Ionicons
                      name={isLastStep ? "checkmark-circle" : "arrow-forward"}
                      size={20}
                      color="#fff"
                    />
                  }
                  accessibilityLabel={isLastStep ? "Terminer la configuration du profil" : "Étape suivante"}
                />
              </View>
            </View>

        </View>
        </KeyboardAvoidingView>

        {/* Politique de confidentialité en modal locale : la route "PrivacyPolicy"
             n'est pas enregistrée dans le stack onboarding (profil non complété),
             on affiche donc le même contenu (utils/legalContent) sans navigation. */}
        <Modal
          visible={privacyVisible}
          animationType="slide"
          onRequestClose={() => setPrivacyVisible(false)}
        >
          <SafeAreaView style={styles.privacyModalSafe}>
            <View style={styles.privacyModalHeader}>
              <Text style={styles.privacyModalTitle}>Confidentialité</Text>
              <TouchableOpacity
                onPress={() => { hapticSelect(); setPrivacyVisible(false); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Fermer"
              >
                <Ionicons name="close" size={24} color={palette.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.privacyModalContent} showsVerticalScrollIndicator={false}>
              {PRIVACY_POLICY.map((section) => (
                <View key={section.title} style={styles.privacySection}>
                  <Text style={styles.privacySectionTitle}>{section.title}</Text>
                  {section.body.map((line, idx) => (
                    <Text key={`${section.title}_${idx}`} style={styles.privacyLine}>
                      {line}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <LoadingOverlay
          visible={loading}
          variant="light"
          estimatedDurationMs={2000}
          message="Enregistrement de ton profil…"
          submessage="Configuration initiale en cours."
        />
      </Screen>
  );
}

/* ══════════ STYLES ══════════ */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.xl2,
    paddingTop: 8,
  },
  brandMark: {
    textAlign: "left",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.sub,
  },

  /* Progress */
  progressSection: {
    paddingHorizontal: theme.spacing.xl2,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressStep: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.sub,
  },
  progressName: {
    ...theme.typography.label,
    color: palette.accent,
  },
  progressBarBg: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: theme.radius.pill,
    backgroundColor: palette.accent,
  },

  /* Scroll */
  scrollContent: {
    padding: 20,
    // paddingBottom 24 -> 160 (audit tactile 2026-07) : le footer Suivant/Retour
    // est FIXE hors ScrollView, et RN ne scrolle pas automatiquement vers le
    // champ actif au focus. Avec seulement 24, le scroll max ne laissait pas
    // assez de marge pour faire remonter les derniers champs de l'étape "Club"
    // (Entraînements/semaine, Matchs/semaine) au-dessus du clavier -> l'usager
    // pouvait rester bloqué à moitié masqué sans pouvoir scroller davantage.
    // Ce padding ne fait qu'agrandir la marge de scroll possible (jamais
    // moins visible qu'avant) ; il ne déplace rien tout seul.
    paddingBottom: 160,
    flexGrow: 1,
  },

  /* Step header */
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
  },
  stepIconCircle: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: palette.accentSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  stepTitle: {
    ...theme.typography.title,
    color: palette.text,
  },
  stepSubtitle: {
    ...theme.typography.body,
    color: palette.sub,
    marginTop: 2,
  },

  /* Card */
  card: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.xl2,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
    gap: 4,
    ...theme.shadow.soft,
  },

  /* Fields */
  fieldLabel: {
    ...theme.typography.label,
    color: palette.sub,
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.cardSoft,
    minHeight: 52,
  },
  fieldHelp: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.muted,
    marginTop: 6,
  },
  disclosure: {
    marginTop: 10,
  },

  /* Choice */
  choice: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: theme.radius.md,
    marginBottom: 8,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  choiceSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  choiceText: {
    color: palette.text,
    fontSize: theme.typography.body.fontSize,
    flex: 1,
  },
  choiceTextSelected: {
    color: palette.accent,
    fontWeight: theme.typography.bodyStrong.fontWeight,
  },

  /* Chip */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chipRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  chip: {
    // paddingVertical 10 -> 14 (audit tactile 2026-07) : sous 44pt avant
    // (visible surtout sur les jours de semaine / catégorie d'âge, très
    // sollicités). Même couleur/police, juste une cible plus confortable.
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: "transparent",
  },
  chipSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  chipText: {
    color: palette.sub,
    fontWeight: "600",
    fontSize: 14,
  },
  chipTextSelected: {
    color: palette.accent,
    fontWeight: "700",
    fontSize: 14,
  },

  /* Cycle card */
  cycleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  cycleLabel: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "700",
  },
  cycleHint: {
    color: palette.sub,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  // Lien texte accent (DA Polish §1.5) — remplace l'ancien bouton outline
  // bleu, seul bouton de ce type du parcours.
  cycleLink: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cycleButtonText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: "700",
  },

  hintText: {
    ...theme.typography.caption,
    color: palette.sub,
    marginTop: 8,
  },

  /* Consentement parental (RGPD < 15 ans) */
  consentHint: {
    color: palette.sub,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  consentBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.cardSoft,
  },
  // marginTop: 1 (audit visuel DA Polish) : la case (22px) dépassait
  // d'~4px au-dessus de la première ligne du texte — réalignée (case
  // ramenée à 20px en plus, cf. échelle d'icônes §1.3).
  consentCheckbox: { marginTop: 1 },
  consentText: {
    flex: 1,
    color: palette.sub,
    ...theme.typography.caption,
  },
  consentLink: {
    color: palette.accent,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  /* Modal politique de confidentialité */
  privacyModalSafe: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  privacyModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  privacyModalTitle: {
    ...theme.typography.section,
    color: palette.text,
  },
  privacyModalContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  privacySection: {
    gap: 6,
  },
  privacySectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.text,
  },
  privacyLine: {
    fontSize: 13,
    color: palette.sub,
    lineHeight: 19,
  },

  /* Lien coach */
  coachLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
    paddingVertical: 10,
  },
  // Descend en pied de carte, dépriorisé en caption (DA Polish §1.5) : ce
  // lien concurrençait visuellement "Suivant" à 13/700.
  coachLinkText: {
    ...theme.typography.caption,
    color: palette.accent,
  },

  /* Footer */
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: theme.spacing.xl2,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
    backgroundColor: palette.bg,
  },
  backButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 14,
    color: palette.sub,
    fontWeight: "600",
  },
  // "Suivant" — même composant Button que les 3 autres CTA du parcours
  // (DA Polish §1.5, "le changement le plus visible de la direction A") :
  // il ne change plus de forme/couleur/taille de texte à chaque écran.
  nextButtonWrap: { flex: 2 },
  // Étape 1 (DA Polish §1.6.4) : plus de `<View flex:1/>` vide à gauche —
  // "Suivant" occupe la largeur pleine au lieu des 2/3 droits seulement.
  nextButtonWrapFull: { flex: 1 },
  // Neutralise le halo orange de Button.primary (theme.shadow.accent porte
  // l'orange du dark, `#ff7a1a` — DA Polish lot0 §1.4). Local à cet écran :
  // Button.tsx garde son ombre par défaut pour ses 17 autres appelants.
  ctaShadowOff: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
});
