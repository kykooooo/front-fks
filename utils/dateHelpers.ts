// utils/dateHelpers.ts
// Helpers pour les opérations sur les dates

import { toDayKey } from '../engine/dailyAggregation';
import { todayISO } from './virtualClock';

/**
 * Obtenir le dayKey pour aujourd'hui
 */
export function getTodayDayKey(devNowISO?: string | null): string {
  const now = devNowISO ?? todayISO();
  return toDayKey(now);
}

/**
 * Formater une date ISO en format lisible français
 * Ex: "2024-01-15" → "15 janvier 2024"
 */
export function formatDateFR(dateISO: string): string {
  const date = new Date(dateISO);
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  return date.toLocaleDateString('fr-FR', options);
}

/**
 * Formater une date ISO en format court
 * Ex: "2024-01-15" → "15/01/24"
 */
export function formatDateShort(dateISO: string): string {
  const date = new Date(dateISO);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

/**
 * Obtenir le jour de la semaine en français
 * Ex: "2024-01-15" → "Lundi"
 */
export function getDayOfWeekFR(dateISO: string): string {
  const date = new Date(dateISO);
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return days[date.getDay()];
}

/**
 * Vérifier si deux dates sont le même jour
 */
export function isSameDay(date1: string, date2: string): boolean {
  return toDayKey(date1) === toDayKey(date2);
}

/**
 * Obtenir la date d'il y a X jours
 */
export function getDaysAgo(days: number, referenceDate?: string): string {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const date = new Date(ref);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/**
 * Obtenir la date dans X jours
 */
export function getDaysFromNow(days: number, referenceDate?: string): string {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const date = new Date(ref);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Calculer le nombre de jours entre deux dates
 */
export function getDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Vérifier si une date est dans le passé
 */
export function isInPast(dateISO: string, referenceDate?: string): boolean {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const date = new Date(dateISO);
  return date < ref;
}

/**
 * Vérifier si une date est dans le futur
 */
export function isInFuture(dateISO: string, referenceDate?: string): boolean {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const date = new Date(dateISO);
  return date > ref;
}

/**
 * Obtenir le début de la semaine (lundi) pour une date donnée
 */
export function getWeekStart(dateISO: string): string {
  const date = new Date(dateISO);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Lundi = début de semaine
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday.toISOString();
}

/**
 * Obtenir la fin de la semaine (dimanche) pour une date donnée
 */
export function getWeekEnd(dateISO: string): string {
  const weekStart = getWeekStart(dateISO);
  return getDaysFromNow(6, weekStart);
}

/**
 * Obtenir toutes les dates de la semaine courante
 */
export function getCurrentWeekDates(referenceDate?: string): string[] {
  const ref = referenceDate ?? todayISO();
  const weekStart = getWeekStart(ref);
  const dates: string[] = [];

  for (let i = 0; i < 7; i++) {
    dates.push(getDaysFromNow(i, weekStart));
  }

  return dates;
}
