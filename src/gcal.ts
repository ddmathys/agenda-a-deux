import { GoogleAuthProvider, linkWithPopup, reauthenticateWithPopup, type UserCredential } from 'firebase/auth';
import { addDays, fromKey, keyOf } from './dates';
import { auth } from './firebase';
import type { Repeat } from './types';

/**
 * Envoi des événements dans le Google Agenda de la personne qui les crée.
 * Le jeton d'accès Google dure une heure ; Firebase ne le renouvelle pas,
 * on redemande donc une connexion (popup, sans nouvelle autorisation) quand il a expiré.
 */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const KEY = 'gcal-token';
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export function googleProvider() {
  const p = new GoogleAuthProvider();
  p.addScope(CALENDAR_SCOPE);
  return p;
}

export function rememberToken(result: UserCredential) {
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, exp: Date.now() + 55 * 60 * 1000 }));
  } catch {
    /* stockage indisponible : on redemandera */
  }
}

function storedToken(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { token: string; exp: number } | null;
    return v && v.exp > Date.now() ? v.token : null;
  } catch {
    return null;
  }
}

/** À appeler en tout début d'un clic (le navigateur n'autorise la popup que là). */
export async function calendarToken(): Promise<string> {
  const t = storedToken();
  if (t) return t;
  const user = auth.currentUser;
  if (!user) throw new Error('not-signed-in');
  // Compte e-mail : on y associe le compte Google la première fois.
  const hasGoogle = user.providerData.some((p) => p.providerId === 'google.com');
  const res = hasGoogle ? await reauthenticateWithPopup(user, googleProvider()) : await linkWithPopup(user, googleProvider());
  rememberToken(res);
  const fresh = storedToken();
  if (!fresh) throw new Error('no-token');
  return fresh;
}

export interface CalInput {
  title: string;
  date: string;
  start: string | null;
  end: string | null;
  place: string;
  attendees: string[];
  recurrence?: string[];
}

/** Règle de répétition Google : un seul événement récurrent plutôt qu'une centaine de copies. */
export function recurrenceRule(repeat: Repeat, until: string, timed: boolean): string[] | undefined {
  if (repeat === 'none') return undefined;
  const freq = repeat === 'day' ? 'DAILY' : repeat === 'week' ? 'WEEKLY' : 'MONTHLY';
  const end = until.replace(/-/g, '');
  // Pour un événement avec heure, Google veut une fin en UTC ; pour un jour entier, une date.
  return [`RRULE:FREQ=${freq};UNTIL=${timed ? `${end}T235959Z` : end}`];
}

function body(e: CalInput) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const when = e.start
    ? {
        start: { dateTime: `${e.date}T${e.start}:00`, timeZone: tz },
        end: { dateTime: `${e.date}T${e.end && e.end > e.start ? e.end : plusHour(e.start)}:00`, timeZone: tz },
      }
    : { start: { date: e.date }, end: { date: keyOf(addDays(fromKey(e.date), 1)) } };
  return {
    summary: e.title,
    location: e.place || undefined,
    attendees: e.attendees.map((email) => ({ email })),
    recurrence: e.recurrence,
    ...when,
  };
}

async function call(token: string, url: string, method: string, payload?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (res.status === 401) {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* rien */
    }
  }
  if (!res.ok && !(method === 'DELETE' && (res.status === 404 || res.status === 410))) {
    throw new Error(`gcal-${res.status}`);
  }
  return method === 'DELETE' ? null : ((await res.json()) as { id: string });
}

// sendUpdates=all : l'autre personne reçoit l'invitation et l'événement apparaît dans son agenda.
export async function createCal(token: string, e: CalInput): Promise<string> {
  const r = await call(token, `${API}?sendUpdates=all`, 'POST', body(e));
  return r!.id;
}

export async function updateCal(token: string, id: string, e: CalInput) {
  await call(token, `${API}/${encodeURIComponent(id)}?sendUpdates=all`, 'PATCH', body(e));
}

export async function deleteCal(token: string, id: string) {
  await call(token, `${API}/${encodeURIComponent(id)}?sendUpdates=all`, 'DELETE');
}

function plusHour(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(h + 1 > 23 ? 59 : m).padStart(2, '0')}`;
}
