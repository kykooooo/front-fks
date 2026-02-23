// hooks/coach/useCoachPlayersData.ts
// Hook pour récupérer les données enrichies des joueurs pour le coach

import { useEffect, useState, useMemo } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { db, auth } from "../../services/firebase";
import { differenceInDays } from "date-fns";
import type { PlayerCalendarData } from "../../components/coach/CoachTeamCalendar";
import type { PlayerAlert, AlertType } from "../../components/coach/CoachPlayerAlerts";
import { toDateKey } from "../../utils/dateHelpers";

export type EnrichedPlayer = {
  uid: string;
  firstName: string;
  position?: string | null;
  level?: string | null;
  microcycleGoal?: string | null;
  microcycleSessionIndex?: number | null;
  lastSessionDate?: string | null;
  matchDays: string[];
  clubTrainingDays: string[];
  tsb: number;
  atl: number;
  ctl: number;
  sessions: { dateISO: string; completed: boolean }[];
  injuries: { area: string; severity: number; dateISO: string }[];
};

type UseCoachPlayersDataReturn = {
  players: EnrichedPlayer[];
  calendarData: PlayerCalendarData[];
  alerts: PlayerAlert[];
  loading: boolean;
  error: string | null;
};

// Thresholds for alerts (same as player advice rules)
const TSB_OVERLOAD_THRESHOLD = -20;
const INACTIVE_DAYS_THRESHOLD = 5;
const DOW_KEYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

const toSafeDate = (value?: string | null) => {
  const key = toDateKey(value);
  if (!key) return null;
  const date = new Date(`${key}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeDowList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((day) => String(day ?? "").toLowerCase())
    .filter((day) => DOW_KEYS.has(day));
};

export function useCoachPlayersData(clubId: string | null): UseCoachPlayersDataReturn {
  const [players, setPlayers] = useState<EnrichedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const uid = auth.currentUser?.uid ?? null;

  useEffect(() => {
    if (!clubId) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    let isAlive = true;
    setLoading(true);
    setError(null);

    const membersQuery = query(
      collection(db, "clubs", clubId, "members"),
      where("role", "==", "player")
    );

    const unsubscribe = onSnapshot(
      membersQuery,
      async (snap) => {
        try {
          const playerUids = snap.docs
            .map((d) => String(d.id))
            .filter(Boolean)
            .filter((id) => id !== uid);

          // Fetch enriched data for each player
          const enrichedPlayers = await Promise.all(
            playerUids.map(async (playerId) => {
              try {
                // Get user profile
                const userDoc = await getDoc(doc(db, "users", playerId));
                const userData = userDoc.exists() ? (userDoc.data() as any) : {};

                // Get recent sessions (last 30 days)
                const sessionsRef = collection(db, "users", playerId, "sessions");
                const sessionsQuery = query(sessionsRef, orderBy("date", "desc"), limit(30));
                const sessionsSnap = await getDocs(sessionsQuery);
                const sessions = sessionsSnap.docs
                  .map((d: any) => {
                    const data = d.data();
                    const dateISO = toDateKey(data?.date ?? data?.dateISO ?? null);
                    if (!dateISO) return null;
                    return {
                      dateISO,
                      completed: data?.completed ?? true,
                    };
                  })
                  .filter(Boolean) as { dateISO: string; completed: boolean }[];

                // Get planned sessions
                const plannedRef = collection(db, "users", playerId, "plannedSessions");
                const plannedQuery = query(plannedRef, orderBy("date", "desc"), limit(10));
                const plannedSnap = await getDocs(plannedQuery);
                const plannedSessions = plannedSnap.docs
                  .map((d: any) => {
                    const data = d.data();
                    const dateISO = toDateKey(data?.date ?? data?.dateISO ?? null);
                    if (!dateISO) return null;
                    return {
                      dateISO,
                      completed: false,
                    };
                  })
                  .filter(Boolean) as { dateISO: string; completed: boolean }[];

                const mergedSessions = [...sessions, ...plannedSessions]
                  .sort((a, b) => b.dateISO.localeCompare(a.dateISO));

                // Parse injuries from dayStates
                const injuries: { area: string; severity: number; dateISO: string }[] = [];
                const dayStates = userData?.dayStates ?? {};
                for (const [dateKey, state] of Object.entries(dayStates)) {
                  const injury = (state as any)?.feedback?.injury;
                  const normalizedDay = toDateKey(dateKey);
                  const severity = Number(injury?.severity ?? 0);
                  if (normalizedDay && severity > 0) {
                    injuries.push({
                      area: injury.area ?? "non précisé",
                      severity,
                      dateISO: normalizedDay,
                    });
                  }
                }

                const player: EnrichedPlayer = {
                  uid: playerId,
                  firstName: userData?.firstName ?? "Joueur",
                  position: userData?.position ?? undefined,
                  level: userData?.level ?? undefined,
                  microcycleGoal: userData?.microcycleGoal ?? undefined,
                  microcycleSessionIndex: userData?.microcycleSessionIndex ?? undefined,
                  lastSessionDate: toDateKey(userData?.lastSessionDate) || mergedSessions[0]?.dateISO || undefined,
                  matchDays: normalizeDowList(userData?.matchDays),
                  clubTrainingDays: normalizeDowList(userData?.clubTrainingDays),
                  tsb: userData?.tsb ?? 0,
                  atl: userData?.atl ?? 0,
                  ctl: userData?.ctl ?? 0,
                  sessions: mergedSessions,
                  injuries,
                };
                return player;
              } catch {
                return null;
              }
            })
          );

          if (!isAlive) return;
          const validPlayers = enrichedPlayers.filter((p): p is EnrichedPlayer => p !== null);
          setPlayers(validPlayers);
          setLoading(false);
        } catch (e: any) {
          if (!isAlive) return;
          setError(e?.code === "permission-denied" ? "Accès refusé" : "Erreur de chargement");
          setLoading(false);
        }
      },
      (err: any) => {
        if (!isAlive) return;
        setError(err?.code === "permission-denied" ? "Accès refusé" : "Erreur de chargement");
        setLoading(false);
      }
    );

    return () => {
      isAlive = false;
      unsubscribe();
    };
  }, [clubId, uid]);

  // Transform to calendar data
  const calendarData: PlayerCalendarData[] = useMemo(() => {
    return players.map((p) => ({
      uid: p.uid,
      firstName: p.firstName,
      matchDays: p.matchDays,
      clubTrainingDays: p.clubTrainingDays,
      sessions: p.sessions,
      lastSessionDate: p.lastSessionDate,
    }));
  }, [players]);

  // Generate alerts
  const alerts: PlayerAlert[] = useMemo(() => {
    const now = new Date();
    const result: PlayerAlert[] = [];

    for (const player of players) {
      // Check for overload (TSB too low)
      if (player.tsb <= TSB_OVERLOAD_THRESHOLD) {
        result.push({
          uid: player.uid,
          firstName: player.firstName,
          type: "overload",
          message: `TSB à ${Math.round(player.tsb)} — charge très élevée, conseille du repos.`,
          value: player.tsb,
        });
      }

      // Check for inactivity
      if (player.lastSessionDate) {
        const lastDate = toSafeDate(player.lastSessionDate);
        const daysSince = lastDate ? differenceInDays(now, lastDate) : Number.POSITIVE_INFINITY;
        if (daysSince >= INACTIVE_DAYS_THRESHOLD) {
          result.push({
            uid: player.uid,
            firstName: player.firstName,
            type: "inactive",
            message: `Aucune séance depuis ${daysSince} jours.`,
            value: daysSince,
          });
        }
      } else {
        // No sessions at all
        result.push({
          uid: player.uid,
          firstName: player.firstName,
          type: "inactive",
          message: "Aucune séance enregistrée.",
        });
      }

      // Check for recent injuries (last 7 days)
      const recentInjuries = player.injuries.filter((inj) => {
        const injDate = toSafeDate(inj.dateISO);
        return injDate ? differenceInDays(now, injDate) <= 7 : false;
      }).sort((a, b) => b.dateISO.localeCompare(a.dateISO));
      if (recentInjuries.length > 0) {
        const latestInjury = recentInjuries[0];
        result.push({
          uid: player.uid,
          firstName: player.firstName,
          type: "injury",
          message: `Douleur signalée : ${latestInjury.area} (sévérité ${latestInjury.severity}/5).`,
          value: latestInjury.area,
        });
      }
    }

    // Sort by severity: injury > overload > inactive
    const typePriority: Record<AlertType, number> = { injury: 0, overload: 1, inactive: 2 };
    result.sort((a, b) => typePriority[a.type] - typePriority[b.type]);

    return result;
  }, [players]);

  return { players, calendarData, alerts, loading, error };
}
