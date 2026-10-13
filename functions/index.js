/**
 * Rappels d'Agenda à deux, envoyés en notifications Web Push (aussi dans l'appli Android).
 *
 * - reminders : toutes les 5 minutes, envoie ce qui tombe dans le dernier quart d'heure
 *   (rendez-vous, tâches à heure fixe, anniversaires, départs en vacances, résumé du matin).
 *   Chaque envoi laisse une trace dans households/{hid}/sent : jamais deux fois le même.
 * - newEvent / newTask : prévient l'autre quand quelque chose est ajouté pour lui ou pour « Nous ».
 *
 * Les abonnements de chaque téléphone sont dans users/{uid}/push/{id}.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { addDays, birthdayTitle, dayLabel, dueReminders, recipients, TZ } from './lib.js';

initializeApp();
const db = getFirestore();

const VAPID_PRIVATE = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC = 'BAkAXw-fsDuFDcihim4eyHxwWtkxTxRTEAF4rVheo15Sl3QVZWjR61DMhxX0SzCtQCVwV4j8NJ0wWE0e1Y_ScCU';
const REGION = 'europe-west6';
const WINDOW_MS = 15 * 60 * 1000; // un passage raté est rattrapé au suivant

// --- Envoi ---

async function sendTo(uid, payload) {
  const subs = await db.collection('users').doc(uid).collection('push').get();
  await Promise.all(subs.docs.map(async (s) => {
    const { endpoint, keys } = s.data();
    try {
      await webpush.sendNotification({ endpoint, keys }, JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
    } catch (err) {
      // Abonnement expiré ou révoqué : on l'oublie.
      if (err.statusCode === 404 || err.statusCode === 410) await s.ref.delete();
      else logger.warn('push failed', { uid, status: err.statusCode, body: err.body });
    }
  }));
}

/** Envoie une seule fois par clé (trace dans households/{hid}/sent). */
async function once(hid, key, uids, payload) {
  const ref = db.collection('households').doc(hid).collection('sent').doc(key.replace(/[^\w-]/g, '_'));
  try {
    await ref.create({ at: FieldValue.serverTimestamp() });
  } catch {
    return; // déjà envoyé
  }
  await Promise.all(uids.map((uid) => sendTo(uid, payload)));
}

function setupPush() {
  webpush.setVapidDetails('mailto:david.mathys24@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE.value());
}

export const reminders = onSchedule(
  { schedule: 'every 5 minutes', timeZone: TZ, region: REGION, secrets: [VAPID_PRIVATE], memory: '256MiB', maxInstances: 1 },
  async () => {
    setupPush();
    const now = Date.now();
    const houses = await db.collection('households').get();
    for (const h of houses.docs) {
      const house = { id: h.id, ...h.data() };
      const [evSnap, tkSnap] = await Promise.all([
        h.ref.collection('events').get(),
        h.ref.collection('tasks').where('done', '==', false).get(),
      ]);
      const events = evSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const tasks = tkSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const due = dueReminders(house, events, tasks, now).filter((r) => r.at <= now && r.at > now - WINDOW_MS);
      for (const r of due) await once(h.id, r.key, r.uids, r.payload);
    }
  },
);

// --- Quand l'autre ajoute quelque chose ---

async function announce(hid, item, kind, id) {
  const creator = item.createdBy;
  if (!creator) return;
  const snap = await db.collection('households').doc(hid).get();
  const house = snap.data();
  if (!house) return;
  const to = recipients(house, item.owner).filter((u) => u !== creator);
  if (!to.length) return;
  setupPush();
  const who = house.people?.[creator]?.name ?? 'Ta moitié';
  let what = item.title;
  let when = '';
  if (kind === 'event') {
    if (item.birthday) what = birthdayTitle(item);
    else if (item.vacation) when = `${dayLabel(item.date)} → ${dayLabel(item.dateEnd ?? item.date)}`;
    else when = [dayLabel(item.date), item.start].filter(Boolean).join(' · ');
    if (item.seriesId) when += ' · se répète';
  } else if (item.due) {
    when = [dayLabel(item.due), item.time].filter(Boolean).join(' · ');
  }
  // Une série crée une fiche par date : un seul message pour toute la série.
  const key = item.seriesId ? `new-series-${item.seriesId}` : `new-${kind}-${id}`;
  await once(hid, key, to, {
    title: `${who} a ajouté ${kind === 'task' ? 'une tâche' : item.vacation ? 'des vacances' : item.birthday ? 'un anniversaire' : 'un rendez-vous'}`,
    body: [what, when].filter(Boolean).join(' · '),
    tag: key,
    url: '/',
  });
}

export const newEvent = onDocumentCreated(
  { document: 'households/{hid}/events/{id}', region: REGION, secrets: [VAPID_PRIVATE], memory: '256MiB' },
  (ev) => announce(ev.params.hid, ev.data?.data() ?? {}, 'event', ev.params.id),
);

export const newTask = onDocumentCreated(
  { document: 'households/{hid}/tasks/{id}', region: REGION, secrets: [VAPID_PRIVATE], memory: '256MiB' },
  (ev) => announce(ev.params.hid, ev.data?.data() ?? {}, 'task', ev.params.id),
);
