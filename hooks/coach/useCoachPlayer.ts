// hooks/coach/useCoachPlayer.ts
//
// Lecture d'UN joueur de la projection coach-safe
// (clubs/{clubId}/playerSummaries/{playerUid}), remontée depuis
// CoachPlayerDetailScreen pour être testable et réutilisable.
//
// La logique de garde et de conservation du contenu était déjà correcte dans
// l'écran : elle est reprise TELLE QUELLE (mêmes helpers purs de
// domain/coachSummary), sans changer un seul comportement —
//  - réponse tardive ou route changée → aucun état touché ;
//  - refresh raté avec un résumé encore aligné sur la route → on GARDE le contenu
//    et on le signale (`staleRefreshCount`) au lieu de vider la fiche.
//
// Le toast reste à l'écran : un hook de données ne parle pas à l'utilisateur.
// Il expose un compteur d'événements, l'écran décide de l'affichage.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { fetchClubPlayerSummary } from "../../repositories/clubsRepo";
import {
  nextCoachDetailView,
  shouldApplyCoachDetailResponse,
  EMPTY_COACH_DETAIL_VIEW,
  type CoachDetailView,
  type CoachPlayerSummary,
} from "../../domain/coachSummary";
import { toCoachPlayerView } from "../../domain/coachView/fromSummary";
import type { CoachPlayerView } from "../../domain/coachView/types";
import { toDateKey } from "../../utils/dateHelpers";

/** Même anti-rebond que l'effectif : une relecture au focus par minute au plus. */
export const PLAYER_MIN_REFETCH_INTERVAL_MS = 60_000;

/**
 * `restricted` = le SERVEUR n'autorise pas l'accès au suivi de ce joueur.
 * TROIS états bien distincts, jamais confondus :
 *   restricted  → décision serveur (rien ne sera lu, et c'est normal) ;
 *   notFound    → projection pas encore préparée (elle arrivera d'elle-même) ;
 *   unavailable → la lecture a échoué (droits inattendus, réseau).
 */
export type CoachPlayerStatus =
  | "loading"
  | "ready"
  | "restricted"
  | "unavailable"
  | "notFound";

export type CoachPlayerState = {
  /** Résumé brut (projection bornée), pour les écrans qui en ont besoin tel quel. */
  summary: CoachPlayerSummary | null;
  /** Vue mise en forme par domain/coachView (niveau, signaux, libellés). */
  view: CoachPlayerView | null;
  status: CoachPlayerStatus;
  /** ms epoch de la dernière lecture RÉUSSIE, null tant qu'aucune n'a abouti. */
  fetchedAt: number | null;
  /**
   * Incrémenté à CHAQUE refresh raté dont on a conservé le contenu précédent.
   * L'écran s'en sert pour un toast non bloquant ("Dernières données affichées").
   */
  staleRefreshCount: number;
  isRefreshing: boolean;
  refresh: () => void;
};

export type UseCoachPlayerOptions = {
  now?: () => number;
  minRefetchIntervalMs?: number;
};

export function useCoachPlayer(
  clubId: string | null,
  playerUid: string | null,
  options?: UseCoachPlayerOptions,
): CoachPlayerState {
  // Horloge et seuil stabilisés par ref (cf. useCoachClub / useCoachRoster),
  // réécrits dans un effet et jamais pendant le rendu.
  const nowRef = useRef<() => number>(options?.now ?? Date.now);
  const minIntervalRef = useRef(options?.minRefetchIntervalMs ?? PLAYER_MIN_REFETCH_INTERVAL_MS);
  useEffect(() => {
    nowRef.current = options?.now ?? Date.now;
    minIntervalRef.current = options?.minRefetchIntervalMs ?? PLAYER_MIN_REFETCH_INTERVAL_MS;
  });
  const now = useCallback(() => nowRef.current(), []);

  const [view, setView] = useState<CoachDetailView>(EMPTY_COACH_DETAIL_VIEW);
  // `loading` démarre à true seulement s'il y a une route à charger.
  const [loading, setLoading] = useState<boolean>(() => Boolean(clubId && playerUid));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [staleRefreshCount, setStaleRefreshCount] = useState(0);
  // Jour du coach au moment de la dernière lecture appliquée : base de tous les
  // calculs relatifs faits par domain/coachView (le serveur, lui, n'a pas d'horloge).
  const [todayKey, setTodayKey] = useState<string>("");

  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const currentRouteKeyRef = useRef<string | null>(null);
  const committedKeyRef = useRef<string | null>(null);
  const viewRef = useRef<CoachDetailView>(EMPTY_COACH_DETAIL_VIEW);
  const lastAttemptAtRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  // Clé de route tenue à jour AVANT le déclenchement des fetchs
  // ("/" est interdit dans un doc-id/UID → pas de collision possible).
  useEffect(() => {
    currentRouteKeyRef.current = clubId && playerUid ? `${clubId}/${playerUid}` : null;
  }, [clubId, playerUid]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runFetch = useCallback(
    async (mode: "initial" | "refresh" | "focus") => {
      if (!clubId || !playerUid) return;
      const key = `${clubId}/${playerUid}`;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      lastAttemptAtRef.current = now();
      inFlightRef.current = true;
      const readTodayKey = toDateKey(new Date(now()));
      const readAt = now();

      let incoming: CoachDetailView;
      try {
        // JAMAIS de fallback : on ne lit QUE la projection coach-safe.
        incoming = await fetchClubPlayerSummary(clubId, playerUid);
      } catch {
        incoming = { summary: null, unavailable: true, restricted: false };
      } finally {
        inFlightRef.current = false;
      }

      // Réponse acceptée UNIQUEMENT si : montée + dernier requestId + route inchangée.
      if (
        !shouldApplyCoachDetailResponse({
          mounted: mountedRef.current,
          requestId,
          latestRequestId: requestIdRef.current,
          requestKey: key,
          currentKey: currentRouteKeyRef.current,
        })
      ) {
        return;
      }

      const { view: nextView, keptStale } = nextCoachDetailView(viewRef.current, incoming, {
        // Un rechargement au focus est aussi peu destructeur qu'un pull-to-refresh :
        // il ne doit jamais faire disparaître une fiche déjà lisible.
        isRefresh: mode !== "initial",
        prevMatchesRoute: committedKeyRef.current === key,
      });
      viewRef.current = nextView;
      committedKeyRef.current = key;
      setView(nextView);
      // `fetchedAt` date la dernière lecture RÉUSSIE, pas la dernière tentative.
      // On se fie à `incoming` (le résultat réel de CETTE lecture), jamais à
      // `nextView` : sur un refresh raté conservé, `nextView` est l'ANCIEN
      // contenu — le dater de maintenant ferait passer des données périmées
      // pour fraîches, exactement le mensonge qu'on cherche à éviter.
      if (!incoming.unavailable) {
        setFetchedAt(readAt);
        setTodayKey(readTodayKey);
      }
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setIsRefreshing(false);
      if (keptStale) setStaleRefreshCount((n) => n + 1);
    },
    [clubId, playerUid, now],
  );

  useEffect(() => {
    lastAttemptAtRef.current = null;
    runFetch("initial");
    return () => {
      // Changement de route / démontage : invalide toute réponse en vol.
      requestIdRef.current += 1;
    };
  }, [runFetch]);

  // Fraîcheur au retour sur l'écran, anti-rebond identique à l'effectif.
  useFocusEffect(
    useCallback(() => {
      if (!clubId || !playerUid || inFlightRef.current) return;
      const last = lastAttemptAtRef.current;
      if (last !== null && now() - last < minIntervalRef.current) return;
      runFetch("focus");
    }, [clubId, playerUid, now, runFetch]),
  );

  const refresh = useCallback(() => {
    if (!clubId || !playerUid || loading || isRefreshing || inFlightRef.current) return;
    setIsRefreshing(true);
    runFetch("refresh");
  }, [clubId, playerUid, loading, isRefreshing, runFetch]);

  const summary = view.summary;
  const playerView = useMemo(
    () => (summary ? toCoachPlayerView(summary, todayKey) : null),
    [summary, todayKey],
  );

  // ORDRE VOLONTAIRE. `restricted` passe AVANT `notFound` : quand le serveur
  // n'autorise pas l'accès, il n'y a par construction aucune projection à lire —
  // annoncer "synchronisation en cours" serait une attente qui ne finira jamais.
  // Il passe APRÈS `unavailable` : si on n'a pas réussi à lire l'effectif, on ne
  // sait rien, et on ne prétend pas savoir.
  const status: CoachPlayerStatus = loading
    ? "loading"
    : view.unavailable
      ? "unavailable"
      : view.restricted === true
        ? "restricted"
        : summary
          ? "ready"
          : "notFound"; // projection absente / malformée / incohérente — pas une erreur de lecture

  return {
    summary,
    view: playerView,
    status,
    fetchedAt,
    staleRefreshCount,
    isRefreshing,
    refresh,
  };
}
