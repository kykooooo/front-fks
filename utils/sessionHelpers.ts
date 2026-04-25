// utils/sessionHelpers.ts
// Helpers pour éviter la duplication de code lié aux sessions

import type { Session } from '../domain/types';
import { toDateKey } from './dateHelpers';
import { isSessionCompleted as resolveSessionCompleted } from './sessionStatus';
import { shouldSurfaceAsPendingSession } from './sessionFallback';

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
  return resolveSessionCompleted(session);
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
  return sessions.filter((s) => shouldSurfaceAsPendingSession(s));
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
