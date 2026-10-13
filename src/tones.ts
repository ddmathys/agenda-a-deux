import type { Household, Owner } from './types';

export interface Tone {
  c: string; // couleur pleine
  s: string; // fond doux
  t: string; // texte sur fond doux
  soft: string; // version plus claire (mural)
  on: string; // texte sur la couleur pleine
  initial: string;
  name: string;
}

// Palette « Sorbet » : corail, turquoise et lilas, avec un texte foncé sur la couleur pleine.
const SLOT_TONES = [
  { c: '#FF8A5B', s: '#FFE4D8', t: '#9A3412', soft: '#FF9F7A', on: '#3A1400' },
  { c: '#2EC4B6', s: '#D5F5F1', t: '#0B5F57', soft: '#5ED6CA', on: '#00302B' },
];
const BOTH = { c: '#9B7BFF', s: '#ECE5FF', t: '#5530C9', soft: '#B9A2FF', on: '#1E0F55' };

export function toneOf(h: Household, owner: Owner): Tone {
  const p = owner !== 'both' ? h.people[owner] : undefined;
  if (!p) return { ...BOTH, initial: 'N', name: 'Nous' };
  return { ...SLOT_TONES[p.slot], initial: p.name.charAt(0).toUpperCase(), name: p.name };
}

export function partnerUid(h: Household, me: string): string | undefined {
  return h.members.find((m) => m !== me);
}

/** Les trois « personnes » à qui on peut attribuer quelque chose, dans l'ordre Moi, l'autre, Nous. */
export function ownerChoices(h: Household, me: string): { id: Owner; label: string }[] {
  const out: { id: Owner; label: string }[] = [{ id: me, label: 'Moi' }];
  const other = partnerUid(h, me);
  if (other) out.push({ id: other, label: h.people[other]?.name ?? 'L’autre' });
  out.push({ id: 'both', label: 'Nous' });
  return out;
}
