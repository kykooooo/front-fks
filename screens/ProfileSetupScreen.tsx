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
  type ParentalConsent,
} from "../domain/parentalConsent";
import { PRIVACY_POLICY } from "../utils/legalContent";
import { recommendMicrocycle } from "../domain/recommendMicrocycle";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { showToast } from "../utils/toast";
import { withTimeout, TimeoutError } from "../utils/errorHandler";
import {
  POSITION_DISPLAY_LABELS,
  LEVEL_DISPLAY_LABELS,
  OBJECTIVE_DISPLAY_LABELS,
} from "../utils/profileDisplayLabels";
import { runShake } from "../utils/animations";
import { theme } from "../constants/theme";
import { trackEvent } from "../services/analytics";
import { BODY_AREAS, LIBELLE_GRAVITE, LIBELLE_ZONE } from "../domain/monCorps/zones";
import type { BodyArea, BodyInjurySeverity } from "../domain/types";
import { ajouterGene } from "../hooks/monCorps/monCorpsActions";
import { setupDraft } from "../services/setupDraft";
import { createSubmitGuard } from "../services/registerAccount";
import { finaliserQuestionnaire } from "../services/finalizeSetup";
import {
  SETUP_DOMINANT_FEET as dominantFeet,
  SETUP_FKS_SESSIONS as fksSessionsOptions,
  SETUP_LEVELS as levels,
  SETUP_OBJECTIVES as objectives,
  SETUP_POSITIONS as positions,
  validerEtape,
  type ReponsesAValider,
} from "../domain/setupValidation";
import { resoudrePrefill, type SetupAnswers } from "../domain/setupPrefill";

// 5 → 4 étapes (mai 2026) : le matériel (29 cases, ≥1 obligatoire) sort du
// setup — cf. docs/onboarding-design.md §4.6/§4.3 (design validé par le
// fondateur). Le lieu + le matériel se choisissent à la première génération
// (NewSessionScreen), là où l'app a déjà les bons défauts. L'accès salle
// reste demandé ici : il nourrit le contexte IA + la reco de lieu.
const TOTAL_STEPS = 4;
const palette = theme.colors;

// Plafond d'agrandissement des TITRES de cet écran (même valeur que
// MonCorpsScreen / MonCorpsHubCard). Le cap global de l'app est à 1,3
// (config/textScaling) ; un titre sur une ou deux lignes, lui, mange la hauteur
// d'une carte bien avant.
const PLAFOND_TITRE = 1.2;

// Poids approximatifs de densité par étape, en nombre de zones interactives
// (DA Polish, direction A) : la barre "Étape n/4" linéaire annonçait 25% à
// l'étape 1 alors qu'elle concentre ~60% des champs du parcours (audit DA
// 2026-07, §4.12 — Identité: ~15 zones vs Salle: ~3). La barre reflète
// maintenant l'effort réel, sans déplacer aucun champ entre étapes.
const STEP_DENSITY_WEIGHTS = [15, 8, 5, 3] as const;
const STEP_DENSITY_TOTAL = STEP_DENSITY_WEIGHTS.reduce((sum, w) => sum + w, 0);

/* ─── Steps config ─── */
const STEPS: { label: string; icon: keyof typeof Ionicons.glyphMap; subtitle: string }[] = [
  // Libellés JOUEUR (2026-09) : l'étape 3 parle de SA semaine (entraînements
  // collectifs et matchs qu'il déclare), pas d'un club dans l'app ; l'étape 4
  // porte aussi la gêne du moment, son titre le dit. Chaque sous-titre donne le
  // POURQUOI : ces réponses règlent le dosage, ce n'est pas un formulaire.
  { label: "Ton profil", icon: "person-outline", subtitle: "Poste, âge et niveau règlent le dosage de tes séances." },
  { label: "Ton objectif", icon: "flag-outline", subtitle: "Il détermine le programme qu'on te propose." },
  { label: "Ta semaine", icon: "calendar-outline", subtitle: "Entraînements collectifs et matchs : on place tes séances autour." },
  { label: "Salle et état du moment", icon: "barbell-outline", subtitle: "Pour choisir le lieu et ménager une zone sensible." },
];

/* ─── Constants ─── */
// Les listes de valeurs (postes, niveaux, pieds, objectifs, séances) vivent dans
// domain/setupValidation — la même source que la validation.

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
// + matching substring dans recommendMicrocycle. On ne les modifie donc JAMAIS.
// Les maps d'affichage accentué vivent désormais dans utils/profileDisplayLabels.ts
// (partagées avec ProfileScreen, qui relisait les valeurs brutes — P1-20).

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
  // Le prénom vient-il de l'inscription (préremplissage) ? Sert UNIQUEMENT à
  // afficher une phrase d'aide honnête — « déjà renseigné » — au lieu de laisser
  // croire qu'on redemande la même chose (P2-01 de l'audit). Un état, pas une
  // ref : l'affichage en dépend, et une ref posée dans le préremplissage
  // asynchrone ne redéclencherait aucun rendu.
  const [prenomPrerempli, setPrenomPrerempli] = useState(false);
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
  // Question santé du setup (D6). Écrite dans « Mon corps » à l'enregistrement,
  // jamais dans le profil Firestore : le détail d'une blessure ne quitte pas
  // l'appareil (voir state/stores/useBodyStore.ts).
  const [geneSetup, setGeneSetup] = useState<"oui" | "non" | "">("");
  const [geneZone, setGeneZone] = useState<BodyArea | null>(null);
  const [geneGravite, setGeneGravite] = useState<BodyInjurySeverity | null>(null);
  // Anti-doublon : « Terminer » se retape après un échec réseau (setDoc merge
  // idempotent, cf. délai de garde P1-05). L'écriture locale, elle, ne l'est pas.
  const geneEcriteRef = useRef(false);
  // gymEquipment/homeEquipment/hasHomeEquipment : plus de grille dans le setup
  // (docs/onboarding-design.md §4.6, "les 29 cases de matériel disparaissent").
  // Ces états ne sont plus modifiables ici — on les garde uniquement pour
  // repasser sans perte au save une valeur déjà en base (édition d'un profil
  // pré-existant). Un nouveau profil part sur des défauts sûrs ([] / false).
  const [gymEquipment, setGymEquipment] = useState<string[]>([]);
  const [hasHomeEquipment, setHasHomeEquipment] = useState<"oui" | "non" | "">("");
  const [homeEquipment, setHomeEquipment] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // ── SOURCES DU FORMULAIRE (cf. domain/setupPrefill) ──────────────────────
  // Un champ TOUCHÉ par le joueur n'est plus jamais réécrit par une source
  // tardive (document Firestore lent, brouillon). `undefined` = pas encore reçu.
  const touchedRef = useRef(new Set<string>());
  // Clés PRÉSENTES dans le brouillon relu : elles restent « explicites » même si
  // le joueur n'y retouche pas (absent ≠ vidé, cf. services/setupDraft).
  const clesBrouillonRef = useRef(new Set<string>());
  const aNavigueRef = useRef(false);
  const serverDocRef = useRef<Record<string, unknown> | null | undefined>(undefined);
  const draftRef = useRef<{ step: number; answers: SetupAnswers } | null | undefined>(undefined);
  // Le compte de CE montage : le brouillon n'est lu et écrit que pour lui.
  const uidRef = useRef<string | null>(getAuth().currentUser?.uid ?? null);
  // Le brouillon a été lu (ou n'existe pas) : avant, on n'écrit rien — sinon
  // un formulaire encore vide écraserait le brouillon qu'on est en train de lire.
  const [sourcesPretes, setSourcesPretes] = useState(false);
  const finaliseRef = useRef(false);
  const [saveGuard] = useState(() => createSubmitGuard());
  const saisir = (champ: string, action: () => void) => {
    touchedRef.current.add(champ);
    action();
  };

  const shake = useRef(new Animated.Value(0)).current;
  const stepFade = useRef(new Animated.Value(1)).current;
  // Départ du chrono setup (funnel analytics), consommé par profile_completed.
  const setupStartRef = useRef(Date.now());

  const cycleId = isMicrocycleId(activeCycleGoal) ? activeCycleGoal : null;
  const cycleLabel = cycleId ? MICROCYCLES[cycleId].label : null;
  const cycleProgress = Math.min(MICROCYCLE_TOTAL_SESSIONS_DEFAULT, Math.max(0, Math.trunc(microcycleSessionIndex ?? 0)));

  /* ─── Sources : saisie en cours > brouillon du compte > document distant ─── */
  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return undefined;
    let vivant = true;
    // Fallback si le doc Firestore n'a pas (encore) de prénom : l'écriture de
    // l'inscription peut arriver après cette lecture, on prend le displayName auth.
    const fallbackFirstName = user.displayName?.trim() ?? "";

    const appliquer = () => {
      if (!vivant) return;
      const res = resoudrePrefill({
        edition: isEditMode,
        serverDoc: serverDocRef.current ?? null,
        fallbackFirstName,
        draft: draftRef.current ?? null,
        touched: touchedRef.current,
        aNavigue: aNavigueRef.current,
      });
      const p = res.patch;
      if (p.firstName !== undefined) setFirstName(p.firstName);
      if (res.prenomDepuisSource) setPrenomPrerempli(true);
      if (p.position !== undefined) setPosition(p.position);
      if (p.ageCategory !== undefined) setAgeCategory(p.ageCategory);
      if (p.level !== undefined) setLevel(p.level);
      if (p.dominantFoot !== undefined) setDominantFoot(p.dominantFoot);
      if (p.mainObjective !== undefined) setMainObjective(p.mainObjective);
      if (p.targetFksSessionsPerWeek !== undefined) setTargetFksSessionsPerWeek(p.targetFksSessionsPerWeek);
      if (p.selfReportedGapOption !== undefined) {
        const option = SELF_REPORTED_GAP_OPTIONS.find((o) => o.id === p.selfReportedGapOption);
        setSelfReportedGapOption(option ? option.id : "");
      }
      if (p.hasClubTrainings !== undefined) setHasClubTrainings(p.hasClubTrainings);
      if (p.clubTrainingDays !== undefined) setClubTrainingDays(p.clubTrainingDays);
      if (p.matchDays !== undefined) setMatchDays(p.matchDays);
      if (p.hasGymAccess !== undefined) setHasGymAccess(p.hasGymAccess);
      if (p.geneSetup !== undefined) setGeneSetup(p.geneSetup);
      if (p.geneZone !== undefined) {
        setGeneZone((BODY_AREAS as readonly string[]).includes(p.geneZone) ? (p.geneZone as BodyArea) : null);
      }
      if (p.geneGravite !== undefined) setGeneGravite(p.geneGravite);
      if (res.step !== null) setStep(res.step);
      if (res.supprimerBrouillon) {
        // Profil déjà finalisé : le vieux brouillon ne s'applique pas ET disparaît.
        draftRef.current = null;
        void setupDraft.clear(user.uid);
      }
    };

    if (isEditMode) {
      // Édition d'un profil EXISTANT : aucun brouillon n'est lu ni écrit, et un
      // reliquat d'inscription (écriture tardive après délai de garde) est retiré.
      draftRef.current = null;
      void setupDraft.clear(user.uid);
    } else {
      setupDraft.load(user.uid).then((brouillon) => {
        if (!vivant) return;
        draftRef.current = brouillon ? { step: brouillon.step, answers: brouillon.answers } : null;
        clesBrouillonRef.current = new Set(brouillon ? Object.keys(brouillon.answers) : []);
        appliquer();
        setSourcesPretes(true);
        if (brouillon && Object.keys(brouillon.answers).length > 1) {
          showToast({ type: "info", title: "On reprend où tu en étais", message: "Tes réponses précédentes sont là. Vérifie-les et continue." });
        }
      });
    }

    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (!vivant) return;
      const d = (snap.data() ?? null) as Record<string, unknown> | null;
      serverDocRef.current = d;
      appliquer();
      if (!d) return;
      // Ce qui n'est PAS une réponse du questionnaire : repassé tel quel au save.
      // Consentement parental déjà donné (édition d'un profil U15 existant) :
      // on pré-coche pour ne pas redemander, et on garde la preuve d'origine.
      if (isStoredParentalConsent(d.parentalConsent)) {
        storedParentalConsentRef.current = d.parentalConsent;
        if (
          !touchedRef.current.has("parentalConsent") &&
          typeof d.ageCategory === "string" &&
          requiresParentalConsent(d.ageCategory) &&
          d.parentalConsent.ageCategoryAtConsent === d.ageCategory
        ) {
          setParentalConsentChecked(true);
        }
      }
      if (Array.isArray(d.gymEquipment)) setGymEquipment(d.gymEquipment as string[]);
      if (typeof d.hasHomeEquipment === "boolean") setHasHomeEquipment(d.hasHomeEquipment ? "oui" : "non");
      if (Array.isArray(d.homeEquipment)) setHomeEquipment(d.homeEquipment as string[]);
    }).catch((err) => {
      if (__DEV__) console.error("[ProfileSetup] Failed to prefill profile:", err);
      // Inscription initiale : rien à charger n'est pas une panne (compte neuf,
      // réseau lent) — le brouillon et la saisie suffisent. En édition, on le dit.
      if (isEditMode) {
        showToast({ type: "warn", title: "Profil", message: "Impossible de charger ton profil. Vérifie ta connexion et réessaie." });
      }
    });
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Brouillon : écrit à chaque changement (inscription initiale seulement) ─── */
  // SEULS LES CHAMPS EXPLICITES entrent dans le brouillon : ceux que le joueur a
  // touchés dans cette session, et ceux qu'un brouillon précédent portait déjà.
  // Un champ jamais approché reste ABSENT (le profil distant peut le remplir) ;
  // un champ vidé volontairement reste PRÉSENT et vide (il ne revient pas).
  const reponsesCourantes = (): SetupAnswers => {
    const toutes: Record<string, unknown> = {
      firstName, position, ageCategory, level, dominantFoot, mainObjective,
      targetFksSessionsPerWeek, selfReportedGapOption, hasClubTrainings, clubTrainingDays,
      matchDays, hasGymAccess, geneSetup, geneZone: geneZone ?? "", geneGravite,
    };
    const explicites = new Set([...touchedRef.current, ...clesBrouillonRef.current]);
    // Décocher « entraînements collectifs » vide aussi les jours : les deux vont ensemble.
    if (explicites.has("hasClubTrainings")) explicites.add("clubTrainingDays");
    if (explicites.has("geneSetup")) { explicites.add("geneZone"); explicites.add("geneGravite"); }
    const out: Record<string, unknown> = {};
    for (const cle of explicites) if (cle in toutes) out[cle] = toutes[cle];
    return out as SetupAnswers;
  };

  const ecrireBrouillon = (etape: number) => {
    const uid = uidRef.current;
    if (isEditMode || !sourcesPretes || finaliseRef.current || !uid) return Promise.resolve(false);
    // Le compte a changé sous l'écran (déconnexion en vol) : on n'écrit rien.
    if (getAuth().currentUser?.uid !== uid) return Promise.resolve(false);
    return setupDraft.save(uid, { step: etape, answers: reponsesCourantes() });
  };

  useEffect(() => {
    if (isEditMode || !sourcesPretes) return undefined;
    const minuteur = setTimeout(() => {
      void ecrireBrouillon(step);
    }, 400);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sourcesPretes, step, firstName, position, ageCategory, level, dominantFoot, mainObjective,
    targetFksSessionsPerWeek, selfReportedGapOption, hasClubTrainings, clubTrainingDays, matchDays,
    hasGymAccess, geneSetup, geneZone, geneGravite,
  ]);

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
  const reponsesAValider = (): ReponsesAValider => ({
    firstName, position, ageCategory, level, dominantFoot, mainObjective, targetFksSessionsPerWeek,
    hasClubTrainings, clubTrainingDays, hasGymAccess, geneSetup, geneZone, geneGravite,
    // L'état RÉEL de la case : jamais déduit de la catégorie ni du brouillon.
    parentalConsentChecked,
  });

  /** Validation de l'étape AFFICHÉE (bouton « Suivant ») — domain/setupValidation. */
  const validateStep = (): boolean => {
    const verdict = validerEtape(step, reponsesAValider());
    if (verdict.ok) return true;
    fail(verdict.title, verdict.message);
    return false;
  };

  const goNext = () => {
    if (!validateStep()) return;
    if (!isEditMode) {
      trackEvent("profile_step_completed", { step: step + 1, stepLabel: STEPS[step].label, totalSteps: TOTAL_STEPS });
    }
    haptics.impactMedium();
    aNavigueRef.current = true;
    if (step < TOTAL_STEPS - 1) {
      void ecrireBrouillon(step + 1);
      animateTransition(step + 1);
    }
  };

  const goBack = () => {
    haptics.impactLight();
    aNavigueRef.current = true;
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
      // POLITIQUE DE DÉCONNEXION : la saisie n'est pas détruite. Le brouillon
      // reste CHIFFRÉ sur ce téléphone, lié à ce compte, et ne se recharge
      // qu'après une nouvelle connexion au même compte (services/setupDraft).
      const garde = await ecrireBrouillon(step);
      if (garde) {
        showToast({ type: "info", title: "Réponses gardées", message: "Elles t'attendent sur ce téléphone, pour ce compte uniquement." });
      }
      await signOut(firebaseAuth);
      // Le listener auth du RootNavigator renvoie automatiquement vers la connexion.
    } catch (e) {
      if (__DEV__) console.warn("[ProfileSetup] signOut failed", e);
      showToast({ type: "error", title: "Erreur", message: "Déconnexion impossible. Réessaie." });
    }
  };

  /**
   * Sortie de l'écran quand tout est joué. Pont local : bascule immédiate vers
   * l'app sans attendre le onSnapshot Firestore (le listener du RootNavigator
   * reste la source durable). En mode édition (ouvert depuis Profil/Réglages),
   * on referme simplement l'écran.
   */
  const terminer = () => {
    if (onProfileCompleted) {
      onProfileCompleted();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    // DOUBLE APPUI : `loading` est un état asynchrone ; la garde, elle, est
    // synchrone — une seule écriture de profil (et une seule gêne) par appui.
    await saveGuard.run(enregistrerProfil);
  };

  const enregistrerProfil = async () => {
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

      // TOUTE la finalisation vit dans services/finalizeSetup (testée en
      // exécution) : validation de TOUTES les étapes AVANT la moindre écriture
      // — gêne locale comprise —, puis profil, puis suppression du brouillon.
      const issue = await finaliserQuestionnaire(
        {
          ecrireGene: (g) => ajouterGene({ zone: g.zone as BodyArea, gravite: g.gravite as BodyInjurySeverity, source: "setup" }),
          onGeneEcrite: () => { geneEcriteRef.current = true; },
          // DÉLAI DE GARDE (P1-05) : hors réseau, le `setDoc` pend sans fin. Un
          // dépassement remonte au catch ci-dessous ; l'écriture partie n'est pas
          // annulée — si elle atterrit après coup, le listener du RootNavigator
          // voit `profileCompleted` et bascule tout seul.
          ecrireProfil: (uid, data) =>
            withTimeout(setDoc(doc(db, "users", uid), data, { merge: true }).then(() => undefined), 15000),
          effacerBrouillon: async (uid) => {
            // `finaliseRef` empêche une écriture différée (minuteur) de recréer le brouillon.
            finaliseRef.current = true;
            await setupDraft.clear(uid);
          },
          serverTimestamp,
        },
        {
          uid: user.uid,
          reponses: { ...reponsesAValider(), selfReportedGapOption, matchDays },
          storedParentalConsent: storedParentalConsentRef.current,
          passthrough: { gymEquipment, hasHomeEquipment: hasHomeEquipment === "oui", homeEquipment },
          autoCycleId,
          geneDejaEcrite: geneEcriteRef.current,
        },
      );

      if (issue.status === "invalid") {
        // Rien n'a été écrit. On ramène le joueur à la PREMIÈRE étape invalide
        // (brouillon repris plus loin, profil ancien incomplet…) et on dit quoi.
        if (issue.step !== step) animateTransition(issue.step);
        fail(issue.title, issue.message);
        return;
      }

      if (!isEditMode) {
        trackEvent("profile_step_completed", { step: step + 1, stepLabel: STEPS[step].label, totalSteps: TOTAL_STEPS });
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
      const programme = autoCycleId ? MICROCYCLES[autoCycleId].label : cycleLabel;
      showToast(
        isEditMode
          ? { type: "success", title: "Profil enregistré", message: "Tes prochaines séances en tiennent compte." }
          : {
              type: "success",
              title: "Profil enregistré",
              message: programme
                ? `Programme ${programme} prêt. Lance ta première séance depuis l'accueil.`
                : "Choisis ton programme depuis l'accueil pour lancer ta première séance.",
            },
      );

      terminer();
    } catch (error) {
      // LE PROFIL N'EST PAS ENREGISTRÉ, DONC ON NE RETIENT RIEN. Ce qui arrive
      // ici est un échec de l'ÉCRITURE du profil, ou son délai de garde de 15 s.
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
      // Le COMPTE existe, c'est le PROFIL qui n'est pas passé — et rien n'est perdu.
      showToast({
        type: "error",
        title: "Profil non enregistré",
        message: "Ton compte existe et tes réponses sont conservées. Réessaie dans un instant.",
      });
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
            <Text style={styles.fieldHelp}>
              Tout est nécessaire pour régler tes séances, sauf les questions marquées « facultatif ».
            </Text>
            <Text style={styles.fieldLabel}>Prénom</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Kylian"
              placeholderTextColor={palette.muted}
              value={firstName}
              onChangeText={(v) => saisir("firstName", () => setFirstName(v))}
              autoCapitalize="words"
              // `given-name` : le champ attend un PRÉNOM. Sans ce jeton, iOS
              // proposait le nom complet du contact (P2-02).
              autoComplete="given-name"
              textContentType="givenName"
            />
            {/* Prénom déjà donné à l'inscription : on ne le redemande pas, on
                le montre — et il reste corrigeable d'un tap. */}
            {prenomPrerempli && !isEditMode ? (
              <Text style={styles.fieldHelp}>
                Déjà renseigné à l'inscription. Corrige-le si besoin.
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>Poste</Text>
            {positions.map((p) => (
              <Choice key={p} label={POSITION_DISPLAY_LABELS[p] ?? p} selected={position === p} onPress={() => saisir("position", () => setPosition(p))} />
            ))}

            <Text style={styles.fieldLabel}>Catégorie d'âge</Text>
            <Text style={styles.fieldHelp}>Elle fixe les plafonds de charge adaptés à ton âge.</Text>
            {SELECTABLE_AGE_CATEGORIES.map((c) => (
              <Choice key={c} label={c} selected={ageCategory === c} onPress={() => saisir("ageCategory", () => setAgeCategory(c))} />
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
                    onPress={() => { hapticSelect(); saisir("parentalConsent", () => setParentalConsentChecked(!parentalConsentChecked)); }}
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
              <Choice key={l} label={LEVEL_DISPLAY_LABELS[l] ?? l} selected={level === l} onPress={() => saisir("level", () => setLevel(l))} />
            ))}

            <Text style={styles.fieldLabel}>Pied fort</Text>
            {dominantFeet.map((f) => (
              <Choice key={f} label={f} selected={dominantFoot === f} onPress={() => saisir("dominantFoot", () => setDominantFoot(f))} />
            ))}

          </>
        );

      case 1:
        return (
          <>
            {/* INSCRIPTION INITIALE : la carte « Aucun cycle actif — Choisir » posait
                une question que l'app règle toute seule (programme recommandé à la
                fin, d'après l'objectif). Elle ne reste qu'en édition de profil. */}
            {!isEditMode ? (
              <Text style={styles.fieldHelp}>
                À la fin, on te propose le programme adapté à cet objectif. Tu pourras en changer quand tu veux.
              </Text>
            ) : (
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
            )}

            <Text style={styles.fieldLabel}>Objectif principal avec FKS</Text>
            {objectives.map((o) => (
              <Choice key={o} label={OBJECTIVE_DISPLAY_LABELS[o] ?? o} selected={mainObjective === o} onPress={() => saisir("mainObjective", () => setMainObjective(o))} />
            ))}

            <Text style={styles.fieldLabel}>Séances FKS par semaine, en plus de tes entraînements</Text>
            <View style={styles.chipRow}>
              {fksSessionsOptions.map((o) => (
                <Chip key={o} label={o} selected={targetFksSessionsPerWeek === o} onPress={() => saisir("targetFksSessionsPerWeek", () => setTargetFksSessionsPerWeek(o))} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Depuis quand n'as-tu pas eu d'entraînement régulier ? (facultatif)</Text>
            <Text style={styles.fieldHelp}>Après une coupure, on redémarre plus doucement.</Text>
            <View style={styles.chipRowWrap}>
              {SELF_REPORTED_GAP_OPTIONS.map((o) => (
                <Chip
                  key={o.id}
                  label={o.label}
                  selected={selfReportedGapOption === o.id}
                  onPress={() => saisir("selfReportedGapOption", () => setSelfReportedGapOption((cur) => (cur === o.id ? "" : o.id)))}
                />
              ))}
            </View>
          </>
        );

      case 2:
        return (
          <>
            <Text style={styles.fieldLabel}>As-tu des entraînements collectifs (club, équipe) ?</Text>
            <View style={styles.chipRow}>
              <Chip label="Oui" selected={hasClubTrainings === "oui"} onPress={() => saisir("hasClubTrainings", () => setHasClubTrainings("oui"))} />
              <Chip label="Non" selected={hasClubTrainings === "non"} onPress={() => saisir("hasClubTrainings", () => setHasClubTrainings("non"))} />
            </View>

            {hasClubTrainings === "oui" ? (
              <>
                <Text style={styles.fieldLabel}>Quels jours t'entraînes-tu avec ton équipe ?</Text>
                <View style={styles.chipRowWrap}>
                  {daysOfWeek.map((d) => (
                    <Chip key={d.id} label={d.label} selected={clubTrainingDays.includes(d.id)}
                      onPress={() => saisir("clubTrainingDays", () => toggleInList(d.id, clubTrainingDays, setClubTrainingDays))} />
                  ))}
                </View>
                <Text style={styles.hintText}>Ces jours comptent dans ta charge : on évite de te surcharger autour.</Text>
              </>
            ) : hasClubTrainings === "non" ? (
              <Text style={styles.hintText}>Aucun entraînement collectif pris en compte.</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Tes jours de match habituels (facultatif)</Text>
            <View style={styles.chipRowWrap}>
              {daysOfWeek.map((d) => (
                <Chip key={`m${d.id}`} label={d.label} selected={matchDays.includes(d.id)}
                  onPress={() => saisir("matchDays", () => toggleInList(d.id, matchDays, setMatchDays))} />
              ))}
            </View>
            {matchDays.length === 0 && (
              <Text style={styles.hintText}>Pas de match régulier ? Ne coche rien. Sinon, on allège la veille et le jour même.</Text>
            )}

          </>
        );

      case 3:
        return (
          <>
            <Text style={styles.fieldLabel}>Accès à une salle de musculation ?</Text>
            <View style={styles.chipRow}>
              <Chip label="Oui régulièrement" selected={hasGymAccess === "oui"} onPress={() => saisir("hasGymAccess", () => setHasGymAccess("oui"))} />
              <Chip label="De temps en temps" selected={hasGymAccess === "occasionnel"} onPress={() => saisir("hasGymAccess", () => setHasGymAccess("occasionnel"))} />
              <Chip label="Non" selected={hasGymAccess === "non"} onPress={() => saisir("hasGymAccess", () => setHasGymAccess("non"))} />
            </View>

            {/* Plus de grille de matériel dans le setup : elle se choisit à la
                première génération (NewSessionScreen), avec les bons défauts
                selon le lieu. */}
            <Text style={styles.hintText}>
              Le matériel exact, tu le choisiras au moment de ta séance.
            </Text>

            {/* UNE SEULE QUESTION SANTÉ DANS LE SETUP (décision D6).
                Constat de l'audit : le setup ne demandait RIEN sur les gênes.
                Un joueur qui s'inscrit en revenant de blessure — cas explicite,
                puisqu'un des objectifs proposés s'appelle « Reprendre apres une
                blessure » — recevait une première séance qui ignorait
                complètement son état.
                Elle écrit dans « Mon corps » (source `setup`), la même et unique
                source que tout le reste : pas de champ profil parallèle qui
                divergerait dès la première mise à jour.
                Elle est FACULTATIVE et ne bloque jamais « Terminer » : le setup
                doit rester sous trois minutes. */}
            <Text style={styles.fieldLabel}>Une gêne ou une blessure en ce moment ? (facultatif)</Text>
            <Text style={styles.fieldHelp}>Elle reste sur ton téléphone et sert à ménager la zone dès ta première séance.</Text>
            <View style={styles.chipRow}>
              <Chip
                label="Non, rien"
                selected={geneSetup === "non"}
                onPress={() => saisir("geneSetup", () => setGeneSetup("non"))}
              />
              <Chip
                label="Oui"
                selected={geneSetup === "oui"}
                onPress={() => saisir("geneSetup", () => setGeneSetup("oui"))}
              />
            </View>

            {geneSetup === "oui" ? (
              <>
                <Text style={styles.fieldLabel}>Où ?</Text>
                <View style={styles.chipRow}>
                  {BODY_AREAS.map((z) => (
                    <Chip
                      key={z}
                      label={LIBELLE_ZONE[z]}
                      selected={geneZone === z}
                      onPress={() => saisir("geneZone", () => setGeneZone(z))}
                    />
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Ça t'empêche de quoi ?</Text>
                <View style={styles.chipRow}>
                  {([1, 2, 3] as BodyInjurySeverity[]).map((g) => (
                    <Chip
                      key={g}
                      label={LIBELLE_GRAVITE[g]}
                      selected={geneGravite === g}
                      onPress={() => saisir("geneGravite", () => setGeneGravite(g))}
                    />
                  ))}
                </View>
                <Text style={styles.hintText}>
                  Tu pourras la mettre à jour quand tu veux depuis « Mon corps »,
                  dans l'onglet Séance.
                </Text>
              </>
            ) : null}
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
                <Text style={styles.progressStep} maxFontSizeMultiplier={PLAFOND_TITRE}>Étape {step + 1}/{TOTAL_STEPS}</Text>
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
                    <Text style={styles.stepTitle} maxFontSizeMultiplier={PLAFOND_TITRE}>{STEPS[step].label}</Text>
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
