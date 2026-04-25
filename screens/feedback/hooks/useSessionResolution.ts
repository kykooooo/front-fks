// screens/feedback/hooks/useSessionResolution.ts
import { useMemo } from 'react';
import { toDateKey } from '../../../utils/dateHelpers';
import type { Session } from '../../../domain/types';
import { isSessionCompleted } from '../../../utils/sessionStatus';
import { shouldSurfaceAsPendingSession } from '../../../utils/sessionFallback';

function getSessionDateKey(s: Session): { key: string; ts: number } {
  const iso = s.dateISO || s.date || '';
  const key = iso ? toDateKey(iso) : '';
  const d = key ? new Date(`${key}T12:00:00`) : null;
  const ts = d && Number.isFinite(d.getTime()) ? d.getTime() : 0;
  return { key, ts };
}

export function useSessionResolution(
  sessionIdFromRoute: string | undefined,
  sessions: Session[],
  todayKey: string,
  getSessionById: (id: string) => Session | undefined,
) {
  const targetSessionId = useMemo(() => {
    if (sessionIdFromRoute) return sessionIdFromRoute;
    if (!Array.isArray(sessions) || sessions.length === 0) return undefined;

    const today = todayKey;
    const open = sessions.filter(
      (s) => !isSessionCompleted(s) && shouldSurfaceAsPendingSession(s)
    );
    const openCurrent = open
      .map((s) => ({ s, meta: getSessionDateKey(s) }))
      .filter(({ meta }) => meta.ts > 0 && meta.key <= today)
      .sort((a, b) => b.meta.ts - a.meta.ts)
      .map(({ s }) => s);
    if (openCurrent.length) return openCurrent[0].id;

    const sortedOpen = [...open]
      .filter((s) => getSessionDateKey(s).ts > 0)
      .sort((a, b) => getSessionDateKey(b).ts - getSessionDateKey(a).ts);
    if (sortedOpen.length) return sortedOpen[0].id;

    const sortedAll = [...sessions]
      .filter((s) => getSessionDateKey(s).ts > 0)
      .sort((a, b) => getSessionDateKey(b).ts - getSessionDateKey(a).ts);
    return sortedAll[0]?.id;
  }, [sessionIdFromRoute, sessions, todayKey]);

  const targetSession = useMemo((): Session | undefined => {
    if (!targetSessionId) return undefined;
    return getSessionById(targetSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSessionId, getSessionById, sessions]);

  const sessionDateKey = useMemo(() => {
    if (!targetSession) return null;
    const { key } = getSessionDateKey(targetSession);
    return key || null;
  }, [targetSession]);

  return { targetSessionId, targetSession, sessionDateKey };
}
