import { addDays, keyOf } from './dates';
import type { Owner } from './types';

/**
 * Lecture « comme tu parles » d'une phrase en français :
 * « Appeler la crèche mardi 10h pour Karin, rappel 30 min avant »
 * → tâche, mardi prochain, 10:00, pour Karin, liste Enfants.
 * Tout se fait localement, sans IA ni réseau.
 */
export interface Parsed {
  kind: 'task' | 'event';
  title: string;
  date: string | null;
  start: string | null;
  end: string | null;
  owner: Owner | null;
  list: string | null;
}

interface PersonRef {
  uid: string;
  name: string;
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS: Record<string, number> = {
  janvier: 0, janv: 0, fevrier: 1, février: 1, fevr: 1, févr: 1, mars: 2, avril: 3, avr: 3, mai: 4, juin: 5,
  juillet: 6, juil: 6, aout: 7, août: 7, septembre: 8, sept: 8, octobre: 9, oct: 9, novembre: 10, nov: 10,
  decembre: 11, décembre: 11, dec: 11, déc: 11,
};

const EVENT_WORDS = /\b(rdv|rendez-vous|réunion|reunion|dîner|diner|déjeuner|dejeuner|apéro|apero|ciné|cine|cinéma|brunch|soirée|soiree|fête|fete|vol|train|match|concert|spectacle|resto|restaurant|anniversaire de|chez)\b/i;

const LIST_RULES: [string, RegExp][] = [
  ['courses', /\b(acheter|courses|lait|pain|fruits?|légumes|legumes|couches|migros|coop|denner|lidl|aldi|supermarché)\b/i],
  ['enfants', /\b(crèche|creche|école|ecole|pédiatre|pediatre|enfants?|bébé|bebe|nounou|natation|garderie|maîtresse)\b/i],
  ['admin', /\b(facture|payer|impôts?|impots?|assurance|banque|papiers?|résilier|resilier|formulaire|déclaration|declaration|abonnement|contrat)\b/i],
];

const hhmm = (h: string, m?: string) => `${h.padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`;
const validHour = (h: string) => Number(h) >= 0 && Number(h) <= 23;

export function parseQuick(text: string, me: string, people: PersonRef[], now = new Date()): Parsed {
  let s = ` ${text.trim()} `;
  const cut = (re: RegExp) => {
    s = s.replace(re, ' ');
  };

  let start: string | null = null;
  let end: string | null = null;
  let date: string | null = null;
  let owner: Owner | null = null;

  // Rappels : pas encore gérés, on les retire du titre.
  cut(/,?\s*rappel\b[^,.;]*/i);

  // Plage horaire : « de 10h à 11h30 », « 14h-16h »
  const range = s.match(/\s(?:de\s+)?(\d{1,2})\s*[h:]\s*(\d{2})?\s*(?:-|–|à|a|jusqu'à)\s*(\d{1,2})\s*[h:]\s*(\d{2})?(?=[\s,.;!?])/i);
  if (range && validHour(range[1]) && validHour(range[3])) {
    start = hhmm(range[1], range[2]);
    end = hhmm(range[3], range[4]);
    cut(new RegExp(escape(range[0])));
  } else {
    const t = s.match(/\s(?:à\s+|a\s+|vers\s+|dès\s+)?(\d{1,2})\s*[h:]\s*(\d{2})?(?=[\s,.;!?])/i);
    if (t && validHour(t[1])) {
      start = hhmm(t[1], t[2]);
      cut(new RegExp(escape(t[0])));
    } else if (/\s(?:à\s+)?midi\b/i.test(s)) {
      start = '12:00';
      cut(/\s(?:à\s+)?midi\b/i);
    }
  }

  // Date
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let m: RegExpMatchArray | null;
  if ((m = s.match(/\s(après-demain|apres-demain|après demain)\b/i))) {
    date = keyOf(addDays(today, 2));
    cut(new RegExp(escape(m[0])));
  } else if ((m = s.match(/\s(demain)(\s+(matin|midi|soir|après-midi))?\b/i))) {
    date = keyOf(addDays(today, 1));
    cut(new RegExp(escape(m[0])));
  } else if ((m = s.match(/\s(aujourd'hui|aujourd’hui|ce soir|ce matin|cet après-midi|ce midi)\b/i))) {
    date = keyOf(today);
    cut(new RegExp(escape(m[0])));
  } else if ((m = s.match(/\s(?:ce\s+|le\s+)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(\s+prochain)?(\s+(matin|midi|soir|après-midi))?\b/i))) {
    const wd = WEEKDAYS.indexOf(m[1].toLowerCase());
    let ahead = (wd - today.getDay() + 7) % 7;
    if (ahead === 0) ahead = 7;
    date = keyOf(addDays(today, ahead));
    cut(new RegExp(escape(m[0])));
  } else if ((m = s.match(/\s(?:le\s+)?(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=[\s,.;!?])/))) {
    date = buildDate(today, Number(m[1]), Number(m[2]) - 1, m[3]);
    if (date) cut(new RegExp(escape(m[0])));
  } else if ((m = s.match(/\s(?:le\s+)?(\d{1,2})(?:er)?\s+([a-zéû]+)\.?(?:\s+(\d{4}))?(?=[\s,.;!?])/i)) && MONTHS[m[2].toLowerCase()] !== undefined) {
    date = buildDate(today, Number(m[1]), MONTHS[m[2].toLowerCase()], m[3]);
    if (date) cut(new RegExp(escape(m[0])));
  } else if ((m = s.match(/\sle\s+(\d{1,2})(?:er)?(?=[\s,.;!?])/i))) {
    const day = Number(m[1]);
    let d = new Date(today.getFullYear(), today.getMonth(), day);
    if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, day);
    if (d.getDate() === day) {
      date = keyOf(d);
      cut(new RegExp(escape(m[0])));
    }
  }
  if (start && !date) date = keyOf(today);

  // Pour qui
  if ((m = s.match(/\s(?:pour|avec)\s+(nous deux|nous|tous les deux|moi)\b/i))) {
    owner = /moi/i.test(m[1]) ? me : 'both';
    cut(new RegExp(escape(m[0])));
  } else if (/\s(ensemble|à deux|tous les deux)\b/i.test(s)) {
    owner = 'both';
    cut(/\s(ensemble|à deux)\b/i);
  } else {
    for (const p of people) {
      const first = p.name.split(/\s+/)[0];
      if (!first) continue;
      const re = new RegExp(`\\s(?:pour\\s+|à\\s+|par\\s+)?${escape(first)}\\b`, 'i');
      const pm = s.match(re);
      if (pm) {
        owner = p.uid;
        // On garde le prénom dans le titre s'il n'était pas introduit par « pour ».
        if (/^\s(pour|par)\s/i.test(pm[0])) cut(re);
        break;
      }
    }
  }

  const raw = text;
  let list: string | null = null;
  for (const [id, re] of LIST_RULES) {
    if (re.test(raw)) {
      list = id;
      break;
    }
  }

  const kind: Parsed['kind'] = end || EVENT_WORDS.test(raw) ? 'event' : 'task';

  const title = s
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
    .replace(/\s(à|a|le|la|pour|de|ce)$/i, '')
    .trim();

  return {
    kind,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    date,
    start,
    end: end ?? (kind === 'event' && start ? plusHour(start) : null),
    owner,
    list,
  };
}

function buildDate(today: Date, day: number, month: number, yearStr?: string): string | null {
  let year = yearStr ? Number(yearStr.length === 2 ? `20${yearStr}` : yearStr) : today.getFullYear();
  let d = new Date(year, month, day);
  if (!yearStr && d < today) {
    year += 1;
    d = new Date(year, month, day);
  }
  if (d.getMonth() !== month || d.getDate() !== day) return null;
  return keyOf(d);
}

function plusHour(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
