/** Calculs des rappels (sans accès réseau) : dates à Zurich et liste de ce qui est dû. */
export const TZ = 'Europe/Zurich';
const DEFAULT_REMIND = 60; // minutes avant un rendez-vous

// --- Dates à l'heure de Zurich ---

export function offsetMinutes(at) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = name.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!m) return 0;
  const h = Number(m[1]);
  return h * 60 + Math.sign(h) * Number(m[2] ?? 0);
}

/** « 2026-10-15 » + « 18:00 » à Zurich → instant en millisecondes. */
export function zurich(date, time) {
  const [y, mo, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, hh, mm);
  let t = guess - offsetMinutes(new Date(guess)) * 60000;
  t = guess - offsetMinutes(new Date(t)) * 60000; // changement d'heure
  return t;
}

export const todayZurich = (now) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}

/** « jeu. 15 oct. » */
export function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-CH', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

export function remindLabel(min) {
  if (min >= 1440) return 'Demain';
  if (min >= 60) return `Dans ${min / 60} h`;
  return `Dans ${min} min`;
}

/** Date de l'anniversaire l'année y (le 29 février se fête le 28 les autres années). */
export function birthdayIn(e, y) {
  let md = e.date.slice(5);
  if (md === '02-29' && new Date(Date.UTC(y, 1, 29)).getUTCMonth() !== 1) md = '02-28';
  return `${y}-${md}`;
}

export function age(e, key) {
  const n = Number(key.slice(0, 4)) - Number(e.date.slice(0, 4));
  return n > 0 ? (n === 1 ? '1 an' : `${n} ans`) : '';
}

export const birthdayTitle = (e) => (/^anniv/i.test(e.title) ? e.title : `Anniversaire de ${e.title}`);

/** Les personnes concernées : le propriétaire, ou les deux pour « Nous ». */
export function recipients(house, owner) {
  const members = house.members ?? [];
  return owner === 'both' || !members.includes(owner) ? members : [owner];
}

// --- Ce qu'il faut envoyer pour un foyer ---

export function dueReminders(house, events, tasks, now) {
  const today = todayZurich(new Date(now));
  const near = new Set([addDays(today, -1), today, addDays(today, 1), addDays(today, 2)]);
  const out = [];
  const add = (key, at, uids, title, body) => out.push({ key, at, uids, payload: { title, body, tag: key, url: '/' } });

  for (const e of events) {
    if (e.birthday) {
      for (const day of [today, addDays(today, 1)]) {
        const on = birthdayIn(e, Number(day.slice(0, 4)));
        if (on !== day || e.date > on) continue;
        const a = age(e, on);
        add(`bday-${e.id}-${on}`, zurich(on, '08:00'), house.members, `🎂 ${birthdayTitle(e)} aujourd’hui`, a ? `${a} !` : 'Pense à lui souhaiter !');
        add(`bday-eve-${e.id}-${on}`, zurich(addDays(on, -1), '19:00'), house.members, `Demain : ${birthdayTitle(e).charAt(0).toLowerCase()}${birthdayTitle(e).slice(1)}`, a ? `${a} · ${dayLabel(on)}` : dayLabel(on));
      }
      continue;
    }
    if (e.vacation) {
      if (near.has(e.date)) {
        add(`vac-${e.id}-${e.date}`, zurich(addDays(e.date, -1), '19:00'), recipients(house, e.owner), `🏖️ Demain, c’est parti : ${e.title}`,
          `${dayLabel(e.date)} → ${dayLabel(e.dateEnd ?? e.date)}`);
      }
      continue;
    }
    if (!near.has(e.date)) continue;
    const remind = e.remind ?? DEFAULT_REMIND;
    if (!remind) continue;
    if (e.start) {
      add(`ev-${e.id}-${remind}`, zurich(e.date, e.start) - remind * 60000, recipients(house, e.owner),
        `${remindLabel(remind)} · ${e.title}`, [`${remind >= 1440 ? dayLabel(e.date) + ' ' : ''}${e.start}${e.end ? `–${e.end}` : ''}`, e.place].filter(Boolean).join(' · '));
    } else {
      add(`ev-${e.id}-day`, zurich(e.date, '08:00'), recipients(house, e.owner), `Aujourd’hui · ${e.title}`, e.place || 'Toute la journée');
    }
  }

  for (const t of tasks) {
    if (t.done || !t.due || !t.time || !near.has(t.due)) continue;
    add(`task-${t.id}-${t.due}-${t.time}`, zurich(t.due, t.time), recipients(house, t.owner), `À faire · ${t.title}`, `${t.time}`);
  }

  // Résumé du matin, pour chacun : ses rendez-vous et ses tâches du jour.
  for (const uid of house.members ?? []) {
    const mine = (o) => o === uid || o === 'both';
    const evs = events.filter((e) => mine(e.owner) && !e.birthday && !e.vacation && e.date === today);
    const bds = events.filter((e) => e.birthday && birthdayIn(e, Number(today.slice(0, 4))) === today && e.date <= today);
    const tks = tasks.filter((t) => mine(t.owner) && !t.done && t.due && t.due <= today);
    if (!evs.length && !tks.length && !bds.length) continue;
    const parts = [];
    if (evs.length) parts.push(`${evs.length} rendez-vous`);
    if (tks.length) parts.push(`${tks.length} tâche${tks.length > 1 ? 's' : ''}`);
    if (bds.length) parts.push(`🎂 ${bds.map((b) => b.title).join(', ')}`);
    const first = evs.filter((e) => e.start).sort((a, b) => a.start.localeCompare(b.start))[0];
    add(`digest-${uid}-${today}`, zurich(today, '07:30'), [uid], `☀️ Ta journée : ${parts.join(' · ')}`,
      first ? `Premier rendez-vous : ${first.start} · ${first.title}` : 'Bonne journée !');
  }
  return out;
}

