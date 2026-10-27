/**
 * Coco, l'assistant de l'agenda : DeepSeek avec des « outils » pour lire l'agenda du couple
 * (rendez-vous, vacances, anniversaires, tâches), la météo, et proposer un ajout.
 * Rien n'est écrit ici : une proposition revient à l'app, qui l'ajoute si on touche « Ajouter ».
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { TZ, todayZurich, addDays } from './lib.js';
import { weatherWords } from './ideas.js';

const DEEPSEEK_KEY = defineSecret('DEEPSEEK_API_KEY');
const HOUSEHOLD_DAILY_CAP = 80; // messages par foyer et par jour
const GLOBAL_DAILY_CAP = 1500;
const MAX_ROUNDS = 5; // allers-retours outils par message

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const weekday = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'chercher_agenda',
      description: 'Liste les rendez-vous, vacances/voyages et anniversaires entre deux dates (incluses). Pour « le prochain voyage », chercher sur une longue période (ex. 12 mois) avec le mot-clé vide et regarder les vacances.',
      parameters: {
        type: 'object',
        properties: {
          du: { type: 'string', description: 'AAAA-MM-JJ' },
          au: { type: 'string', description: 'AAAA-MM-JJ' },
          mot: { type: 'string', description: 'Mot à chercher dans le titre ou le lieu (facultatif)' },
          type: { type: 'string', enum: ['tout', 'vacances', 'anniversaires', 'rendez-vous'] },
        },
        required: ['du', 'au'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'taches',
      description: 'Liste les tâches (à faire ou faites), avec échéance et personne.',
      parameters: { type: 'object', properties: { etat: { type: 'string', enum: ['a_faire', 'faites'] } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'meteo',
      description: 'Météo prévue chez le couple pour un jour (jusqu’à 14 jours).',
      parameters: { type: 'object', properties: { jour: { type: 'string', description: 'AAAA-MM-JJ' } }, required: ['jour'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proposer_ajout',
      description: 'Affiche un bouton « Ajouter à l’agenda » pour une activité ou un rendez-vous. Ne PAS l’utiliser sans que la personne le souhaite ou qu’une activité précise soit retenue.',
      parameters: {
        type: 'object',
        properties: {
          titre: { type: 'string' },
          date: { type: 'string', description: 'AAAA-MM-JJ' },
          heure: { type: 'string', description: 'HH:MM, facultatif' },
          heure_fin: { type: 'string', description: 'HH:MM, facultatif' },
          lieu: { type: 'string' },
          pour: { type: 'string', enum: ['moi', 'autre', 'nous'] },
        },
        required: ['titre', 'date', 'pour'],
      },
    },
  },
];

/** Prochaine date (≥ from) d'un anniversaire, et l'âge fêté. */
function nextBirthday(birth, from) {
  const y0 = Number(from.slice(0, 4));
  for (const y of [y0, y0 + 1]) {
    const k = `${y}${birth.slice(4)}`;
    if (k >= from) return { date: k, age: y - Number(birth.slice(0, 4)) };
  }
  return null;
}

function runTool(name, args, ctx) {
  const who = (o) => (o === 'both' ? 'Nous' : ctx.people[o]?.name ?? '?');
  if (name === 'chercher_agenda') {
    const du = /^\d{4}-\d{2}-\d{2}$/.test(args.du) ? args.du : ctx.today;
    const au = /^\d{4}-\d{2}-\d{2}$/.test(args.au) ? args.au : addDays(du, 30);
    const mot = String(args.mot ?? '').toLowerCase().trim();
    const type = args.type ?? 'tout';
    const out = [];
    for (const e of ctx.events) {
      if (mot && !`${e.title} ${e.place ?? ''}`.toLowerCase().includes(mot)) continue;
      if (e.birthday) {
        if (type !== 'tout' && type !== 'anniversaires') continue;
        const n = nextBirthday(e.date, du);
        if (n && n.date <= au) out.push({ type: 'anniversaire', date: n.date, jour: weekday(n.date), titre: e.title, age: n.age > 0 && n.age < 120 ? n.age : undefined });
      } else if (e.vacation || e.dateEnd) {
        if (type !== 'tout' && type !== 'vacances') continue;
        if (e.date <= au && (e.dateEnd ?? e.date) >= du) out.push({ type: 'vacances', du: e.date, au: e.dateEnd, titre: e.title, lieu: e.place || undefined, pour: who(e.owner) });
      } else {
        if (type !== 'tout' && type !== 'rendez-vous') continue;
        if (e.date >= du && e.date <= au) out.push({ type: 'rendez-vous', date: e.date, jour: weekday(e.date), heure: e.start ?? 'journée', fin: e.end ?? undefined, titre: e.title, lieu: e.place || undefined, pour: who(e.owner) });
      }
    }
    out.sort((a, b) => (a.date ?? a.du).localeCompare(b.date ?? b.du) || String(a.heure ?? '').localeCompare(String(b.heure ?? '')));
    return { du, au, nombre: out.length, resultats: out.slice(0, 60) };
  }
  if (name === 'taches') {
    const done = args.etat === 'faites';
    const list = ctx.tasks.filter((t) => !!t.done === done)
      .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
      .slice(0, 50)
      .map((t) => ({ titre: t.title, echeance: t.due ?? 'sans date', heure: t.time ?? undefined, pour: who(t.owner), en_retard: !t.done && t.due && t.due < ctx.today ? true : undefined }));
    return { nombre: list.length, taches: list };
  }
  if (name === 'proposer_ajout') {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(args.date) && String(args.titre ?? '').trim();
    if (!ok) return { erreur: 'titre ou date invalide' };
    const time = (s) => (/^\d{2}:\d{2}$/.test(s ?? '') ? s : null);
    const owner = args.pour === 'moi' ? ctx.uid : args.pour === 'autre' ? ctx.partner ?? 'both' : 'both';
    ctx.actions.push({ title: String(args.titre).slice(0, 80), date: args.date, start: time(args.heure), end: time(args.heure_fin), place: String(args.lieu ?? '').slice(0, 80), owner });
    return { ok: true, note: 'Le bouton est affiché sous ta réponse : la personne doit le toucher pour ajouter.' };
  }
  return { erreur: 'outil inconnu' };
}

async function weather(ctx, jour) {
  if (!ctx.home?.lat) return { erreur: 'lieu de domicile pas encore choisi dans l’app' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour ?? '') || jour < ctx.today || jour > addDays(ctx.today, 14)) return { erreur: 'prévision disponible seulement pour les 14 prochains jours' };
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${ctx.home.lat}&longitude=${ctx.home.lon}`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(TZ)}&start_date=${jour}&end_date=${jour}`;
  try {
    const d = (await (await fetch(url, { signal: AbortSignal.timeout(8000) })).json()).daily;
    return { jour, lieu: ctx.home.name, temps: weatherWords(d.weather_code[0]), min: Math.round(d.temperature_2m_min[0]), max: Math.round(d.temperature_2m_max[0]), pluie_pct: d.precipitation_probability_max[0] };
  } catch {
    return { erreur: 'météo indisponible' };
  }
}

async function spend(db, hid, today) {
  const mine = db.collection('households').doc(hid).collection('usage').doc(`chat-${today}`);
  const all = db.collection('meta').doc(`chat-${today}`);
  await db.runTransaction(async (tx) => {
    const [a, b] = await Promise.all([tx.get(mine), tx.get(all)]);
    if ((a.data()?.n ?? 0) >= HOUSEHOLD_DAILY_CAP) throw new HttpsError('resource-exhausted', 'On a beaucoup papoté aujourd’hui 😅 On reprend demain ?');
    if ((b.data()?.n ?? 0) >= GLOBAL_DAILY_CAP) throw new HttpsError('resource-exhausted', 'Coco fait une pause pour aujourd’hui.');
    tx.set(mine, { n: FieldValue.increment(1) }, { merge: true });
    tx.set(all, { n: FieldValue.increment(1) }, { merge: true });
  });
}

function system(ctx) {
  const me = ctx.people[ctx.uid]?.name ?? 'toi';
  const other = ctx.partner ? ctx.people[ctx.partner]?.name : null;
  return [
    `Tu es Coco 🐥, l’assistant de l’app « Agenda à deux » d’un couple : ${me}${other ? ` et ${other}` : ''}. Tu parles avec ${me} (tu le tutoies).`,
    `Aujourd’hui : ${weekday(ctx.today)} ${ctx.today}, heure ${ctx.now} (Suisse). ${ctx.home?.name ? `Ils habitent à ${ctx.home.name}${ctx.home.region ? ` (${ctx.home.region})` : ''}.` : 'Leur ville n’est pas encore indiquée dans l’app.'}`,
    'Personnalité : chaleureux, enjoué, un brin d’humour, quelques emojis bien choisis (pas trop). Français de Suisse romande (septante, nonante, souper = repas du soir).',
    'Réponses COURTES : 1 à 4 phrases, ou une petite liste à puces. Tu peux mettre **en gras** les dates et mots importants. Pas de titres.',
    'Pour toute question sur leur agenda, leurs voyages, anniversaires ou tâches : utilise TOUJOURS les outils, n’invente jamais. Si rien n’est trouvé, dis-le gentiment et propose d’ajouter.',
    'Dates : dis « samedi 14 novembre » plutôt que 2026-11-14, et précise « dans 12 jours » quand c’est utile.',
    'Pour des idées d’activités : tiens compte de la météo (outil meteo), de la saison et de leur région ; propose des lieux réels et connus à moins de 45 minutes. Quand une idée est retenue, propose-la avec proposer_ajout.',
    'Quand on te demande « trouve-moi une activité » pour un jour : regarde la météo de ce jour-là et l’agenda, puis propose 3 idées concrètes et variées (une ligne chacune, avec un emoji, le lieu et l’heure idéale), et demande laquelle leur plaît. Quand une est choisie, utilise proposer_ajout.',
    'Tu ne peux ni modifier ni supprimer quoi que ce soit : pour ça, renvoie vers l’app.',
  ].join('\n');
}

async function deepseek(messages) {
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY.value().trim()}` },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.9, max_tokens: 700, messages, tools: TOOLS }),
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) {
    logger.error('deepseek chat', { status: r.status, body: (await r.text()).slice(0, 300) });
    throw new HttpsError('unavailable', 'Coco ne répond pas pour l’instant. Réessaie dans un moment.');
  }
  return (await r.json()).choices[0].message;
}

/** La conversation : DeepSeek appelle des outils jusqu’à pouvoir répondre. */
export async function converse(ctx, history) {
  const messages = [{ role: 'system', content: system(ctx) }, ...history];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const msg = await deepseek(messages);
    if (!msg.tool_calls?.length) {
      return { reply: (msg.content ?? '').trim() || 'Hmm, je n’ai pas compris 🤔 Tu peux reformuler ?', actions: ctx.actions.slice(0, 3) };
    }
    messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });
    for (const call of msg.tool_calls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        /* arguments illisibles : l'outil répondra par une erreur */
      }
      const result = call.function.name === 'meteo' ? await weather(ctx, args.jour) : runTool(call.function.name, args, ctx);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return { reply: 'Je me suis un peu emmêlé les plumes 🐥 Tu peux reposer ta question autrement ?', actions: ctx.actions.slice(0, 3) };
}

export const chat = onCall(
  { region: 'europe-west6', secrets: [DEEPSEEK_KEY], memory: '256MiB', timeoutSeconds: 120, maxInstances: 5 },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Connecte-toi d’abord.');
    // Historique envoyé par l'app : on ne garde que du texte, et les derniers échanges.
    const history = (Array.isArray(req.data?.messages) ? req.data.messages : [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-16)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (history.at(-1)?.role !== 'user') throw new HttpsError('invalid-argument', 'Message vide.');

    const db = getFirestore();
    const hid = (await db.collection('users').doc(uid).get()).data()?.hid;
    if (!hid) throw new HttpsError('failed-precondition', 'Pas d’agenda.');
    const hRef = db.collection('households').doc(hid);
    const house = (await hRef.get()).data();
    if (!house?.members?.includes(uid)) throw new HttpsError('permission-denied', 'Pas ton agenda.');

    const now = new Date();
    const today = todayZurich(now);
    await spend(db, hid, today);
    const [evs, tks] = await Promise.all([hRef.collection('events').get(), hRef.collection('tasks').get()]);
    const ctx = {
      uid,
      partner: house.members.find((m) => m !== uid),
      people: house.people ?? {},
      home: house.home,
      today,
      now: new Intl.DateTimeFormat('fr-CH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(now),
      events: evs.docs.map((d) => d.data()),
      tasks: tks.docs.map((d) => d.data()),
      actions: [],
    };

    return converse(ctx, history);
  },
);
