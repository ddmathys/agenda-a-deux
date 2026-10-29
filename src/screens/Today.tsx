import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { addDays, cap, DAYS, fromKey, keyOf, mondayOf, MONTHS_SHORT, shortDate } from '../dates';
import { ageOn, eventsOn, stayOn } from '../birthday';
import { addTask, toggleTask } from '../data';
import { ownerChoices, partnerUid, toneOf } from '../tones';
import type { Deadline, EventItem, Household, Task } from '../types';
import { daysTo, keyDate } from '../deadlines';
import { DeadlineRow } from './Deadlines';
import { Avatar, Check, Icon, RepeatMark } from '../ui';
import { wmo, type Forecast } from '../weather';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
/** Fin d'un rendez-vous en minutes : l'heure de fin, sinon une heure après le début. */
const endMins = (e: EventItem) => (e.end && mins(e.end) > mins(e.start!) ? mins(e.end) : mins(e.start!) + 60);

/** « mercredi 28 oct. » */
const dayDate = (k: string) => {
  const d = fromKey(k);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};

/** « MER 28 OCT » */
const stamp = (d: Date) => `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()].replace('.', '')}`.toUpperCase();

/** L'heure qui avance : rafraîchie toutes les 10 secondes et au retour dans l'app. */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 10000);
    const vis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return now;
}

/** Un montant écrit dans le titre d'une tâche : « Léa 23 CHF », « Nathan 100.- », « CHF 45.50 ». */
const AMOUNT = /(?:\bCHF\s*(\d+(?:[.,]\d{1,2})?))|(?:(\d+(?:[.,]\d{1,2})?)\s*(?:CHF\b|chf\b|frs?\b\.?|\.-|\.–))/;
function amountOf(title: string): { rest: string; value: number } | null {
  const m = title.match(AMOUNT);
  if (!m) return null;
  const value = Number((m[1] ?? m[2]).replace(',', '.'));
  const rest = title.replace(m[0], '').replace(/\s+[-–:·]\s*$|^\s*[-–:·]\s+/, '').replace(/\s{2,}/g, ' ').trim();
  return { rest: rest || title, value };
}
const chf = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)} CHF`;

const byStart = (a: EventItem, b: EventItem) => (a.start ?? '').localeCompare(b.start ?? '');

/** Une petite icône selon ce que c'est, devinée d'après le titre. */
const KINDS: [RegExp, string][] = [
  [/m[ée]decin|docteur|dr\.? |p[ée]diatre|h[ôo]pital|vaccin|kin[ée]|physio|ost[ée]o|gyn[ée]co|ophtalmo|pharmacie/i, '🩺'],
  [/dentiste|orthodont/i, '🦷'],
  [/coiff|barbier/i, '✂️'],
  [/resto|restaurant|d[îi]ner|d[ée]jeuner|brunch|souper|repas|pizza|sushi/i, '🍽️'],
  [/ap[ée]ro|bar\b|verre|bi[èe]re|vin\b/i, '🍷'],
  [/\bcaf[ée]/i, '☕'],
  [/courses|migros|coop|lidl|aldi|denner|march[ée]/i, '🛒'],
  [/foot|tennis|padel|gym|fitness|sport|course|running|jogging|v[ée]lo|yoga|piscine|natation|ski|rando|match|entra[îi]nement|muscu/i, '🏃'],
  [/cin[ée]|film/i, '🎬'],
  [/concert|festival|spectacle|th[ée][âa]tre|op[ée]ra/i, '🎵'],
  [/vol\b|avion|a[ée]roport|train|gare|voyage|week-end|weekend/i, '✈️'],
  [/r[ée]union|meeting|call|travail|boulot|bureau|client|rdv pro|entretien|s[ée]minaire|formation|cours\b|examen/i, '💼'],
  [/[ée]cole|cr[èe]che|garderie|maman de jour/i, '🎒'],
  [/garage|voiture|pneus|expertise|contr[ôo]le technique/i, '🚗'],
  [/f[êe]te|soir[ée]e|party|mariage|bapt[êe]me/i, '🎉'],
  [/anniv/i, '🎂'],
  [/v[ée]to|chien|chat\b/i, '🐾'],
  [/m[ée]nage|lessive|rangement|d[ée]m[ée]nagement|bricolage|jardin/i, '🧹'],
  [/banque|imp[ôo]ts|assurance|notaire|admin|papiers|factures?/i, '📄'],
  [/maman|papa|famille|grands?-parents|mamie|papi|parents|beaux-parents/i, '👨‍👩‍👧'],
];
function iconOf(e: EventItem) {
  if (e.birthday) return '🎂';
  if (e.vacation) return '🏖️';
  return KINDS.find(([re]) => re.test(e.title))?.[1] ?? '📌';
}

interface Props {
  h: Household;
  me: string;
  events: EventItem[];
  tasks: Task[];
  onAdd: (date: string) => void;
  onShare: () => void;
  forecast: Forecast | null;
  onProfile: () => void;
  onCoco: (question: string) => void;
  onEditTask: (t: Task) => void;
  onEditEvent: (e: EventItem) => void;
  deadlines: Deadline[];
  onDeadlines: () => void;
  onEditDeadline: (d: Deadline) => void;
}

export function Today({ h, me, events, tasks, deadlines, onDeadlines, onEditDeadline, onAdd, onShare, forecast, onProfile, onCoco, onEditTask, onEditEvent }: Props) {
  const [filter, setFilter] = useState<string>('all');
  const [draft, setDraft] = useState('');
  const now = useNow();
  const today = keyOf(now);
  const nowM = now.getHours() * 60 + now.getMinutes();
  const evening = now.getHours() >= 18 || now.getHours() < 5;
  const keep = (o: string) => filter === 'all' || o === filter;
  const partner = partnerUid(h, me);

  const evOn = (k: string) => eventsOn(events, k).filter((e) => keep(e.owner)).sort(byStart);
  const visible = (t: Task) => keep(t.owner) && (!t.done || t.doneOn === today);

  // La semaine affichée : 0 = celle-ci, 1 = la suivante… (on défile avec les flèches).
  const [wk, setWk] = useState(0);
  const monday = addDays(mondayOf(now), wk * 7);
  const week = Array.from({ length: 7 }, (_, i) => keyOf(addDays(monday, i)));
  const weekCount = week.reduce((n, k) => n + evOn(k).filter((e) => !e.birthday).length, 0);
  const weekTitle = wk === 0 ? 'Cette semaine' : wk === 1 ? 'Semaine prochaine' : `Semaine du ${shortDate(week[0])}`;
  const tomorrow = keyOf(addDays(now, 1));

  // Cette semaine : aujourd'hui, demain, puis chaque jour jusqu'au dimanche (le dimanche : aussi lundi).
  const toSunday = (7 - now.getDay()) % 7;
  const days0 = Array.from({ length: Math.max(2, toSunday + 1) }, (_, i) => keyOf(addDays(now, i)));
  // Les semaines suivantes : du lundi au dimanche.
  const days = wk === 0 ? days0 : week;
  const lastDay = days0[days0.length - 1];

  const taskOrder = (a: Task, b: Task) =>
    Number(a.done) - Number(b.done) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || (a.time ?? '99').localeCompare(b.time ?? '99');
  // Aujourd'hui reçoit aussi les tâches en retard ; « À faire » garde celles sans date ou plus tard.
  const tasksOn = (k: string) => tasks.filter((t) => visible(t) && !!t.due && (k === today ? t.due <= today : t.due === k)).sort(taskOrder);
  const tkOther = tasks.filter((t) => visible(t) && (!t.due || (t.due > lastDay && !days.includes(t.due)))).sort(taskOrder);

  const goWeek = (n: number) => {
    setWk(Math.max(0, wk + n));
    document.getElementById('d-weeksec')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const goDay = (k: string) => {
    if (!days.includes(k)) setWk(Math.round((mondayOf(fromKey(k)).getTime() - mondayOf(now).getTime()) / (7 * 86400000)));
    setTimeout(() => document.getElementById(`day-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const openCount = tkOther.filter((t) => !t.done).length;
  const due = tkOther.reduce((s, t) => s + (!t.done ? amountOf(t.title)?.value ?? 0 : 0), 0);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    await addTask(h.id, me, { title, list: h.lists[0]?.id ?? 'maison', due: null, time: null, owner: filter === 'all' ? 'both' : filter });
  };

  const pills = [{ id: 'all', label: 'Tout' }, ...ownerChoices(h, me)];
  const wToday = forecast?.[today];
  const wNight = forecast?.[keyOf(addDays(now, 1))];

  // Pour le point de Coco : le premier jour sans rendez-vous d'ici dimanche.
  const freeDay = days0.slice(1).find((k) => evOn(k).every((e) => e.birthday));

  // Le point de Coco se ferme d'un « C'est noté » : il revient le lendemain ou si l'agenda change.
  const pointKey = `coco-point-${me}`;
  const pointSig = `${today}|${days0.map((k) => eventsOn(events, k).map((e) => `${e.id}${e.start ?? ''}`).join(',')).join('|')}`;
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(pointKey) ?? '';
    } catch {
      return '';
    }
  });
  const closePoint = () => {
    setSeen(pointSig);
    try {
      localStorage.setItem(pointKey, pointSig);
    } catch {
      /* rien */
    }
  };

  return (
    <div className="screen dash">
      <header className="d-head">
        <div className="row between center">
          <div className="d-now">
            <span className="d-clock">{hm(now)}</span>
            <span className="d-stamp">{stamp(now)}</span>
          </div>
          <div className="row center gap8">
            {!partner && (
              <button className="invite-chip" onClick={onShare} title="Ta moitié n’est pas encore là">
                {Icon.share}Inviter ta moitié
              </button>
            )}
            <button className="row hello-avs plain" onClick={onProfile} aria-label="Profil : lieu, partage, déconnexion">
              <Avatar h={h} owner={me} size={36} />
              {partner && <span className="overlap"><Avatar h={h} owner={partner} size={36} /></span>}
            </button>
          </div>
        </div>
        <h1 className="d-hello">{evening ? 'Bonsoir' : 'Bonjour'}, <em>{h.people[me]?.name}</em></h1>
        {wToday && (
          <button className="d-weather plain" onClick={onProfile}>
            <span aria-hidden="true">{wmo(wToday.code).emoji}</span>
            {wToday.tmax}° {wmo(wToday.code).label.toLowerCase()} · {wNight ? `${Math.min(wToday.tmin, wNight.tmin)}°` : `${wToday.tmin}°`} cette nuit{h.home ? ` · ${h.home.name}` : ''}
          </button>
        )}
        <span className="version">{__APP_VERSION__}</span>
      </header>

      {seen !== pointSig && <section className="d-coco" aria-labelledby="coco-point">
        <div className="row center gap8">
          <span className="d-coco-face" aria-hidden="true">🐥</span>
          <span id="coco-point" className="d-coco-kicker grow">Le point de Coco</span>
          <button className="d-coco-ok" onClick={closePoint}>{Icon.check}C’est noté</button>
        </div>
        <p className="d-coco-text">
          <CocoPoint h={h} me={me} days={days0} evOn={evOn} nowHM={hm(now)} evening={evening} freeDay={freeDay} />
        </p>
        <div className="row gap8 wrap">
          <button className="d-btn primary" onClick={() => onCoco(`Trouve-moi une activité pour ${freeDay ? dayDate(freeDay) : 'ce week-end'}`)}>
            Idées pour {freeDay ? (freeDay === days0[1] ? 'demain' : DAYS[fromKey(freeDay).getDay()]) : 'le week-end'}
          </button>
          <button className="d-btn" onClick={() => onCoco('Fais-moi le résumé de notre semaine')}>Résumé de la semaine</button>
        </div>
      </section>}

      <div className="d-pills" role="group" aria-label="Filtrer par personne">
        {pills.map((p) => {
          const on = p.id === filter;
          const tone = p.id !== 'all' ? toneOf(h, p.id) : null;
          return (
            <button key={p.id} className={on ? 'on' : ''} onClick={() => setFilter(p.id)} aria-pressed={on}>
              {tone && <span className="pill-dot" style={{ background: tone.c }} />}
              {p.label}
            </button>
          );
        })}
      </div>

      <section className="col gap12 d-weeksec" id="d-weeksec">
        <div className="d-sec center">
          <div className="col gap2 grow min0">
            <h2>{weekTitle}</h2>
            <span className="d-mono">{weekCount} rendez-vous</span>
          </div>
          <button className="sq-btn" aria-label="Semaine précédente" onClick={() => goWeek(-1)} disabled={wk === 0}>{Icon.left}</button>
          <button className="sq-btn dark" aria-label="Semaine suivante" onClick={() => goWeek(1)}>{Icon.right}</button>
        </div>
        <div className="d-week">
          {week.map((k, i) => {
            const owners = [...new Set(evOn(k).map((e) => e.owner))].slice(0, 3);
            const cls = k === today ? 'd-wday today' : k < today ? 'd-wday past' : 'd-wday';
            return (
              <button key={k} className={cls} onClick={() => goDay(k)} aria-label={`${dayDate(k)} : ${owners.length ? 'voir les rendez-vous' : 'rien de prévu'}`}>
                <span className="d-wlabel">{LETTERS[i]}</span>
                <span className="d-wnum">{fromKey(k).getDate()}</span>
                <span className="d-dots">
                  {owners.map((o) => <span key={o} style={{ background: k === today ? 'currentColor' : toneOf(h, o).c }} />)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="col gap18">
        {days.map((k) => (
          <DayBlock
            key={k}
            h={h}
            k={k}
            kicker={k === today ? 'AUJ.' : k === tomorrow ? 'DEMAIN' : DAYS[fromKey(k).getDay()].slice(0, 3).toUpperCase()}
            title={k === today ? (evening ? 'Ce soir' : 'Aujourd’hui') : k === tomorrow ? 'Demain' : wk === 0 ? cap(DAYS[fromKey(k).getDay()]) : cap(dayDate(k))}
            isToday={k === today}
            evs={evOn(k)}
            tks={tasksOn(k)}
            today={today}
            nowM={k === today ? nowM : undefined}
            weather={forecast?.[k]}
            onAdd={() => onAdd(k)}
            onCoco={() => onCoco(`Trouve-moi une activité pour ${k === today ? 'aujourd’hui' : k === tomorrow ? 'demain' : dayDate(k)}`)}
            onEditEvent={onEditEvent}
            onEditTask={onEditTask}
          />
        ))}
        <div className="row gap8 wrap">
          {wk > 0 && <button className="d-btn" onClick={() => goWeek(-wk)}>{Icon.left}Cette semaine</button>}
          <button className="d-btn grow d-next" onClick={() => goWeek(1)}>
            {wk === 0 ? 'Semaine prochaine' : `Semaine du ${shortDate(keyOf(addDays(monday, 7)))}`}{Icon.right}
          </button>
        </div>
      </section>

      <section className="col gap12">
        <div className="d-sec center">
          <h2 className="grow">Échéances</h2>
          <button className="d-link" onClick={onDeadlines}>Abos &amp; contrats ({deadlines.length}){Icon.right}</button>
        </div>
        {(() => {
          const soon = deadlines
            .filter((d) => daysTo(keyDate(d, today), today) <= 30)
            .sort((a, b) => keyDate(a, today).localeCompare(keyDate(b, today)))
            .slice(0, 3);
          if (soon.length) return <div className="d-card">{soon.map((d) => <DeadlineRow key={d.id} h={h} d={d} today={today} onOpen={onEditDeadline} />)}</div>;
          return (
            <button className="d-free plain" onClick={onDeadlines}>
              <span>{deadlines.length ? 'Rien à résilier ni à renouveler ce mois-ci.' : 'Abonnements, assurances, contrats : note-les pour ne plus rater une résiliation.'}</span>
              <span className="d-btn soft">{deadlines.length ? 'Voir' : 'Commencer'}</span>
            </button>
          );
        })()}
      </section>

      <section className="col gap12">
        <div className="d-sec">
          <h2>À faire</h2>
          <span className="d-mono">{openCount} ouverte{openCount > 1 ? 's' : ''}{due > 0 && ` · ${chf(due)} à régler`}</span>
        </div>
        <div className="d-card">
          {tkOther.map((t) => <TaskRow key={t.id} h={h} t={t} today={today} onEdit={onEditTask} showDue />)}
          <form className={tkOther.length ? 'add-inline' : 'add-inline first'} onSubmit={add}>
            <span aria-hidden="true">{Icon.plusSm}</span>
            <label className="sr-only" htmlFor="today-task">Nouvelle tâche</label>
            <input id="today-task" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ajouter une tâche…" enterKeyHint="done" />
          </form>
        </div>
      </section>
    </div>
  );
}

/**
 * Le point de Coco, calculé dans l'app : ce qui reste aujourd'hui, demain,
 * le jour le plus chargé d'ici dimanche et le premier jour libre.
 */
function CocoPoint({ h, me, days, evOn, nowHM, evening, freeDay }: {
  h: Household; me: string; days: string[]; evOn: (k: string) => EventItem[]; nowHM: string; evening: boolean; freeDay?: string;
}) {
  const who = (e: EventItem) => (e.owner !== me ? ` (${toneOf(h, e.owner).name})` : '');
  const names = (evs: EventItem[]) => {
    const shown = evs.slice(0, 2).map((e) => `${e.title}${e.start ? ` à ${e.start}` : ''}${who(e)}`);
    if (evs.length > 2) shown.push(`${evs.length - 2} autre${evs.length > 3 ? 's' : ''}`);
    return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} et ${shown[shown.length - 1]}` : shown[0];
  };
  const real = (k: string) => evOn(k).filter((e) => !e.birthday);
  const left = real(days[0]).filter((e) => !e.start || e.start >= nowHM || (e.end ?? '') > nowHM);
  const tmr = real(days[1]);
  const parts: ReactNode[] = [];
  parts.push(left.length ? `${evening ? 'Ce soir' : 'Aujourd’hui'} : ${names(left)}.` : evening ? 'Soirée calme.' : 'Journée calme.');
  parts.push(tmr.length ? ` Demain : ${names(tmr)}.` : ' Demain, rien de prévu.');
  const later = days.slice(2);
  const busiest = later.reduce<string | null>((b, k) => (real(k).length > (b ? real(b).length : 1) ? k : b), null);
  if (busiest) parts.push(` ${cap(DAYS[fromKey(busiest).getDay()])} chargé (${real(busiest).length} rendez-vous).`);
  const bdays = days.flatMap((k) => evOn(k).filter((e) => e.birthday).map((e) => ({ e, k })));
  if (bdays.length) {
    const { e, k } = bdays[0];
    const age = ageOn(e, k);
    parts.push(` 🎂 ${e.title}${age ? ` (${age})` : ''} ${k === days[0] ? 'aujourd’hui' : DAYS[fromKey(k).getDay()]}.`);
  }
  if (freeDay && freeDay !== days[1]) parts.push(<> — <em>{DAYS[fromKey(freeDay).getDay()]} est libre.</em></>);
  return <>{parts}</>;
}

/** Un jour de l'agenda : la date à gauche, les rendez-vous et les tâches du jour à droite. */
export function DayBlock({ h, k, kicker, title, isToday, evs, tks, today, nowM, weather, onAdd, onCoco, onEditEvent, onEditTask }: {
  h: Household; k: string; kicker: string; title: string; isToday: boolean; evs: EventItem[]; tks: Task[]; today: string; nowM?: number;
  weather?: { code: number; tmax: number; tmin: number; rain: number }; onAdd: () => void; onCoco: () => void;
  onEditEvent: (e: EventItem) => void; onEditTask: (t: Task) => void;
}) {
  const status = (e: EventItem) => {
    if (nowM === undefined || !e.start) return '';
    if (endMins(e) <= nowM) return 'past';
    return mins(e.start) <= nowM ? 'now' : '';
  };
  const allDay = evs.filter((e) => !e.start);
  const timed = evs.filter((e) => e.start);
  const free = k >= today && evs.every((e) => e.birthday) && !tks.some((t) => !t.done);

  return (
    <section id={`day-${k}`} className={isToday ? 'd-day today' : 'd-day'} aria-label={`${title}, ${dayDate(k)}`}>
      <div className="d-date">
        <span className="d-kicker">{kicker}</span>
        <span className="d-num">{fromKey(k).getDate()}</span>
      </div>
      <div className="col gap8 grow min0">
        <div className="d-dayhead">
          <span className="d-daytitle">{title}</span>
          {weather && (
            <span className="d-mono" title={wmo(weather.code).label}>
              <span aria-hidden="true">{wmo(weather.code).emoji} </span>
              {weather.tmax}° / {weather.rain >= 30 ? `💧${weather.rain} %` : `${weather.tmin}°`}
              <span className="sr-only">{wmo(weather.code).label}</span>
            </span>
          )}
          <button className="d-add" onClick={onAdd} aria-label={`Ajouter pour ${dayDate(k)}`}>{Icon.plusSm}</button>
        </div>
        {evs.length + tks.length > 0 && (
          <div className="d-card">
            {[...allDay, ...timed].map((e) => {
              const t = toneOf(h, e.owner);
              const st = status(e);
              const time = e.start ? `${e.start}${e.end ? `–${e.end}` : ''}` : e.birthday ? '' : 'Journée';
              const meta = [t.name, time, e.birthday && ageOn(e, k), e.dateEnd && stayOn(e, k), e.place].filter(Boolean).join(' · ');
              return (
                <button key={e.id} className={`d-row ${st}`} onClick={() => onEditEvent(e)}>
                  <span className="d-bar" style={{ background: t.c }} />
                  <span className="d-ico" style={{ background: t.s }} aria-hidden="true">{iconOf(e)}</span>
                  <span className="col grow min0 gap2">
                    <span className="d-title row gap6 center">
                      <span className="ell">{e.title}</span>
                    </span>
                    <span className="d-meta">{meta}</span>
                  </span>
                  {st === 'now' ? <span className="now-chip">En cours</span> : e.seriesId && <RepeatMark />}
                </button>
              );
            })}
            {tks.map((t) => <TaskRow key={t.id} h={h} t={t} today={today} onEdit={onEditTask} />)}
          </div>
        )}
        {free && (
          <div className="d-free">
            <span>Journée libre</span>
            <button className="d-btn soft" onClick={onCoco}><span aria-hidden="true">🐥</span> Trouver une activité</button>
          </div>
        )}
      </div>
    </section>
  );
}

function TaskRow({ h, t, today, onEdit, showDue = false }: { h: Household; t: Task; today: string; onEdit: (t: Task) => void; showDue?: boolean }) {
  const amount = amountOf(t.title);
  const late = !!t.due && t.due < today && !t.done;
  return (
    <div className="task-row d-task">
      <Check h={h} task={t} onToggle={() => toggleTask(h.id, t)} square />
      <button className={t.done ? 'task-title done' : 'task-title'} onClick={() => onEdit(t)}>{amount ? amount.rest : t.title}</button>
      {amount && <span className="d-amount">{chf(amount.value)}</span>}
      {late ? (
        <span className="chip" style={{ background: '#FFE3E7', color: '#A81D33' }}>En retard</span>
      ) : showDue && t.due ? (
        <span className="chip" style={{ background: '#FFF3CC', color: '#7A5500' }}>{shortDate(t.due)}</span>
      ) : !showDue && t.time ? (
        <span className="chip" style={{ background: toneOf(h, t.owner).s, color: toneOf(h, t.owner).t }}>{t.time}</span>
      ) : null}
    </div>
  );
}
