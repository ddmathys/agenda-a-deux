import { fromKey, todayKey } from './dates';
import type { EventItem } from './types';

/**
 * Anniversaires : une seule fiche par personne, dont la date est la date de
 * naissance (ou la première fois qu'on la fête). Elle s'affiche ensuite chaque
 * année au même jour, sans créer de copies.
 */

/** Le 29 février se fête le 28 les années non bissextiles. */
function sameDay(birth: string, k: string): boolean {
  const md = birth.slice(5);
  if (md === k.slice(5)) return true;
  if (md !== '02-29' || k.slice(5) !== '02-28') return false;
  const y = Number(k.slice(0, 4));
  return new Date(y, 1, 29).getMonth() !== 1;
}

/** Les événements d'un jour, anniversaires de chaque année compris. */
export function eventsOn(events: EventItem[], k: string): EventItem[] {
  return events.filter((e) => (e.birthday ? e.date <= k && sameDay(e.date, k) : e.date === k));
}

/** « 7 ans » le jour k ; rien si l'année de naissance est celle de la fiche (inconnue). */
export function ageOn(e: EventItem, k: string = todayKey()): string {
  const n = fromKey(k).getFullYear() - fromKey(e.date).getFullYear();
  if (n <= 0) return '';
  return n === 1 ? '1 an' : `${n} ans`;
}
