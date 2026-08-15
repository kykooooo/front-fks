// utils/sessionHelpers.ts
// Helpers pour éviter la duplication de code lié aux sessions

import type { Session } from '../domain/types';
import { toDateKey, isWithinFeedbackWindow } from './dateHelpers';

/**
 * Obtenir la date d'une session de manière cohérente
 * Gère le cas où dateISO ou date peuvent être utilisés
 */
export function getSessionDate(session: Session | any): string {
  return session.dateISO ?? session.date ?? '';
}

/**
 * Obtenir le dayKey d'une session
 */
export function getSessionDayKey(session: Session | any): string {
  const date = getSessionDate(session);
  return date ? toDateKey(date) : '';
}

/**
 * Vérifier si une session a été complétée
 */
export function isSessionCompleted(session: Session | any): boolean {
  return Boolean(session?.completed || session?.feedback);
}

/**
 * Obtenir le RPE d'une session (depuis feedback ou legacy)
 */
export function getSessionRPE(session: Session | any): number | null {
  return session?.feedback?.rpe ?? session?.rpe ?? null;
}

/**
 * Obtenir la durée d'une session (depuis feedback ou propriété directe)
 */
export function getSessionDuration(session: Session | any): number | null {
  return session?.feedback?.durationMin ?? session?.durationMin ?? null;
}

/**
 * Filtrer les sessions complétées
 */
export function getCompletedSessions(sessions: Session[]): Session[] {
  return sessions.filter(isSessionCompleted);
}

/**
 * Filtrer les sessions non complétées
 */
export function getPendingSessions(sessions: Session[]): Session[] {
  return sessions.filter(s => !isSessionCompleted(s));
}

/**
 * Marqueurs de l'ancienne "séance de secours" fabriquée côté app (supprimée le
 * 27/07/2026). Elle n'a jamais été prescrite par le moteur : ni matériel, ni
 * douleurs, ni cycle du joueur n'étaient pris en compte.
 *
 * SEUL ENDROIT du code de production où ces marqueurs ont le droit d'exister :
 * ici, pour RECONNAÎTRE et REFUSER ces séances, jamais pour en créer.
 * Vérifié par screens/newSession/__tests__/aucuneSeanceDeSecours.test.ts.
 */
const PREFIXE_ID_ARTIFICIEL = 'fallback_';
const GARDE_FOU_ARTIFICIEL = 'fallback_safe';

function lireGardeFous(source: unknown): string[] {
  if (!source || typeof source !== 'object') return [];
  const objet = source as Record<string, unknown>;
  const brut = objet.guardrailsApplied ?? objet.guardrails_applied;
  return Array.isArray(brut) ? brut.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Une séance "artificielle" est une séance que personne n'a prescrite : elle
 * vient de l'ancienne fabrique locale de séance de secours.
 *
 * On ne l'efface pas (l'historique déjà persisté reste lisible), mais elle ne
 * doit JAMAIS être rouverte, ni comptée comme la séance du jour, ni relancée.
 */
export function estSeanceArtificielle(session: Session | any): boolean {
  if (!session || typeof session !== 'object') return false;

  const id = typeof session.id === 'string' ? session.id : '';
  if (id.startsWith(PREFIXE_ID_ARTIFICIEL)) return true;

  const gardeFous = [...lireGardeFous(session), ...lireGardeFous(session.aiV2)];
  return gardeFous.includes(GARDE_FOU_ARTIFICIEL);
}

/**
 * Séance "en attente" = non complétée ET dans la fenêtre de validation
 * (aujourd'hui, J-1, J-2, demain — voir isWithinFeedbackWindow).
 * Une séance non complétée hors fenêtre est une "zombie" : elle est ignorée
 * ici pour ne jamais bloquer la génération ni le CTA du Home.
 * Les séances artificielles (ancienne séance de secours) sont écartées de la
 * même façon : une panne passée ne doit pas devenir la séance du jour.
 * Les séances déclarées « non faites » (notDone) aussi : le joueur a répondu,
 * elles ne doivent plus bloquer ni le CTA ni la génération (décision 15/08).
 * Utilisé par usePrimaryCta, NewSessionScreen et SessionHubScreen.
 */
export function selectPendingSession(
  sessions: Session[],
  todayKey: string
): Session | undefined {
  return [...sessions]
    .filter((s) => !s.completed)
    .filter((s) => !s.notDone)
    .filter((s) => !estSeanceArtificielle(s))
    .filter((s) => isWithinFeedbackWindow(getSessionDate(s), todayKey))
    .sort((a, b) => {
      const da = getSessionDayKey(a);
      const db = getSessionDayKey(b);
      if (da === db) {
        const ca = new Date(a.createdAt ?? 0).getTime();
        const cb = new Date(b.createdAt ?? 0).getTime();
        return ca - cb;
      }
      return da.localeCompare(db);
    })[0];
}

/**
 * Trier les sessions par date (plus récent en premier)
 */
export function sortSessionsByDate(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    const dateA = getSessionDate(a);
    const dateB = getSessionDate(b);
    return dateB.localeCompare(dateA);
  });
}

/**
 * Obtenir la session la plus récente
 */
export function getLatestSession(sessions: Session[]): Session | null {
  if (sessions.length === 0) return null;
  const sorted = sortSessionsByDate(sessions);
  return sorted[0] || null;
}

/**
 * Obtenir les sessions d'une date spécifique
 */
export function getSessionsByDate(sessions: Session[], dateISO: string): Session[] {
  const targetDayKey = toDateKey(dateISO);
  return sessions.filter(s => getSessionDayKey(s) === targetDayKey);
}

/**
 * Vérifier si une session est datée d'aujourd'hui
 */
export function isSessionToday(session: Session | any, devNowISO?: string | null): boolean {
  const sessionDate = getSessionDate(session);
  const today = devNowISO ?? new Date().toISOString();
  return toDateKey(sessionDate) === toDateKey(today);
}

/**
 * Calculer le nombre de sessions dans une période
 */
export function countSessionsInPeriod(
  sessions: Session[],
  startDate: string,
  endDate: string
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return sessions.filter(session => {
    const sessionDate = new Date(getSessionDate(session));
    return sessionDate >= start && sessionDate <= end;
  }).length;
}

/**
 * Obtenir le nombre de sessions complétées
 */
export function getCompletedSessionsCount(sessions: Session[]): number {
  return getCompletedSessions(sessions).length;
}
