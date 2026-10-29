import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { addDays, cap, DAYS, fromKey, keyOf, mondayOf, MONTHS_SHORT, shortDate } from '../dates';
import { ageOn, eventsOn, stayOn } from '../birthday';
import { addTask, toggleTask } from '../data';
import { ownerChoices, partnerUid, toneOf } from '../tones';
import type { EventItem, Household, Task } from '../types';
import { Avatar, BirthdayMark, Check, Icon, RepeatMark, VacationMark, type Tab } from '../ui';
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

/** « MER 28 OCT · 18:20 » */
const stamp = (d: Date) => `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()].replace('.', '')} · ${hm(d)}`.toUpperCase();

/** L'heure qui avance : rafraîchie chaque demi-minute et au retour dans l'app. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 30000);
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

interface Props {
  h: Household;
  me: string;
  events: EventItem[];
  tasks: Task[];
  onTab: (t: Tab, day?: string) => void;
  onAdd: (date: string) => void;
  onShare: () => void;
  forecast: Forecast | null;
  onProfile: () => void;
  onCoco: (question: string) => void;
  onEditTask: (t: Task) => void;
  onEditEvent: (e: EventItem) => void;
}

export function Today({ h, me, events, tasks, onTab, onAdd, onShare, forecast, onProfile, onCoco, onEditTask, onEditEvent }: Props) {
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

  // La semaine en cours, du lundi au dimanche.
  const week = Array.from({ length: 7 }, (_, i) => keyOf(addDays(mondayOf(now), i)));
  const weekCount = week.reduce((n, k) => n + evOn(k).filter((e) => !e.birthday).length, 0);

  // L'agenda : aujourd'hui, demain, puis chaque jour jusqu'au dimanche (le dimanche : aussi lundi).
  const toSunday = (7 - now.getDay()) % 7;
  const days = Array.from({ length: Math.max(2, toSunday + 1) }, (_, i) => keyOf(addDays(now, i)));
  const lastDay = days[days.length - 1];

  const taskOrder = (a: Task, b: Task) =>
    Number(a.done) - Number(b.done) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || (a.time ?? '99').localeCompare(b.time ?? '99');
  // Aujourd'hui reçoit aussi les tâches en retard ; « À faire » garde celles sans date ou plus tard.
  const tasksOn = (k: string) => tasks.filter((t) => visible(t) && !!t.due && (k === today ? t.due <= today : t.due === k)).sort(taskOrder);
  const tkOther = tasks.filter((t) => visible(t) && (!t.due || t.due > lastDay)).sort(taskOrder);
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
  const freeDay = days.slice(1).find((k) => evOn(k).every((e) => e.birthday));

  return (
    <div className="screen dash">
      <header className="d-head">
        <div className="row between center">
          <span className="d-stamp">{stamp(now)}</span>
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

      <section className="d-coco" aria-labelledby="coco-point">
        <div className="row center gap8">
          <span className="d-coco-face" aria-hidden="true">🐥</span>
          <span id="coco-point" className="d-coco-kicker">Le point de Coco</span>
        </div>
        <p className="d-coco-text">
          <CocoPoint h={h} me={me} days={days} evOn={evOn} nowHM={hm(now)} evening={evening} freeDay={freeDay} />
        </p>
        <div className="row gap8 wrap">
          <button className="d-btn primary" onClick={() => onCoco(`Trouve-moi une activité pour ${freeDay ? dayDate(freeDay) : 'ce week-end'}`)}>
            Idées pour {freeDay ? (freeDay === days[1] ? 'demain' : DAYS[fromKey(freeDay).getDay()]) : 'le week-end'}
          </button>
          <button className="d-btn" onClick={() => onCoco('Fais-moi le résumé de notre semaine')}>Résumé de la semaine</button>
        </div>
      </section>

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

      <section className="col gap12">
        <div className="d-sec">
          <h2>Cette semaine</h2>
          <span className="d-mono">{weekCount} rendez-vous</span>
        </div>
        <div className="d-week">
          {week.map((k, i) => {
            const owners = [...new Set(evOn(k).map((e) => e.owner))].slice(0, 3);
            const cls = k === today ? 'd-wday today' : k < today ? 'd-wday past' : 'd-wday';
            return (
              <button key={k} className={cls} onClick={() => onTab('upcoming', k)} aria-label={`${dayDate(k)} : ${owners.length ? 'voir les rendez-vous' : 'rien de prévu'}`}>
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
        {days.map((k, i) => (
          <DayBlock
            key={k}
            h={h}
            k={k}
            kicker={i === 0 ? 'AUJ.' : i === 1 ? 'DEMAIN' : DAYS[fromKey(k).getDay()].slice(0, 3).toUpperCase()}
            title={i === 0 ? (evening ? 'Ce soir' : 'Aujourd’hui') : i === 1 ? 'Demain' : cap(DAYS[fromKey(k).getDay()])}
            isToday={i === 0}
            evs={evOn(k)}
            tks={tasksOn(k)}
            today={today}
            nowM={i === 0 ? nowM : undefined}
            weather={forecast?.[k]}
            onAdd={() => onAdd(k)}
            onCoco={() => onCoco(`Trouve-moi une activité pour ${i === 0 ? 'aujourd’hui' : i === 1 ? 'demain' : dayDate(k)}`)}
            onEditEvent={onEditEvent}
            onEditTask={onEditTask}
          />
        ))}
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
function DayBlock({ h, k, kicker, title, isToday, evs, tks, today, nowM, weather, onAdd, onCoco, onEditEvent, onEditTask }: {
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
  const free = evs.every((e) => e.birthday) && !tks.some((t) => !t.done);

  return (
    <section className={isToday ? 'd-day today' : 'd-day'} aria-label={`${title}, ${dayDate(k)}`}>
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
                  <span className="col grow min0 gap2">
                    <span className="d-title row gap6 center">
                      <span className="ell">{e.title}</span>
                      {e.birthday && <BirthdayMark />}
                      {e.vacation && <VacationMark />}
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
