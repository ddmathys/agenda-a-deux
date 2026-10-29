import { addDays, fromKey, keyOf } from './dates';
import type { Deadline, DeadlineKind } from './types';

export const KIND_INFO: Record<DeadlineKind, { label: string; plural: string; icon: string; tint: string }> = {
  abo: { label: 'Abonnement', plural: 'Abonnements', icon: '📺', tint: '#ECE5FF' },
  assurance: { label: 'Assurance', plural: 'Assurances', icon: '🛡️', tint: '#E3F1FF' },
  contrat: { label: 'Contrat', plural: 'Contrats', icon: '📝', tint: '#FFF0DC' },
  entretien: { label: 'Entretien', plural: 'Entretien', icon: '🔧', tint: '#E3F7EA' },
  admin: { label: 'Papiers', plural: 'Papiers', icon: '📄', tint: '#FFE9EE' },
};
export const KINDS = Object.keys(KIND_INFO) as DeadlineKind[];

/** Ce qui se renouvelle tout seul (abo, assurance, contrat) avance seul ; un entretien attend « C'est fait ». */
export const autoRenews = (d: Deadline) => d.kind === 'abo' || d.kind === 'assurance' || d.kind === 'contrat';

/** Même jour, n mois plus tard (le 31 devient le dernier jour du mois). */
export function addMonths(k: string, n: number): string {
  const d = fromKey(k);
  const day = d.getDate();
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
  return keyOf(x);
}

/** La prochaine échéance à venir : une date passée d'un abonnement est reportée au cycle suivant. */
export function nextOf(d: Deadline, today: string): string {
  if (!autoRenews(d) || !d.every) return d.next;
  let k = d.next;
  // Le jour même reste « aujourd'hui » ; après, on passe au renouvellement suivant.
  for (let i = 0; k < today && i < 600; i++) k = addMonths(k, d.every);
  return k;
}

/** Dernier jour pour résilier (préavis), ou null sans préavis. */
export const cancelBy = (d: Deadline, today: string) => (d.notice ? keyOf(addDays(fromKey(addMonths(nextOf(d, today), -d.notice)), -1)) : null);

/** La date qui compte : résilier avant (tant qu'il est encore temps), sinon l'échéance elle-même. */
export function keyDate(d: Deadline, today: string): string {
  const c = cancelBy(d, today);
  return c && c >= today ? c : nextOf(d, today);
}

/** Coût ramené au mois. */
export const monthly = (d: Deadline) => (d.amount ? (d.per === 'year' ? d.amount / 12 : d.amount) : 0);

export const daysTo = (k: string, today: string) => Math.round((fromKey(k).getTime() - fromKey(today).getTime()) / 86400000);

export function everyLabel(n: number): string {
  if (!n) return 'Une seule fois';
  if (n === 1) return 'Chaque mois';
  if (n === 12) return 'Chaque année';
  if (n % 12 === 0) return `Tous les ${n / 12} ans`;
  return `Tous les ${n} mois`;
}

export const EVERY_CHOICES = [1, 3, 6, 12, 24, 36, 0];
export const NOTICE_CHOICES = [0, 1, 2, 3, 6];

export const chf = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)} CHF`;

/** « dans 12 jours », « demain », « aujourd'hui », « il y a 3 jours » */
export function inDaysLabel(n: number): string {
  if (n === 0) return 'aujourd’hui';
  if (n === 1) return 'demain';
  if (n === -1) return 'hier';
  if (n < 0) return `il y a ${-n} jours`;
  if (n < 60) return `dans ${n} jours`;
  return `dans ${Math.round(n / 30)} mois`;
}
