export const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const pad = (n: number) => String(n).padStart(2, '0');

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function keyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export const todayKey = () => keyOf(new Date());

export function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

/** « Jeudi 24 sept. » */
export function longLabel(k: string): string {
  const d = fromKey(k);
  return `${cap(DAYS[d.getDay()])} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** « 24 sept. » */
export function shortDate(k: string): string {
  const d = fromKey(k);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** Libellé relatif pour une échéance : Aujourd'hui, Demain, Ven 25, 31 oct. */
export function dueLabel(k: string | null): string {
  if (!k) return 'Sans date';
  const today = todayKey();
  if (k < today) return 'En retard';
  if (k === today) return "Aujourd'hui";
  if (k === keyOf(addDays(new Date(), 1))) return 'Demain';
  const d = fromKey(k);
  if (k <= keyOf(addDays(new Date(), 6))) return `${cap(DAYS[d.getDay()].slice(0, 3))} ${d.getDate()}`;
  return shortDate(k);
}

export function dayGroupTitle(k: string): string {
  const today = todayKey();
  if (k === today) return "Aujourd'hui";
  if (k === keyOf(addDays(new Date(), 1))) return 'Demain';
  return cap(DAYS[fromKey(k).getDay()]);
}
