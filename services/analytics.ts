// services/analytics.ts
//
// LE SEUL POINT D'ENTRÉE VERS AMPLITUDE — et le seul endroit où la préférence
// « Statistiques d'utilisation » (Réglages) est traduite en collecte ou non.
//
// ─── CE QUE LA PRÉFÉRENCE FAIT VRAIMENT ─────────────────────────────────────
// `enabled: false` pose l'opt-out du SDK (`optOut` à l'init, `setOptOut`
// ensuite). En opt-out, le SDK n'envoie AUCUN événement : ni les événements
// manuels (`trackEvent`), ni les événements automatiques de session
// (`trackingSessionEvents`), ni l'identifiant utilisateur. On double cette
// garantie côté service : `trackEvent` et `setAnalyticsUserId` sortent avant
// même d'appeler le SDK quand la préférence est à OFF.
//
// ─── AVANT L'HYDRATATION DES PRÉFÉRENCES ────────────────────────────────────
// Rien ne part tant que `initAnalytics` n'a pas été appelé, et il ne l'est que
// par App.tsx APRÈS l'hydratation du store de réglages — avec la préférence
// restaurée en argument. Le SDK n'est donc jamais initialisé « par défaut » sur
// une préférence pas encore lue.
//
// ─── CE QU'ON NE PROMET PAS ─────────────────────────────────────────────────
// Ces données ne sont pas « anonymisées » : l'identifiant utilisateur Firebase
// est associé aux événements quand la collecte est active (cf. RootNavigator →
// setAnalyticsUserId). Le libellé des Réglages le dit tel quel.

import Constants from "expo-constants";
import { init, setOptOut, setUserId, track } from "@amplitude/analytics-react-native";

const apiKey = Constants.expoConfig?.extra?.AMPLITUDE_API_KEY ?? "";
let analyticsReady = false;
/** La préférence telle qu'elle a été appliquée au SDK. `false` tant que rien n'a été initialisé. */
let collecteActive = false;
/**
 * L'identité COURANTE (compte connecté, ou `null`), mémorisée même quand la
 * collecte est OFF. Elle n'est transmise au SDK que quand la collecte est ON :
 * à une réactivation, c'est le compte connecté À CE MOMENT-LÀ qui est associé —
 * jamais celui d'avant la coupure, jamais rien pendant la coupure.
 */
let identiteCourante: string | null = null;

export type AnalyticsInitOptions = {
  /** Préférence « Statistiques d'utilisation » RESTAURÉE (jamais une valeur par défaut). */
  enabled: boolean;
};

export const initAnalytics = (options: AnalyticsInitOptions) => {
  if (!apiKey || analyticsReady) return;
  collecteActive = options.enabled === true;
  // `optOut` posé DÈS l'init : les événements automatiques de session ne
  // partent pas non plus quand le joueur a dit non.
  // L'identité n'est passée que si la collecte est ON.
  init(apiKey, collecteActive ? identiteCourante ?? undefined : undefined, {
    trackingSessionEvents: true,
    optOut: !collecteActive,
  });
  analyticsReady = true;
};

/** Applique un changement de préférence sans réinitialiser le SDK. */
export const setAnalyticsEnabled = (enabled: boolean) => {
  collecteActive = enabled === true;
  if (!analyticsReady) return;
  setOptOut(!collecteActive);
  // OFF : plus aucune identité côté SDK. ON : l'identité courante — celle du
  // compte connecté maintenant — est (ré)associée explicitement.
  setUserId(collecteActive ? identiteCourante ?? undefined : undefined);
};

/** Ce que le service croit appliquer — pour les écrans et les tests, jamais une promesse au joueur. */
export const isAnalyticsEnabled = () => analyticsReady && collecteActive;

// ─── « JAMAIS TES DOULEURS » — LA PROMESSE EST TENUE ICI ────────────────────
// Le libellé des Réglages l'écrit au joueur ; la politique de confidentialité
// dit que douleur et fatigue ne sont lues que par FKS. Ce fichier étant le seul
// passage vers Amplitude, c'est ICI que la règle s'applique — pour tous les
// événements, ceux d'aujourd'hui et ceux qu'on écrira demain sans y penser.
//
// Quatre fuites existaient (2026-09) : la note de douleur et de fatigue du
// ressenti (`feedback_submitted`), la raison « douleur/fatigue » d'un exercice
// sauté ou adapté (`live_exercise_marked`), l'abandon de cycle pour « gêne
// physique » (`cycle_abandoned`), et la décision de suivi « pas d'augmentation
// pour cause de douleur » (`tracking_decision_shadow`).
//
// MÊME DOCTRINE QUE LA PROJECTION COACH (functions/src/coachLabels.ts) : rien ne
// doit être déductible par élimination.
//  - une CLÉ de santé est retirée ;
//  - une RAISON de santé devient "other", valeur qui existe déjà pour de vraies
//    raisons « autre » — impossible de distinguer les deux à l'arrivée ;
//  - toute autre propriété portant une valeur de santé (ex. `kind`) n'a pas de
//    « autre » légitime où se fondre : l'événement entier n'est pas envoyé.
const CLES_SANTE: ReadonlySet<string> = new Set(["pain", "fatigue"]);
const VALEURS_SANTE: ReadonlySet<string> = new Set(["pain", "fatigue", "injury", "block_increase_pain"]);
const RAISON_NEUTRE = "other";

/**
 * Les propriétés d'un événement TELLES QU'ELLES ONT LE DROIT de partir.
 * `null` = l'événement ne doit pas partir du tout.
 */
export const sansDonneesDeSante = (
  props?: Record<string, any>,
): Record<string, any> | undefined | null => {
  if (!props) return props;
  const propres: Record<string, any> = {};
  for (const [cle, valeur] of Object.entries(props)) {
    if (CLES_SANTE.has(cle)) continue;
    if (typeof valeur === "string" && VALEURS_SANTE.has(valeur)) {
      if (cle !== "reason") return null;
      propres[cle] = RAISON_NEUTRE;
      continue;
    }
    propres[cle] = valeur;
  }
  return propres;
};

export const trackEvent = (name: string, props?: Record<string, any>) => {
  if (!analyticsReady || !collecteActive) return;
  const propres = sansDonneesDeSante(props);
  if (propres === null) return;
  track(name, propres);
};

export const setAnalyticsUserId = (uid: string | null) => {
  // Toujours mémorisée (changement de compte pendant OFF compris) ; transmise
  // au SDK seulement si la collecte est ON.
  identiteCourante = uid;
  if (!analyticsReady || !collecteActive) return;
  setUserId(uid ?? undefined);
};

/** RÉSERVÉ AUX TESTS : remet le module dans son état d'avant `initAnalytics`. */
export const __resetAnalyticsForTests = () => {
  analyticsReady = false;
  collecteActive = false;
  identiteCourante = null;
};
