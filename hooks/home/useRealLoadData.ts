// hooks/home/useRealLoadData.ts
// Prédicat UNIQUE du Home : « a-t-on des données réelles de charge ? »
// Réel = séance FKS terminée OU charge externe saisie à la main. Les charges
// auto-injectées (applyAutoExternalLoads, id préfixé "auto_") ne comptent pas :
// elles décrivent un calendrier déclaré, pas une activité confirmée.
// NB : on ne dérive PAS ce prédicat de dailyApplied — rebuildLoad/applyExternalLoad
// le remplissent aussi pour les jours de charges auto, ce qui rendrait un compte
// à 0 action (cases club cochées) faussement "avec données".
import { useMemo } from "react";
import { toDateKey } from "../../utils/dateHelpers";

/**
 * Seuil d'affichage de la courbe de tendance (H2) : en dessous de ce nombre de
 * jours d'activité RÉELS, on n'affiche pas de courbe (deux points font un
 * segment, pas une tendance). Valeur alignée sur la constante homonyme validée
 * du prototype VNext (screens/homeVNext/viewModel.ts).
 * Seuil d'affichage à valider par le fondateur.
 * Nuance : la série tsbHistory du store peut contenir des points de jours
 * auto-club (le CALCUL intègre ces charges, il ne bouge pas) — le gate compte
 * les jours réels, la série tracée reste celle du modèle.
 */
export const POINTS_MIN_POUR_COURBE = 3;

type SessionLike = {
  completed?: boolean;
  dateISO?: string;
  date?: string;
};

type ExternalLoadLike = {
  id?: unknown;
  dateISO?: string;
};

/**
 * Charge externe auto-injectée par applyAutoExternalLoads (profil club/match) :
 * id au format exact `auto_${source}_${dayKey}`. Le préfixe d'id est le SEUL
 * discriminant fiable (`source` peut aussi venir d'une saisie manuelle, et
 * `notes` est un texte libre) ; une saisie manuelle reçoit genId() qui ne peut
 * jamais commencer par "auto_".
 */
export const isAutoExternalLoad = (e: ExternalLoadLike | null | undefined): boolean =>
  typeof e?.id === "string" && e.id.startsWith("auto_");

/**
 * Nombre de jours (dateKeys distinctes) ayant AU MOINS une séance terminée
 * OU une charge externe NON auto. Fonction pure — partagée par le hook,
 * useContextualAdvice et les tests.
 */
export function countRealActivityDays(
  sessions: readonly SessionLike[] | null | undefined,
  externalLoads: readonly ExternalLoadLike[] | null | undefined
): number {
  const days = new Set<string>();
  (sessions ?? []).forEach((s) => {
    if (!s?.completed) return;
    const key = toDateKey(s.dateISO ?? s.date);
    if (key) days.add(key);
  });
  (externalLoads ?? []).forEach((e) => {
    if (isAutoExternalLoad(e)) return;
    const key = toDateKey(e?.dateISO);
    if (key) days.add(key);
  });
  return days.size;
}

export function useRealLoadData(
  sessions: readonly SessionLike[],
  externalLoads: readonly ExternalLoadLike[]
) {
  return useMemo(() => {
    const realActivityDayCount = countRealActivityDays(sessions, externalLoads);
    return {
      hasRealLoadData: realActivityDayCount > 0,
      realActivityDayCount,
    };
  }, [sessions, externalLoads]);
}
