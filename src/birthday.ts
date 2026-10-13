import { fromKey, shortDate, todayKey } from './dates';
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

/** Les événements d'un jour, anniversaires de chaque année et vacances en cours compris. */
export function eventsOn(events: EventItem[], k: string): EventItem[] {
  return events.filter((e) => {
    if (e.birthday) return e.date <= k && sameDay(e.date, k);
    if (e.dateEnd) return e.date <= k && k <= e.dateEnd;
    return e.date === k;
  });
}

/** Nombre de jours d'un séjour, premier et dernier compris. */
export function stayDays(e: Pick<EventItem, 'date' | 'dateEnd'>): number {
  if (!e.dateEnd) return 1;
  return Math.round((fromKey(e.dateEnd).getTime() - fromKey(e.date).getTime()) / 86400000) + 1;
}

/** « jour 3 sur 8 · jusqu’au 19 juil. » le jour k d'un séjour. */
export function stayOn(e: EventItem, k: string): string {
  if (!e.dateEnd) return '';
  const n = Math.round((fromKey(k).getTime() - fromKey(e.date).getTime()) / 86400000) + 1;
  return `jour ${n} sur ${stayDays(e)} · jusqu’au ${shortDate(e.dateEnd)}`;
}

/** « 7 ans » le jour k ; rien si l'année de naissance est celle de la fiche (inconnue). */
export function ageOn(e: EventItem, k: string = todayKey()): string {
  const n = fromKey(k).getFullYear() - fromKey(e.date).getFullYear();
  if (n <= 0) return '';
  return n === 1 ? '1 an' : `${n} ans`;
}

/** Le prochain anniversaire à partir du jour k (aujourd'hui compris), avec sa date cette année-là. */
export function nextBirthday(events: EventItem[], k: string = todayKey()): { e: EventItem; on: string } | undefined {
  const y = Number(k.slice(0, 4));
  let best: { e: EventItem; on: string } | undefined;
  for (const e of events) {
    if (!e.birthday) continue;
    for (const year of [y, y + 1]) {
      let md = e.date.slice(5);
      if (md === '02-29' && new Date(year, 1, 29).getMonth() !== 1) md = '02-28';
      const on = `${year}-${md}`;
      if (on >= k && on >= e.date) {
        if (!best || on < best.on) best = { e, on };
        break;
      }
    }
  }
  return best;
}
