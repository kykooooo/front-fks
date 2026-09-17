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

export const trackEvent = (name: string, props?: Record<string, any>) => {
  if (!analyticsReady || !collecteActive) return;
  track(name, props);
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
