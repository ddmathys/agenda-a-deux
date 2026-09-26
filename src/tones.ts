import type { Household, Owner } from './types';

export interface Tone {
  c: string; // couleur pleine
  s: string; // fond doux
  t: string; // texte sur fond doux
  soft: string; // accent sur fond sombre
  initial: string;
  name: string;
}

const SLOT_TONES = [
  { c: '#3451E6', s: '#E7EBFF', t: '#2238B8', soft: '#7B92FF' },
  { c: '#D92B45', s: '#FFE3E7', t: '#A81D33', soft: '#FF7A8C' },
];
const BOTH = { c: '#7048E8', s: '#EEE8FF', t: '#5530C9', soft: '#A98BFF' };

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
