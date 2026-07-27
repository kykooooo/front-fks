// screens/coach/CoachWeekScreen.tsx
//
// Onglet « Semaine » de l'espace coach. Il répond à deux questions, dans cet
// ordre, parce que c'est l'ordre dans lequel un entraîneur les pose :
//   1. « Que s'est-il passé cette semaine ? »  -> synthèse de GROUPE (lecture)
//   2. « Quel cadre est-ce que je donne ? »    -> le formulaire du coach (écriture)
// Puis le code club, qui vit dans cet onglet depuis toujours et y reste.
//
// CE QUE CET ÉCRAN NE FAIT PAS.
//  - Il ne calcule AUCUNE règle métier : la synthèse vient de `buildWeekDigest`
//    (domain/coachView/week), les vues joueur de `toCoachPlayerViews`. L'écran
//    choisit quoi montrer, jamais ce que ça veut dire.
//  - Il n'affiche aucun graphique. Un graphe qui ne décide rien est une
//    décoration ; en cas de doute, on écrit la phrase.
//  - Il ne prédit rien, ne classe pas les joueurs, n'emploie ni RPE, ni TSB, ni
//    « fatigue déclarée » : ces données n'existent pas côté coach.
//
// TROIS DÉFAUTS D'ORIGINE CORRIGÉS ICI.
//  1. Le bulletin annonçait « cette semaine » et comptait des états INSTANTANÉS.
//     Ici, tout ce qui est annoncé « cette semaine » est compté sur les bornes
//     réelles lundi -> dimanche ; ce qui vaut pour aujourd'hui est annoncé
//     « aujourd'hui », et seulement sur la semaine en cours.
//  2. Un compteur à 0 était affiché même quand AUCUNE donnée d'activité n'était
//     disponible : le coach lisait « 0 séance » là où il fallait lire « on ne
//     sait pas ». Sans fenêtre d'activité, les chiffres valent `null` (« — »).
//  3. Hors ligne, l'écriture Firestore ne résout jamais : le bouton restait
//     bloqué sur « Enregistrement... » à l'infini et la puce « type d'équipe »
//     s'allumait sans que rien ne parte. On borne désormais l'attente, on
//     annonce honnêtement « non confirmé », et on annule le retour visuel.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { CoachScreen } from "../../components/coach/CoachScreen";
import { CoachSectionCard } from "../../components/coach/CoachSectionCard";
import { CoachMetric } from "../../components/coach/CoachMetric";
import { CoachSkeleton } from "../../components/coach/CoachSkeleton";
import { CoachEmptyState } from "../../components/coach/CoachEmptyState";
import { CoachErrorState } from "../../components/coach/CoachErrorState";
import { CoachStateBlock } from "../../components/coach/CoachStateBlock";
import { CoachStatusPill } from "../../components/coach/CoachStatusPill";
import { CoachSignalRow } from "../../components/coach/CoachSignalRow";
import { CoachLegalFooter } from "../../components/coach/CoachLegalFooter";
import {
  coachColors,
  coachLayout,
  coachRadius,
  coachSpacing,
  coachType,
  provenanceTone,
} from "../../components/coach/coachTheme";

import {
  ASSIDUITE_JOURS,
  addDaysToKey,
  buildFreshness,
  buildWeekDigest,
  type CoachPlayerView,
} from "../../domain/coachView";
import { formatCoachWeekLabel } from "../../domain/coachLabels";
import {
  CLUB_TEAM_GENDERS,
  type ClubTeamGender,
  type ClubTrainingIntensity,
  type ClubWeekGoal,
} from "../../domain/types";
import { saveClubWeekContext, setClubTeamGender } from "../../repositories/clubsRepo";
import { useCoachClub } from "../../hooks/coach/useCoachClub";
import { useCoachRoster } from "../../hooks/coach/useCoachRoster";
import { useCoachNowMs } from "../../hooks/coach/useCoachNowMs";
import { useHaptics } from "../../hooks/useHaptics";
import { auth } from "../../services/firebase";
import { toDateKey } from "../../utils/dateHelpers";
import { showToast } from "../../utils/toast";

// ─── Vocabulaire du cadre (repris tel quel de l'écran d'origine) ─────────────
// La logique métier ne change PAS : mêmes valeurs persistées, mêmes options
// proposées, mêmes appels au repository. Seule l'UI est portée sur le socle.

const INTENSITY_LABELS: Record<ClubTrainingIntensity, string> = {
  light: "Légère",
  normal: "Normale",
  heavy: "Intense",
  very_heavy: "Très intense",
};

// Le cadre coach n'offre que 3 niveaux clairs. `very_heavy` reste une valeur
// valide en lecture (rétrocompat des anciens documents) mais n'est pas proposée.
const OFFERED_INTENSITIES: ClubTrainingIntensity[] = ["light", "normal", "heavy"];

const GOAL_LABELS: Record<ClubWeekGoal, string> = {
  freshness: "Fraîcheur",
  prevention: "Appuis & freinage",
  speed: "Vitesse contrôlée",
  strength: "Renfo terrain",
  comeback: "Reprise",
};

// `comeback` reste accepté en lecture (vieux documents), plus proposé à l'écrit.
const OFFERED_WEEK_GOALS: ClubWeekGoal[] = ["freshness", "prevention", "speed", "strength"];

const TEAM_GENDER_LABELS: Record<ClubTeamGender, string> = {
  female: "Féminine",
  male: "Masculine",
  mixed: "Mixte",
};

const NOTE_MAX = 200;

/**
 * Délai au-delà duquel on cesse d'attendre une écriture Firestore.
 *
 * POURQUOI. Hors ligne, `setDoc` ne rejette pas : il met l'écriture en file
 * locale et sa promesse reste EN ATTENTE jusqu'au retour du réseau. Sans borne,
 * le bouton reste sur « Enregistrement... » indéfiniment — le coach ne sait ni
 * si c'est parti, ni s'il doit recommencer. On borne, et on dit la vérité :
 * « non confirmé » (pas « perdu » : l'écriture peut encore partir plus tard).
 */
export const COACH_SAVE_TIMEOUT_MS = 10_000;

/** Erreur interne distinguant « pas de réponse » d'un vrai refus serveur. */
class SaveTimeoutError extends Error {
  constructor() {
    super("save-timeout");
    this.name = "SaveTimeoutError";
  }
}

/** Course entre l'écriture et l'horloge. La promesse perdante est abandonnée. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SaveTimeoutError()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Peut-on LIRE honnêtement la semaine qui commence le lundi `lundi` ?
 *
 * La fenêtre d'activité serveur est bornée (14 dates maximum). Reculer sur une
 * semaine que cette fenêtre ne couvre pas produirait « 0 séance » alors que la
 * bonne réponse est « on ne sait pas ». Une semaine est donc lisible dès qu'AU
 * MOINS un membre la couvre réellement :
 *   - sa fenêtre existe (sinon on ne sait rien de son activité), ET
 *   - soit elle n'est pas saturée (< 14 dates = historique complet transmis),
 *   - soit sa date la plus ancienne remonte au lundi ou avant.
 * Quand c'est faux, on n'affiche PAS de flèche : une flèche morte est pire
 * qu'une flèche absente.
 *
 * NOTE D'ARCHITECTURE : ce prédicat est de la lecture de données, pas de la
 * présentation. Sa place naturelle est `domain/coachView/week.ts` ; il vit ici
 * parce que ce lot ne possède pas ce fichier (voir le compte rendu).
 */
export function semaineLisible(views: CoachPlayerView[], lundi: string | null): boolean {
  if (!lundi) return false;
  return views.some((v) => {
    if (!v.assiduite) return false;
    if (v.datesSeancesFaites.length < ASSIDUITE_JOURS) return true;
    const plusAncienne = v.datesSeancesFaites[v.datesSeancesFaites.length - 1];
    return Boolean(plusAncienne) && plusAncienne <= lundi;
  });
}

/** Mot employé pour UN membre, selon le type d'équipe déclaré par le coach. */
function memberWordOf(teamGender: ClubTeamGender | null): string {
  if (teamGender === "female") return "joueuse";
  if (teamGender === "male") return "joueur";
  return "membre";
}

/** Libellés accordés des compteurs (le français n'accepte pas « joueuses actifs »). */
function memberMetricLabels(teamGender: ClubTeamGender | null) {
  if (teamGender === "female") {
    return { actifs: "Joueuses actives", sansSeance: "Joueuses sans séance" };
  }
  if (teamGender === "male") {
    return { actifs: "Joueurs actifs", sansSeance: "Joueurs sans séance" };
  }
  return { actifs: "Membres actifs", sansSeance: "Membres sans séance" };
}

export default function CoachWeekScreen() {
  const haptics = useHaptics();
  const club = useCoachClub();
  const roster = useCoachRoster(club.clubId);

  // Instant courant lu HORS RENDU et rafraîchi périodiquement. Il servait à deux
  // endroits sous forme de `Date.now()` en plein corps de rendu : le rendu n'était
  // pas idempotent, et surtout la ligne de fraîcheur restait figée sur sa valeur
  // de montage tant qu'aucun état ne bougeait (écran posé = "à l'instant" éternel).
  const nowMs = useCoachNowMs();

  // Semaine affichée : 0 = semaine en cours, -1 = précédente, etc. Le décalage
  // est remis à zéro dès que le club (ou la semaine courante) change, sinon on
  // resterait bloqué sur une semaine du club précédent.
  const [weekOffset, setWeekOffset] = useState(0);
  useEffect(() => {
    setWeekOffset(0);
  }, [club.clubId, club.weekKey]);

  const weekKey = useMemo(() => {
    if (weekOffset === 0) return club.weekKey;
    return addDaysToKey(club.weekKey, weekOffset * 7) ?? club.weekKey;
  }, [club.weekKey, weekOffset]);

  // Jour du coach. Recalculé à chaque LECTURE de données : une app laissée
  // ouverte toute la nuit ne doit pas continuer à raisonner sur la veille.
  const todayKey = useMemo(
    () => toDateKey(new Date(roster.fetchedAt ?? nowMs)),
    [roster.fetchedAt, nowMs],
  );

  const memberWord = memberWordOf(club.teamGender);
  const metricLabels = memberMetricLabels(club.teamGender);

  const digest = useMemo(
    () => buildWeekDigest(roster.views, weekKey, todayKey, { memberWord }),
    [roster.views, weekKey, todayKey, memberWord],
  );

  // ── Adaptations : DEUX faits qu'il ne faut jamais confondre ───────────────
  //  - « Séance ajustée par FKS » = le MOTEUR a allégé la prescription. Le
  //    joueur n'y est pour rien. (L'ancien libellé « Adaptée » laissait croire
  //    l'inverse au coach : c'est le piège produit majeur de cet écran.)
  //  - « Séance modifiée par le joueur » = le JOUEUR a adapté / sauté /
  //    remplacé des exercices. Ce bloc n'existe QUE si la boucle de suivi
  //    joueur alimente `execution` ; son absence est le cas nominal aujourd'hui.
  // Ces deux faits portent sur la DERNIÈRE séance connue de chacun, pas sur la
  // semaine affichée : on le dit, et on ne les montre pas sur une semaine passée.
  const adaptations = useMemo(() => {
    const libellesMoteur = new Set<string>();
    const raisons = new Set<string>();
    let ajustesMoteur = 0;
    let avecEcarts = 0;
    for (const v of roster.views) {
      if (v.ajustementsMoteur.length > 0) {
        ajustesMoteur += 1;
        v.ajustementsMoteur.forEach((label) => libellesMoteur.add(label));
      }
      const e = v.execution;
      if (e && (e.adapte ?? 0) + (e.saute ?? 0) + (e.remplace ?? 0) > 0) {
        avecEcarts += 1;
        // Libellés déjà allowlistés par le serveur : on les affiche tels quels,
        // on ne les re-traduit jamais et on ne déduit rien de leur absence.
        e.raisons.forEach((raison) => raisons.add(raison));
      }
    }
    return {
      ajustesMoteur,
      avecEcarts,
      libellesMoteur: [...libellesMoteur].slice(0, 3),
      raisons: [...raisons].slice(0, 3),
    };
  }, [roster.views]);

  // ── Cadre de la semaine (état local, hydraté depuis le contexte serveur) ───
  const [intensity, setIntensity] = useState<ClubTrainingIntensity | null>(null);
  const [weekGoal, setWeekGoal] = useState<ClubWeekGoal | null>(null);
  const [note, setNote] = useState("");
  const [matchThisWeekend, setMatchThisWeekend] = useState<boolean | null>(null);
  const [cadreSaved, setCadreSaved] = useState(false);
  const [cadreDirty, setCadreDirty] = useState(false);
  const [savingContext, setSavingContext] = useState(false);
  const [teamGender, setTeamGender] = useState<ClubTeamGender | null>(null);
  const [savingTeamGender, setSavingTeamGender] = useState(false);

  // Le composant peut être démonté pendant une écriture longue (hors ligne) :
  // on ne touche plus à l'état après coup.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Hydratation depuis le serveur. Une absence de contexte = REMISE À ZÉRO
  // explicite : sans ça, le cadre de la semaine passée resterait affiché après
  // un changement de semaine ou de club, et le coach croirait l'avoir renseigné.
  useEffect(() => {
    const wc = club.weekContext;
    if (wc) {
      setIntensity(wc.trainingIntensity);
      setWeekGoal(wc.weekGoal);
      setNote(wc.note ?? "");
      setMatchThisWeekend(typeof wc.matchThisWeekend === "boolean" ? wc.matchThisWeekend : null);
      setCadreSaved(true);
    } else {
      setIntensity(null);
      setWeekGoal(null);
      setNote("");
      setMatchThisWeekend(null);
      setCadreSaved(false);
    }
    setCadreDirty(false);
  }, [club.weekContext, club.clubId, club.weekKey]);

  useEffect(() => {
    setTeamGender(club.teamGender);
  }, [club.teamGender]);

  const onRefresh = useCallback(() => {
    club.refresh();
    roster.refresh();
  }, [club, roster]);

  // ── Type d'équipe : écriture immédiate, avec annulation visuelle si échec ──
  const handleSetTeamGender = useCallback(
    async (value: ClubTeamGender) => {
      if (!club.clubId || savingTeamGender) return;
      const previous = teamGender;
      haptics.impactLight();
      setTeamGender(value); // retour immédiat : le coach voit sa sélection
      setSavingTeamGender(true);
      try {
        await withTimeout(setClubTeamGender(club.clubId, value), COACH_SAVE_TIMEOUT_MS);
        if (!mountedRef.current) return;
        haptics.success();
      } catch (error) {
        if (!mountedRef.current) return;
        // On REMET la valeur d'avant : laisser la puce allumée ferait croire à
        // un enregistrement qui n'a pas été confirmé.
        setTeamGender(previous);
        haptics.error();
        const timedOut = error instanceof SaveTimeoutError;
        showToast({
          type: "error",
          title: timedOut ? "Enregistrement non confirmé" : "Enregistrement impossible",
          // Un délai dépassé ne dit PAS d'où vient le blocage (réseau, serveur,
          // droits) : on énonce le constat, l'action, puis une hypothèse au
          // conditionnel. « Vérifie ta connexion » affirmait une cause que l'app
          // n'a aucun moyen d'établir.
          message: timedOut
            ? "Pas de réponse de FKS. Réessaie ; si le problème persiste, ton accès au club devra peut-être être vérifié."
            : "Le type d'équipe n'a pas pu être enregistré.",
        });
      } finally {
        if (mountedRef.current) setSavingTeamGender(false);
      }
    },
    [club.clubId, haptics, savingTeamGender, teamGender],
  );

  // ── Cadre de la semaine : même métier qu'avant, attente bornée ─────────────
  const handleSaveContext = useCallback(async () => {
    const uid = auth.currentUser?.uid ?? null;
    if (!uid || !club.clubId || !intensity || !weekGoal) {
      showToast({
        type: "warn",
        title: "Champs manquants",
        message: "Choisis l'intensité et l'objectif.",
      });
      return;
    }
    setSavingContext(true);
    try {
      await withTimeout(
        saveClubWeekContext({
          clubId: club.clubId,
          weekKey: club.weekKey,
          uid,
          trainingIntensity: intensity,
          weekGoal,
          note,
          matchThisWeekend,
        }),
        COACH_SAVE_TIMEOUT_MS,
      );
      if (!mountedRef.current) return;
      setCadreSaved(true);
      setCadreDirty(false);
      haptics.success();
      showToast({
        type: "success",
        title: "Cadre enregistré",
        message: "Il s'applique aux prochaines séances générées cette semaine.",
      });
    } catch (error) {
      if (!mountedRef.current) return;
      // Aucun retour visuel « enregistré » : tant que FKS n'a pas confirmé, le
      // cadre reste annoncé comme non enregistré.
      setCadreSaved(false);
      setCadreDirty(true);
      haptics.error();
      const timedOut = error instanceof SaveTimeoutError;
      showToast({
        type: "error",
        title: timedOut ? "Enregistrement non confirmé" : "Enregistrement impossible",
        // Même règle que ci-dessus : le cadre n'est pas confirmé, c'est un FAIT ;
        // « une fois la connexion revenue » supposait une panne réseau qui n'est
        // qu'une hypothèse parmi d'autres.
        message: timedOut
          ? "Ton cadre n'est pas confirmé. Réessaie ; si le problème persiste, ton accès au club devra peut-être être vérifié."
          : "Le cadre de la semaine n'a pas pu être enregistré.",
      });
    } finally {
      if (mountedRef.current) setSavingContext(false);
    }
  }, [club.clubId, club.weekKey, intensity, weekGoal, note, matchThisWeekend, haptics]);

  const handleShareCode = useCallback(async () => {
    if (!club.inviteCode) return;
    haptics.impactLight();
    try {
      await Share.share({ message: `Rejoins notre club sur FKS avec le code : ${club.inviteCode}` });
    } catch {
      // Partage annulé par l'utilisateur : rien à signaler.
    }
  }, [club.inviteCode, haptics]);

  // ── États globaux de l'écran ──────────────────────────────────────────────
  // NOTE : l'accès légal (`CoachLegalFooter`) est répété dans CHAQUE branche, y
  // compris les branches d'échec. La suppression de compte doit rester joignable
  // même quand le club ne se lit pas — c'est une exigence des stores, pas un
  // confort de navigation, et un coach sans club est justement quelqu'un qui
  // peut vouloir supprimer son compte.
  if (club.status === "loading") {
    return (
      <CoachScreen testID="coach-week-screen">
        <View style={styles.page}>
          <CoachSkeleton variant="card" />
          <CoachSkeleton variant="card" />
          <CoachLegalFooter />
        </View>
      </CoachScreen>
    );
  }

  if (club.status === "notInClub") {
    return (
      <CoachScreen testID="coach-week-screen">
        <View style={styles.page}>
          <CoachStateBlock
            icon="people-circle-outline"
            title="Aucun club rattaché"
            body="Votre compte n'est rattaché à aucun club. Créez votre club, ou demandez à FKS de vous rattacher au vôtre : le suivi de la semaine s'affichera ensuite ici."
            level="unknown"
          />
          <CoachLegalFooter />
        </View>
      </CoachScreen>
    );
  }

  if (club.status === "error" && !club.clubId) {
    return (
      <CoachScreen testID="coach-week-screen">
        <View style={styles.page}>
          <CoachErrorState
            variant="network"
            subject="club"
            action={{ onPress: onRefresh, accessibilityHint: "Relance le chargement du club" }}
          />
          <CoachLegalFooter />
        </View>
      </CoachScreen>
    );
  }

  // ── En-tête : semaine affichée + navigation + fraîcheur ────────────────────
  const semainePrecedente = addDaysToKey(club.weekKey, (weekOffset - 1) * 7);
  const peutReculer = semaineLisible(roster.views, semainePrecedente);
  const peutAvancer = weekOffset < 0;
  const fraicheur = buildFreshness(roster.fetchedAt, nowMs);
  const source = provenanceTone("computed");

  const header = (
    <View style={styles.header}>
      <Text style={styles.kicker}>ESPACE COACH</Text>
      <Text style={styles.title} numberOfLines={1}>
        Semaine
      </Text>
      {club.clubName ? (
        <Text style={styles.clubName} numberOfLines={1}>
          {club.clubName}
        </Text>
      ) : null}

      <View style={styles.weekNav}>
        {peutReculer ? (
          <Pressable
            testID="week-prev"
            onPress={() => {
              haptics.impactLight();
              setWeekOffset((v) => v - 1);
            }}
            accessibilityRole="button"
            accessibilityLabel="Semaine précédente"
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
          >
            <Ionicons name="chevron-back" size={18} color={coachColors.accent} />
          </Pressable>
        ) : (
          // Aucune flèche morte : un simple espace garde le libellé centré.
          <View style={styles.navSpacer} />
        )}

        <Text style={styles.weekLabel} numberOfLines={2}>
          {formatCoachWeekLabel(weekKey)}
        </Text>

        {peutAvancer ? (
          <Pressable
            testID="week-next"
            onPress={() => {
              haptics.impactLight();
              setWeekOffset((v) => Math.min(0, v + 1));
            }}
            accessibilityRole="button"
            accessibilityLabel="Semaine suivante"
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
          >
            <Ionicons name="chevron-forward" size={18} color={coachColors.accent} />
          </Pressable>
        ) : (
          <View style={styles.navSpacer} />
        )}
      </View>

      <Text style={styles.freshness} numberOfLines={1}>
        {fraicheur.libelle}
        {roster.isStale ? " · dernière version connue" : ""}
      </Text>
    </View>
  );

  // ── Bloc 1 : « Ce qui s'est passé » ───────────────────────────────────────
  const donneesDispo = digest.membresAvecDonnees > 0;

  // Le sous-titre ne doit JAMAIS annoncer « 0 sur 0 » quand la lecture a échoué
  // ou n'est pas finie : ce serait un comptage inventé.
  const digestSubtitle =
    roster.status === "loading"
      ? "Lecture des données en cours"
      : roster.status === "unavailable"
        ? "Données non lues"
        : `Séances FKS terminées, du lundi au dimanche · ${digest.membresAvecDonnees} ${memberWord}${
            digest.membresAvecDonnees > 1 ? "s" : ""
          } suivi${digest.membresAvecDonnees > 1 ? "s" : ""} sur ${digest.membres}`;

  const renderDigestBody = () => {
    if (roster.status === "loading") {
      return <CoachSkeleton variant="card" testID="week-digest-loading" />;
    }
    if (roster.status === "unavailable") {
      return (
        <CoachErrorState
          variant="network"
          subject="effectif"
          action={{ onPress: onRefresh, accessibilityHint: "Relance la lecture de l'effectif" }}
          footnote={
            roster.fetchedAt ? `Dernière lecture réussie : ${fraicheur.libelle.toLowerCase()}` : null
          }
        />
      );
    }
    if (roster.memberCount === 0) {
      return (
        <CoachEmptyState
          variant="clubWithoutPlayers"
          action={club.inviteCode ? { onPress: handleShareCode } : null}
        />
      );
    }

    return (
      <View style={styles.digestBody}>
        <View style={styles.metricRow}>
          {/* La règle de comptage est ÉCRITE sous le chiffre. La projection ne
              transmet que des dates dédupliquées : deux séances faites le même
              jour n'y laissent qu'une trace. Sans cette précision, le coach lit
              un total qu'il ne peut pas expliquer — et qui sous-compte. */}
          <CoachMetric
            testID="metric-seances"
            label="Séances réalisées"
            value={donneesDispo ? digest.seancesFaites : null}
            icon="checkmark-done-outline"
            hint="Sur la semaine affichée · au plus une par jour et par joueur"
          />
          <CoachMetric
            testID="metric-actifs"
            label={metricLabels.actifs}
            value={donneesDispo ? digest.membresActifs : null}
            icon="walk-outline"
            hint="Au moins une séance"
          />
          <CoachMetric
            testID="metric-sans-seance"
            label={metricLabels.sansSeance}
            value={donneesDispo ? digest.membresSansSeance : null}
            icon="ellipse-outline"
            hint="Aucune séance cette semaine"
          />
        </View>

        {/* Les phrases viennent du domaine : descriptives, datées, jamais
            prédictives. On les affiche telles quelles, sans les reformuler. */}
        <View style={styles.phrases}>
          {digest.phrases.map((phrase) => (
            <View key={phrase} style={styles.phraseRow}>
              <View style={styles.phraseDot} />
              <Text style={styles.phrase} numberOfLines={3}>
                {phrase}
              </Text>
            </View>
          ))}
        </View>

        {/* Adaptations. Vocabulaire strictement séparé : « ajustée par FKS »
            pour le moteur, « modifiée par le joueur » pour l'exécution. */}
        {weekOffset === 0 && (adaptations.ajustesMoteur > 0 || adaptations.avecEcarts > 0) ? (
          <View style={styles.adaptations} testID="week-adaptations">
            {adaptations.ajustesMoteur > 0 ? (
              <CoachSignalRow
                testID="adaptation-moteur"
                level="normal"
                icon="shield-checkmark-outline"
                provenance="fks"
                title={`Séance ajustée par FKS — ${adaptations.ajustesMoteur} ${memberWord}${
                  adaptations.ajustesMoteur > 1 ? "s" : ""
                }`}
                why={
                  adaptations.libellesMoteur.length > 0
                    ? `FKS a allégé la séance prescrite (${adaptations.libellesMoteur.join(", ")}). Ce n'est pas une modification du joueur.`
                    : "FKS a allégé la séance prescrite. Ce n'est pas une modification du joueur."
                }
              />
            ) : null}

            {adaptations.avecEcarts > 0 ? (
              <CoachSignalRow
                testID="adaptation-joueur"
                level="watch"
                icon="swap-horizontal-outline"
                provenance="execution"
                title={`Séance modifiée par le joueur — ${adaptations.avecEcarts} ${memberWord}${
                  adaptations.avecEcarts > 1 ? "s" : ""
                }`}
                why={
                  adaptations.raisons.length > 0
                    ? `Des exercices ont été adaptés, sautés ou remplacés (${adaptations.raisons.join(", ")}).`
                    : "Des exercices ont été adaptés, sautés ou remplacés pendant la séance."
                }
              />
            ) : null}

            <Text style={[styles.statusWhy, styles.adaptationsWhy]} numberOfLines={2}>
              Sur la dernière séance connue de chacun, pas sur le bilan de la semaine.
            </Text>
          </View>
        ) : null}

        {/* Les statuts valent pour AUJOURD'HUI, pas pour la semaine affichée :
            on ne les montre donc que sur la semaine en cours, et on le dit. */}
        {weekOffset === 0 && (digest.aVerifier > 0 || digest.aSurveiller > 0) ? (
          <View style={styles.statusBlock}>
            <View style={styles.statusRow}>
              {digest.aVerifier > 0 ? (
                <CoachStatusPill
                  testID="pill-a-verifier"
                  level="check"
                  label={`${digest.aVerifier} à vérifier`}
                />
              ) : null}
              {digest.aSurveiller > 0 ? (
                <CoachStatusPill
                  testID="pill-a-surveiller"
                  level="watch"
                  label={`${digest.aSurveiller} à surveiller`}
                />
              ) : null}
            </View>
            <Text style={styles.statusWhy} numberOfLines={2}>
              Ces statuts décrivent la situation d'aujourd'hui, pas le bilan de la semaine.
            </Text>
          </View>
        ) : null}

        <View style={styles.sourceLine}>
          <Ionicons name={source.icone} size={12} color={coachColors.muted} />
          <Text style={styles.sourceText} numberOfLines={2}>
            {source.libelle} — à partir des séances FKS terminées. Aucune donnée de ressenti ni de
            santé n'est transmise au coach.
          </Text>
        </View>
      </View>
    );
  };

  // ── Bloc 2 : « Ton cadre de la semaine » ──────────────────────────────────
  const cadreSubtitle = club.weekContextUnavailable
    ? "Cadre illisible pour le moment"
    : cadreDirty
      ? "Modifications non enregistrées"
      : cadreSaved
        ? "Cadre enregistré pour cette semaine"
        : "Cadre non renseigné";

  const cadreEditable = weekOffset === 0;
  const saveDisabled = savingContext || !intensity || !weekGoal;

  const renderChip = (
    key: string,
    label: string,
    active: boolean,
    onPress: () => void,
    testID: string,
  ) => (
    <Pressable
      key={key}
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <CoachScreen
      testID="coach-week-screen"
      header={header}
      refreshControl={
        <RefreshControl
          refreshing={roster.isRefreshing || club.isRefreshing}
          onRefresh={onRefresh}
          tintColor={coachColors.accent}
        />
      }
    >
      <View style={styles.page}>
        <CoachSectionCard
          testID="week-digest"
          title="Ce qui s'est passé"
          subtitle={digestSubtitle}
        >
          {renderDigestBody()}
        </CoachSectionCard>

        <CoachSectionCard
          testID="week-frame"
          title="Ton cadre de la semaine"
          subtitle={cadreEditable ? cadreSubtitle : "Consultation d'une semaine passée"}
        >
          {!cadreEditable ? (
            <Text style={styles.explain} numberOfLines={3}>
              Le cadre ne se modifie que sur la semaine en cours. Reviens à la semaine actuelle pour
              le renseigner.
            </Text>
          ) : (
            <View style={styles.form}>
              <Text style={styles.explain} numberOfLines={3}>
                Ce cadre s'applique aux prochaines séances générées cette semaine. À réactualiser
                chaque semaine.
              </Text>

              {club.weekContextUnavailable ? (
                <Text style={styles.warnLine} numberOfLines={3}>
                  Le cadre déjà enregistré n'a pas pu être lu. Ce qui s'affiche ci-dessous est vide,
                  pas forcément ce qui est enregistré côté FKS.
                </Text>
              ) : null}

              <Text style={styles.fieldLabel}>Type d'équipe</Text>
              <View style={styles.chipRow}>
                {CLUB_TEAM_GENDERS.map((v) =>
                  renderChip(
                    v,
                    TEAM_GENDER_LABELS[v],
                    teamGender === v,
                    () => handleSetTeamGender(v),
                    `chip-team-${v}`,
                  ),
                )}
              </View>
              <Text style={styles.fieldHint} numberOfLines={2}>
                Attribut de l'équipe, enregistré immédiatement. Aucune donnée individuelle.
              </Text>

              <Text style={styles.fieldLabel}>Intensité club cette semaine</Text>
              <View style={styles.chipRow}>
                {OFFERED_INTENSITIES.map((v) =>
                  renderChip(
                    v,
                    INTENSITY_LABELS[v],
                    intensity === v,
                    () => {
                      haptics.impactLight();
                      setIntensity(v);
                      setCadreDirty(true);
                    },
                    `chip-intensity-${v}`,
                  ),
                )}
              </View>

              <Text style={styles.fieldLabel}>Objectif FKS</Text>
              <View style={styles.chipRow}>
                {OFFERED_WEEK_GOALS.map((v) =>
                  renderChip(
                    v,
                    GOAL_LABELS[v],
                    weekGoal === v,
                    () => {
                      haptics.impactLight();
                      setWeekGoal(v);
                      setCadreDirty(true);
                    },
                    `chip-goal-${v}`,
                  ),
                )}
              </View>

              <Text style={styles.fieldLabel}>Match ce week-end ?</Text>
              <View style={styles.chipRow}>
                {(
                  [
                    { value: true, label: "Oui", id: "oui" },
                    { value: false, label: "Non", id: "non" },
                  ] as const
                ).map(({ value, label, id }) =>
                  renderChip(
                    id,
                    label,
                    matchThisWeekend === value,
                    () => {
                      haptics.impactLight();
                      setMatchThisWeekend(value);
                      setCadreDirty(true);
                    },
                    `chip-match-${id}`,
                  ),
                )}
              </View>
              <Text style={styles.fieldHint} numberOfLines={2}>
                Info staff ajoutée au cadre.
              </Text>

              <Text style={styles.fieldLabel}>Note (optionnel)</Text>
              <TextInput
                testID="week-frame-note"
                style={styles.noteInput}
                placeholder="Ex : gros match dimanche, jambes lourdes"
                placeholderTextColor={coachColors.muted}
                value={note}
                onChangeText={(v) => {
                  setNote(v);
                  setCadreDirty(true);
                }}
                maxLength={NOTE_MAX}
                multiline
                accessibilityLabel="Note pour la semaine"
              />

              <Pressable
                testID="week-frame-save"
                onPress={handleSaveContext}
                disabled={saveDisabled}
                accessibilityRole="button"
                accessibilityState={{ disabled: saveDisabled, busy: savingContext }}
                style={({ pressed }) => [
                  styles.saveBtn,
                  saveDisabled && styles.saveBtnDisabled,
                  pressed && !saveDisabled && styles.saveBtnPressed,
                ]}
              >
                <Text style={styles.saveLabel} numberOfLines={1}>
                  {savingContext
                    ? "Enregistrement..."
                    : cadreSaved
                      ? "Mettre à jour le cadre"
                      : "Enregistrer le cadre de la semaine"}
                </Text>
              </Pressable>
              {saveDisabled && !savingContext ? (
                <Text style={styles.fieldHint} numberOfLines={2}>
                  Choisis une intensité et un objectif pour pouvoir enregistrer.
                </Text>
              ) : null}
            </View>
          )}
        </CoachSectionCard>

        <CoachSectionCard
          testID="week-invite"
          title="Code club"
          subtitle="À partager pour que tes joueurs rejoignent le club"
        >
          <View style={styles.inviteRow}>
            <Text style={styles.inviteCode} numberOfLines={1}>
              {club.inviteCode ?? "—"}
            </Text>
            <Pressable
              testID="week-invite-share"
              onPress={handleShareCode}
              disabled={!club.inviteCode}
              accessibilityRole="button"
              accessibilityLabel="Partager le code club"
              accessibilityState={{ disabled: !club.inviteCode }}
              style={({ pressed }) => [
                styles.shareBtn,
                !club.inviteCode && styles.shareBtnDisabled,
                pressed && club.inviteCode ? styles.shareBtnPressed : null,
              ]}
            >
              <Ionicons name="share-outline" size={16} color={coachColors.accent} />
              <Text style={styles.shareLabel} numberOfLines={1}>
                Partager
              </Text>
            </Pressable>
          </View>
          {!club.inviteCode ? (
            <Text style={styles.fieldHint} numberOfLines={2}>
              Aucun code d'invitation n'est disponible pour ce club.
            </Text>
          ) : null}
        </CoachSectionCard>

        {/* Mentions légales / confidentialité / suppression de compte. Ces accès
            vivaient dans le pied de page de l'ancien écran coach unique ; ils
            atterrissent ici, l'onglet « réglages de fait » de l'espace coach. */}
        <CoachLegalFooter />
      </View>
    </CoachScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: coachSpacing.md, padding: coachSpacing.md },

  // ── En-tête ──
  header: {
    paddingHorizontal: coachSpacing.md,
    paddingTop: coachSpacing.sm,
    paddingBottom: coachSpacing.sm,
    gap: 2,
  },
  kicker: {
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: coachColors.accent,
  },
  title: {
    fontSize: coachType.titreEcran.fontSize,
    lineHeight: coachType.titreEcran.lineHeight,
    fontWeight: coachType.titreEcran.fontWeight,
    letterSpacing: coachType.titreEcran.letterSpacing,
    color: coachColors.text,
  },
  clubName: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.xs,
    marginTop: coachSpacing.xs,
  },
  navBtn: {
    width: coachLayout.minTouchSize,
    minHeight: coachLayout.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: coachRadius.chip,
    borderWidth: 1,
    borderColor: coachColors.accentBorder,
    backgroundColor: coachColors.accentSoft,
  },
  navBtnPressed: { opacity: 0.7 },
  // Réserve la place d'une flèche pour que le libellé ne saute pas d'un bord à
  // l'autre quand la navigation devient (in)disponible.
  navSpacer: { width: coachLayout.minTouchSize, minHeight: coachLayout.minTouchSize },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: "700",
    color: coachColors.text,
  },
  freshness: {
    marginTop: coachSpacing.xxs,
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    color: coachColors.muted,
  },

  // ── Synthèse ──
  digestBody: { gap: coachSpacing.sm },
  metricRow: { flexDirection: "row", flexWrap: "wrap", gap: coachSpacing.xs },
  phrases: { gap: coachSpacing.xs },
  phraseRow: { flexDirection: "row", alignItems: "flex-start", gap: coachSpacing.xs },
  phraseDot: {
    width: 5,
    height: 5,
    borderRadius: coachRadius.pill,
    backgroundColor: coachColors.accentBorder,
    marginTop: 8,
  },
  phrase: {
    flex: 1,
    fontSize: coachType.corps.fontSize,
    lineHeight: coachType.corps.lineHeight,
    color: coachColors.text,
  },
  // `CoachSignalRow` porte son propre padding de carte : on annule celui du
  // corps pour que la ligne aille bord à bord, comme dans une liste.
  adaptations: {
    marginHorizontal: -coachSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: coachColors.borderSoft,
    paddingTop: coachSpacing.xxs,
  },
  adaptationsWhy: { paddingHorizontal: coachSpacing.md, paddingBottom: coachSpacing.xs },
  statusBlock: { gap: coachSpacing.xxs },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: coachSpacing.xs },
  statusWhy: {
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    color: coachColors.muted,
  },
  sourceLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: coachSpacing.xxs,
    marginTop: coachSpacing.xxs,
  },
  sourceText: {
    flex: 1,
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    color: coachColors.muted,
  },

  // ── Formulaire du cadre ──
  form: { gap: coachSpacing.xs },
  explain: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },
  warnLine: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.warn,
  },
  fieldLabel: {
    marginTop: coachSpacing.sm,
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: "700",
    color: coachColors.text,
  },
  fieldHint: {
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    color: coachColors.muted,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: coachSpacing.xs },
  chip: {
    // minHeight (jamais height) + 44 pt : cible tactile réelle, y compris quand
    // la taille de police système grandit.
    minHeight: coachLayout.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: coachSpacing.md,
    borderRadius: coachRadius.chip,
    borderWidth: 1,
    borderColor: coachColors.border,
    backgroundColor: coachColors.card,
  },
  chipActive: {
    borderColor: coachColors.accentBorder,
    backgroundColor: coachColors.accentSoft,
  },
  chipPressed: { opacity: 0.75 },
  chipText: {
    fontSize: coachType.corps.fontSize,
    lineHeight: coachType.corps.lineHeight,
    fontWeight: "600",
    color: coachColors.sub,
  },
  chipTextActive: { color: coachColors.accent, fontWeight: "700" },
  noteInput: {
    borderWidth: 1,
    borderColor: coachColors.border,
    borderRadius: coachRadius.chip,
    paddingHorizontal: coachSpacing.sm,
    paddingVertical: coachSpacing.xs + 2,
    fontSize: coachType.corps.fontSize,
    color: coachColors.text,
    backgroundColor: coachColors.card,
    minHeight: coachLayout.minTouchSize,
  },
  saveBtn: {
    marginTop: coachSpacing.sm,
    minHeight: coachLayout.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: coachSpacing.lg,
    borderRadius: coachRadius.chip,
    backgroundColor: coachColors.accent,
  },
  saveBtnPressed: { opacity: 0.85 },
  saveBtnDisabled: { backgroundColor: coachColors.neutralBorder },
  saveLabel: {
    color: "#FFFFFF",
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: "700",
    textAlign: "center",
  },

  // ── Code club ──
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.sm,
  },
  inviteCode: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: 2,
    color: coachColors.text,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.xxs + 2,
    minHeight: coachLayout.minTouchSize,
    paddingHorizontal: coachSpacing.md,
    borderRadius: coachRadius.chip,
    borderWidth: 1,
    borderColor: coachColors.accentBorder,
    backgroundColor: coachColors.accentSoft,
  },
  shareBtnPressed: { opacity: 0.75 },
  shareBtnDisabled: { opacity: 0.45 },
  shareLabel: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "700",
    color: coachColors.accent,
  },
});
