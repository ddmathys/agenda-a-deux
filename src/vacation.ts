import { addDays, fromKey, keyOf } from './dates';
import type { EventItem, Owner } from './types';

/**
 * Le compteur de vacances : jours de congé (du lundi au vendredi) d'une personne
 * sur une année, séparés entre déjà pris (jusqu'à aujourd'hui compris) et encore prévus.
 * Des vacances « Nous » comptent pour chacun des deux.
 */
export interface VacationCount {
  taken: number;
  planned: number;
}

export function vacationCount(events: EventItem[], who: Owner, year: number, today: string): VacationCount {
  const y0 = `${year}-01-01`;
  const y1 = `${year}-12-31`;
  const days = new Set<string>();
  for (const e of events) {
    if (!e.vacation || !e.dateEnd || (e.owner !== who && e.owner !== 'both')) continue;
    if (e.dateEnd < y0 || e.date > y1) continue;
    for (let d = fromKey(e.date < y0 ? y0 : e.date); keyOf(d) <= (e.dateEnd > y1 ? y1 : e.dateEnd); d = addDays(d, 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) days.add(keyOf(d));
    }
  }
  let taken = 0;
  for (const k of days) if (k <= today) taken += 1;
  return { taken, planned: days.size - taken };
}

/** Les prochaines vacances (ou celles en cours) à partir d'aujourd'hui. */
export function nextVacation(events: EventItem[], today: string): EventItem | undefined {
  return events
    .filter((e) => e.vacation && e.dateEnd && e.dateEnd >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

/** Nombre de jours entre aujourd'hui et k. */
export function daysUntil(k: string, today: string): number {
  return Math.round((fromKey(k).getTime() - fromKey(today).getTime()) / 86400000);
}
