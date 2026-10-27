/**
 * Idées de sorties : pour un jour libre, DeepSeek propose quelques activités près de chez
 * le couple, selon la météo prévue (Open-Meteo, sans clé) et ce qui est déjà à l'agenda.
 * Les idées sont rangées dans households/{hid}/ideas/{jour} : les deux les voient,
 * et on ne repaie pas l'IA à chaque ouverture.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { TZ, todayZurich, addDays } from './lib.js';

const DEEPSEEK_KEY = defineSecret('DEEPSEEK_API_KEY');
const HOUSEHOLD_DAILY_CAP = 12; // demandes par foyer et par jour
const GLOBAL_DAILY_CAP = 300; // coupe-circuit pour toute l'app

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Codes météo WMO → mots simples. */
export function weatherWords(code) {
  if (code === 0) return 'grand soleil';
  if (code <= 2) return 'plutôt ensoleillé';
  if (code === 3) return 'couvert';
  if (code <= 48) return 'brouillard';
  if (code <= 57) return 'bruine';
  if (code <= 67) return 'pluie';
  if (code <= 77) return 'neige';
  if (code <= 82) return 'averses';
  if (code <= 86) return 'averses de neige';
  return 'orages';
}

async function forecast(home, day) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${home.lat}&longitude=${home.lon}`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(TZ)}`
    + `&start_date=${day}&end_date=${day}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = (await r.json()).daily;
    return { code: d.weather_code[0], tmax: Math.round(d.temperature_2m_max[0]), tmin: Math.round(d.temperature_2m_min[0]), rain: d.precipitation_probability_max[0] ?? 0 };
  } catch {
    return null; // trop loin dans le futur ou service indisponible : on fait sans
  }
}

/** Compteur du jour (foyer + global) ; refuse au-delà des plafonds. */
async function spend(db, hid, today) {
  const mine = db.collection('households').doc(hid).collection('usage').doc(`ideas-${today}`);
  const all = db.collection('meta').doc(`ideas-${today}`);
  await db.runTransaction(async (tx) => {
    const [a, b] = await Promise.all([tx.get(mine), tx.get(all)]);
    if ((a.data()?.n ?? 0) >= HOUSEHOLD_DAILY_CAP) throw new HttpsError('resource-exhausted', 'Assez d’idées pour aujourd’hui : réessaie demain.');
    if ((b.data()?.n ?? 0) >= GLOBAL_DAILY_CAP) throw new HttpsError('resource-exhausted', 'Le service d’idées est saturé aujourd’hui.');
    tx.set(mine, { n: FieldValue.increment(1) }, { merge: true });
    tx.set(all, { n: FieldValue.increment(1) }, { merge: true });
  });
}

export function prompt({ home, day, slot, weather, busy, avoid, people }) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const when = `${DAYS[date.getUTCDay()]} ${d} ${MONTHS[m - 1]} ${y}`;
  const meteo = weather
    ? `${weatherWords(weather.code)}, ${weather.tmin} à ${weather.tmax} °C, risque de pluie ${weather.rain} %`
    : 'inconnue (prévoir des idées qui marchent par tous les temps)';
  return [
    `Tu es un ami local qui connaît très bien la région de ${home.name}${home.region ? ` (${home.region})` : ''}.`,
    `Un couple (${people}) habite à ${home.name}. Propose-leur 4 activités à faire ensemble le ${when}${slot === 'evening' ? ', en soirée (à partir de 18 h)' : ''}.`,
    `Météo prévue : ${meteo}.`,
    busy.length ? `Déjà à leur agenda ce jour-là (ne pas chevaucher) : ${busy.join(' ; ')}.` : 'Leur agenda est libre ce jour-là.',
    avoid.length ? `Ne propose pas de nouveau : ${avoid.join(' ; ')}.` : '',
    'Règles :',
    '- Lieux réels et connus, à 45 minutes au plus de chez eux. Si tu n’es pas sûr qu’un lieu existe, propose une activité générique (ex. « pique-nique au bord du lac de la Gruyère »).',
    '- Adapte à la météo et à la saison : s’il pleut ou fait froid, surtout des idées au sec ; s’il fait beau, au moins deux idées dehors.',
    '- Heures réalistes selon les horaires habituels : musées, ateliers et visites en journée (fermeture vers 17 h), repas aux heures de repas ; les activités ne se chevauchent pas forcément, ce sont des choix.',
    '- Varie : une idée nature ou sport doux, une idée culture ou découverte, une idée gourmande, une idée originale ou cocooning.',
    '- Ton chaleureux et concret, en français de Suisse romande, on s’adresse au couple avec « vous ». Pas de prix inventés.',
    'Réponds UNIQUEMENT en JSON : {"ideas":[{"emoji":"🥾","title":"titre court (max 40 caractères)","why":"une phrase qui donne envie (max 110 caractères)","place":"lieu précis ou ville","start":"HH:MM","duration":120,"cost":"gratuit|petit budget|sortie","indoor":false}]}',
  ].filter(Boolean).join('\n');
}

export async function askDeepSeek(text) {
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY.value().trim()}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 1.1,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: text }],
    }),
    signal: AbortSignal.timeout(50000),
  });
  if (!r.ok) {
    logger.error('deepseek', { status: r.status, body: (await r.text()).slice(0, 300) });
    throw new HttpsError('unavailable', 'Les idées ne répondent pas pour l’instant. Réessaie dans un moment.');
  }
  const out = JSON.parse((await r.json()).choices[0].message.content);
  const clean = (s, n) => String(s ?? '').trim().slice(0, n);
  return (out.ideas ?? []).slice(0, 5).map((i) => ({
    emoji: clean(i.emoji, 4) || '✨',
    title: clean(i.title, 60),
    why: clean(i.why, 160),
    place: clean(i.place, 80),
    start: /^\d{2}:\d{2}$/.test(i.start) ? i.start : null,
    duration: Math.min(600, Math.max(30, Number(i.duration) || 120)),
    cost: clean(i.cost, 20),
    indoor: !!i.indoor,
  })).filter((i) => i.title);
}

export const suggestIdeas = onCall(
  { region: 'europe-west6', secrets: [DEEPSEEK_KEY], memory: '256MiB', timeoutSeconds: 60, maxInstances: 5 },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Connecte-toi d’abord.');
    const day = String(req.data?.day ?? '');
    const slot = req.data?.slot === 'evening' ? 'evening' : 'day';
    const more = !!req.data?.more;
    const today = todayZurich(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today || day > addDays(today, 14)) {
      throw new HttpsError('invalid-argument', 'Jour invalide.');
    }

    const db = getFirestore();
    const hid = (await db.collection('users').doc(uid).get()).data()?.hid;
    if (!hid) throw new HttpsError('failed-precondition', 'Pas d’agenda.');
    const house = (await db.collection('households').doc(hid).get()).data();
    if (!house?.members?.includes(uid)) throw new HttpsError('permission-denied', 'Pas ton agenda.');
    const home = house.home;
    if (!home?.lat) throw new HttpsError('failed-precondition', 'Indique d’abord où vous habitez.');

    const ref = db.collection('households').doc(hid).collection('ideas').doc(day);
    const prev = (await ref.get()).data();
    // Déjà des idées pour ce jour et ce moment : on les rend telles quelles, sans rappeler l'IA.
    if (prev?.items?.length && prev.slot === slot && (prev.home ?? home.name) === home.name && !more) return { ok: true };

    await spend(db, hid, today);
    const evs = await db.collection('households').doc(hid).collection('events').where('date', '==', day).get();
    const busy = evs.docs.map((e) => e.data()).filter((e) => !e.birthday).map((e) => `${e.start ?? 'journée'} ${e.title}`);
    const weather = await forecast(home, day);
    const people = Object.values(house.people ?? {}).map((p) => p.name).join(' et ');
    const avoid = more && prev?.items ? prev.items.map((i) => i.title) : [];

    const items = await askDeepSeek(prompt({ home, day, slot, weather, busy, avoid, people }));
    if (!items.length) throw new HttpsError('unavailable', 'Aucune idée cette fois. Réessaie.');
    await ref.set({ day, slot, home: home.name, weather, items, chosen: prev?.slot === slot ? prev?.chosen ?? null : null, at: FieldValue.serverTimestamp(), by: uid });
    return { ok: true };
  },
);
