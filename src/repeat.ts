import { addDays, fromKey, keyOf, shortDate, todayKey } from './dates';
import type { Repeat } from './types';

/**
 * Répétition d'un événement. Les occurrences sont créées une par une dans
 * l'agenda du foyer (chacune se modifie et se supprime séparément) et, côté
 * Google Agenda, par un seul événement récurrent.
 */
export const REPEAT_CHOICES: { id: Repeat; label: string }[] = [
  { id: 'none', label: 'Une seule fois' },
  { id: 'day', label: 'Chaque jour' },
  { id: 'week', label: 'Chaque semaine' },
  { id: 'month', label: 'Chaque mois' },
];

export const MAX_DATES = 200;

/** « Chaque semaine jusqu'au 31 déc. » */
export function repeatLabel(repeat: Repeat, until: string | null): string {
  const choice = REPEAT_CHOICES.find((c) => c.id === repeat);
  if (!choice || repeat === 'none') return '';
  return until ? `${choice.label} jusqu’au ${shortDate(until)}` : choice.label;
}

/** Toutes les dates d'une série, de la première jusqu'à la fin incluse. */
export function repeatDates(first: string, repeat: Repeat, until: string): string[] {
  if (repeat === 'none') return [first];
  const start = fromKey(first);
  const day = start.getDate();
  const out: string[] = [];
  for (let i = 0; i < 1000 && out.length <= MAX_DATES; i++) {
    let d: Date;
    if (repeat === 'day') d = addDays(start, i);
    else if (repeat === 'week') d = addDays(start, i * 7);
    else {
      d = new Date(start.getFullYear(), start.getMonth() + i, day);
      if (d.getDate() !== day) continue; // le 31 n'existe pas tous les mois : on saute
    }
    const k = keyOf(d);
    if (k > until) break;
    out.push(k);
  }
  return out;
}

/** Fin proposée : un mois pour « chaque jour », trois pour « chaque semaine », un an pour « chaque mois ». */
export function defaultUntil(first: string, repeat: Repeat): string {
  const d = fromKey(first || todayKey());
  const months = repeat === 'day' ? 1 : repeat === 'week' ? 3 : 12;
  return keyOf(new Date(d.getFullYear(), d.getMonth() + months, d.getDate()));
}
