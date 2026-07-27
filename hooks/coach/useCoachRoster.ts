// hooks/coach/useCoachRoster.ts
//
// Chargement de l'EFFECTIF coach (projection coach-safe uniquement) et mise en
// forme via domain/coachView. Ce hook n'embarque AUCUNE règle métier : il lit,
// il garde la cohérence des états, il délègue le sens à `toCoachPlayerView`.
//
// TROIS DÉFAUTS D'ORIGINE CORRIGÉS ICI :
//  1. aucune protection anti-réponse tardive (le Home coach n'avait ni requestId
//     ni drapeau de montage, contrairement à la fiche joueuse) ;
//  2. aucune fraîcheur : chargement unique au montage → un coach qui laisse
//     l'app ouverte lit les données d'hier. On relit au FOCUS de l'écran ;
//  3. aucun anti-rebond : on ne relit pas si la dernière lecture a moins de 60 s
//     (un aller-retour vers la fiche joueuse ne doit pas rejouer N+1 requêtes).
//
// SANS HORLOGE SERVEUR : `todayKey` est calculé ICI avec l'horloge du coach au
// moment de la lecture, puis passé à domain/coachView. Le serveur ne projette
// que des faits à date absolue ; tout le relatif ("aujourd'hui", "cette semaine")
// se décide de ce côté-ci.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { fetchClubPlayerSummaries } from "../../repositories/clubsRepo";
import type { CoachPlayerSummary } from "../../domain/coachSummary";
import { toCoachPlayerViews } from "../../domain/coachView/fromSummary";
import type { CoachPlayerView } from "../../domain/coachView/types";
import { toDateKey } from "../../utils/dateHelpers";

/** Délai minimal entre deux lectures déclenchées par le focus de l'écran. */
export const ROSTER_MIN_REFETCH_INTERVAL_MS = 60_000;

export type CoachRosterStatus = "loading" | "ready" | "unavailable";

export type CoachRosterState = {
  /** Vues joueur prêtes à afficher, dans l'ordre renvoyé par le repository. */
  views: CoachPlayerView[];
  status: CoachRosterStatus;
  /** Projections lisibles (= views.length). */
  readyCount: number;
  /** Membres player dont la projection n'est pas encore produite par le serveur. */
  pendingCount: number;
  /** Membres player dont la LECTURE a échoué (à annoncer : "N profils non lus"). */
  unreadableCount: number;
  /** Effectif réel = prêts + en préparation + non lus. */
  memberCount: number;
  /** ms epoch de la dernière lecture RÉUSSIE, null tant qu'aucune n'a abouti. */
  fetchedAt: number | null;
  /** true si un refresh a échoué et qu'on affiche encore le contenu précédent. */
  isStale: boolean;
  isRefreshing: boolean;
  refresh: () => void;
};

export type UseCoachRosterOptions = {
  /** Horloge injectable (tests / horloge virtuelle dev). */
  now?: () => number;
  /** Anti-rebond du refetch au focus. Défaut : 60 s. */
  minRefetchIntervalMs?: number;
};

type RosterSnapshot = {
  summaries: CoachPlayerSummary[];
  pendingCount: number;
  unreadableCount: number;
  unavailable: boolean;
  fetchedAt: number | null;
  /** Jour du coach au moment de la lecture — fige la base de tous les calculs relatifs. */
  todayKey: string;
};

const EMPTY_SNAPSHOT: RosterSnapshot = {
  summaries: [],
  pendingCount: 0,
  unreadableCount: 0,
  unavailable: false,
  fetchedAt: null,
  todayKey: "",
};

export function useCoachRoster(
  clubId: string | null,
  options?: UseCoachRosterOptions,
): CoachRosterState {
  // Horloge et seuil stabilisés par ref (cf. useCoachClub) : un littéral passé par
  // l'appelant ne doit pas relancer l'effet de chargement à chaque rendu. Les refs
  // sont réécrites dans un effet, jamais pendant le rendu.
  const nowRef = useRef<() => number>(options?.now ?? Date.now);
  const minIntervalRef = useRef(options?.minRefetchIntervalMs ?? ROSTER_MIN_REFETCH_INTERVAL_MS);
  useEffect(() => {
    nowRef.current = options?.now ?? Date.now;
    minIntervalRef.current = options?.minRefetchIntervalMs ?? ROSTER_MIN_REFETCH_INTERVAL_MS;
  });
  const now = useCallback(() => nowRef.current(), []);

  const [snapshot, setSnapshot] = useState<RosterSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState<boolean>(() => Boolean(clubId));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);

  // ── Gardes de cohérence (motif éprouvé de CoachPlayerDetailScreen) ──────────
  // requestId monotone : chaque lecture capture SA valeur ; sa réponse n'est
  // appliquée que si elle est ENCORE la dernière émise (deux refresh concurrents
  // sur le MÊME club → seule la plus récente compte).
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  // Club actuellement demandé vs club reflété par le snapshot affiché.
  const currentClubRef = useRef<string | null>(clubId);
  const committedClubRef = useRef<string | null>(null);
  // Miroir synchrone du snapshot (lecture dans les closures sans le capturer).
  const snapshotRef = useRef<RosterSnapshot>(EMPTY_SNAPSHOT);
  // Horodatage de la dernière TENTATIVE (pas de la dernière réussite) : c'est lui
  // qui porte l'anti-rebond, sinon une suite d'échecs relancerait une rafale.
  const lastAttemptAtRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    currentClubRef.current = clubId;
  }, [clubId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * @param mode "initial" = premier chargement (spinner plein écran),
   *             "refresh" = pull-to-refresh (spinner de liste),
   *             "focus"   = relecture silencieuse au retour sur l'écran.
   */
  const runFetch = useCallback(
    async (mode: "initial" | "refresh" | "focus") => {
      if (!clubId) return;
      const key = clubId;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      lastAttemptAtRef.current = now();
      inFlightRef.current = true;
      const todayKey = toDateKey(new Date(now()));

      let res: Awaited<ReturnType<typeof fetchClubPlayerSummaries>>;
      try {
        res = await fetchClubPlayerSummaries(key, { now });
      } catch {
        // Le repository ne jette pas (il encapsule ses erreurs) ; ce filet couvre
        // un imprévu et le traite comme une indisponibilité globale honnête.
        res = {
          summaries: [],
          pendingCount: 0,
          unreadableCount: 0,
          unavailable: true,
          fetchedAt: now(),
        };
      } finally {
        inFlightRef.current = false;
      }

      // Réponse acceptée UNIQUEMENT si : montée + dernier requestId + club inchangé.
      // Sinon on sort SANS toucher au moindre état (réponse tardive ignorée).
      if (
        !mountedRef.current ||
        requestId !== requestIdRef.current ||
        currentClubRef.current !== key
      ) {
        return;
      }

      const prev = snapshotRef.current;
      const isSilentReload = mode !== "initial";
      // Refresh raté alors qu'on affiche déjà un effectif lisible du MÊME club →
      // on garde le contenu (pas d'écran qui se vide sous les yeux du coach).
      const keepPrevious =
        isSilentReload &&
        res.unavailable &&
        prev.summaries.length > 0 &&
        committedClubRef.current === key;

      if (keepPrevious) {
        setIsStale(true);
      } else {
        const next: RosterSnapshot = {
          summaries: res.summaries,
          pendingCount: res.pendingCount,
          unreadableCount: res.unreadableCount,
          unavailable: res.unavailable,
          // fetchedAt ne bouge QUE sur une lecture aboutie : c'est un indicateur
          // de fraîcheur des données, pas de la dernière tentative.
          fetchedAt: res.unavailable ? prev.fetchedAt : res.fetchedAt,
          todayKey,
        };
        snapshotRef.current = next;
        committedClubRef.current = key;
        setSnapshot(next);
        setIsStale(false);
      }

      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setIsRefreshing(false);
    },
    [clubId, now],
  );

  // Premier chargement / changement de club : on repart d'un état vierge pour ne
  // jamais afficher l'effectif d'un club précédent.
  useEffect(() => {
    if (!clubId) {
      snapshotRef.current = EMPTY_SNAPSHOT;
      committedClubRef.current = null;
      lastAttemptAtRef.current = null;
      setSnapshot(EMPTY_SNAPSHOT);
      setIsStale(false);
      setLoading(false);
      return;
    }
    if (committedClubRef.current !== clubId) {
      snapshotRef.current = EMPTY_SNAPSHOT;
      setSnapshot(EMPTY_SNAPSHOT);
      setIsStale(false);
      setLoading(true);
    }
    lastAttemptAtRef.current = null;
    runFetch("initial");
    return () => {
      // Changement de club / démontage : invalide toute réponse en vol.
      requestIdRef.current += 1;
    };
  }, [clubId, runFetch]);

  // Fraîcheur : on relit au retour sur l'écran, mais pas plus d'une fois par
  // minute et jamais pendant une lecture déjà en vol. Déclaré APRÈS l'effet de
  // chargement initial : au montage, `lastAttemptAtRef` est déjà posé par
  // celui-ci, donc le focus ne double pas la requête.
  useFocusEffect(
    useCallback(() => {
      if (!clubId || inFlightRef.current) return;
      const last = lastAttemptAtRef.current;
      if (last !== null && now() - last < minIntervalRef.current) return;
      runFetch("focus");
    }, [clubId, now, runFetch]),
  );

  const refresh = useCallback(() => {
    if (!clubId || loading || isRefreshing || inFlightRef.current) return;
    setIsRefreshing(true);
    runFetch("refresh");
  }, [clubId, loading, isRefreshing, runFetch]);

  // Mise en forme déléguée au domaine : le hook ne décide ni d'un niveau, ni d'un
  // signal, ni d'un tri. `todayKey` fige l'horloge utilisée par le calcul.
  const views = useMemo(
    () => toCoachPlayerViews(snapshot.summaries, snapshot.todayKey),
    [snapshot],
  );

  const status: CoachRosterStatus = loading
    ? "loading"
    : snapshot.unavailable
      ? "unavailable"
      : "ready";

  return {
    views,
    status,
    readyCount: views.length,
    pendingCount: snapshot.pendingCount,
    unreadableCount: snapshot.unreadableCount,
    memberCount: views.length + snapshot.pendingCount + snapshot.unreadableCount,
    fetchedAt: snapshot.fetchedAt,
    isStale,
    isRefreshing,
    refresh,
  };
}
