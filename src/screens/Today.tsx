import { useEffect, useState, type FormEvent } from 'react';
import { addDays, cap, DAYS, dueLabel, fromKey, keyOf, mondayOf, MONTHS, MONTHS_SHORT, shortDate } from '../dates';
import { ageOn, eventsOn, stayOn } from '../birthday';
import { addTask, toggleTask } from '../data';
import { ownerChoices, partnerUid, toneOf } from '../tones';
import type { EventItem, Household, Task } from '../types';
import { Avatar, BirthdayMark, Check, Icon, RepeatMark, VacationMark, type Tab } from '../ui';
import { isNice, wmo, type DayWeather, type Forecast } from '../weather';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** « Mardi 13 octobre » */
const longDate = (k: string) => {
  const d = fromKey(k);
  return `${cap(DAYS[d.getDay()])} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** « mercredi 28 oct. » */
const dayDate = (k: string) => {
  const d = fromKey(k);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
/** Fin d'un rendez-vous en minutes : l'heure de fin, sinon une heure après le début. */
const endMins = (e: EventItem) => (e.end && mins(e.end) > mins(e.start!) ? mins(e.end) : mins(e.start!) + 60);

/** « Dans 45 min », « Dans 2 h 05 » */
function inLabel(m: number) {
  if (m < 60) return `Dans ${Math.max(1, m)} min`;
  const r = m % 60;
  return `Dans ${Math.floor(m / 60)} h${r ? ` ${String(r).padStart(2, '0')}` : ''}`;
}

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
  const tomorrow = keyOf(addDays(now, 1));
  const nowM = now.getHours() * 60 + now.getMinutes();
  const keep = (o: string) => filter === 'all' || o === filter;

  const monday = mondayOf(now);
  const week = Array.from({ length: 7 }, (_, i) => keyOf(addDays(monday, i)));
  const ownersOn = (k: string) => {
    const set = new Set<string>();
    eventsOn(events, k).forEach((e) => set.add(e.owner));
    tasks.filter((t) => t.due === k && !t.done).forEach((t) => set.add(t.owner));
    return [...set].slice(0, 3);
  };

  const evToday = eventsOn(events, today).filter((e) => keep(e.owner)).sort(byStart);
  const evTomorrow = eventsOn(events, tomorrow).filter((e) => keep(e.owner)).sort(byStart);
  const visible = (t: Task) => keep(t.owner) && (!t.done || t.doneOn === today);
  const taskOrder = (a: Task, b: Task) =>
    Number(a.done) - Number(b.done) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || (a.time ?? '99').localeCompare(b.time ?? '99');
  // Aujourd'hui : en retard + du jour ; Demain : celles du lendemain ; le reste dans « À faire ».
  const tkToday = tasks.filter((t) => visible(t) && !!t.due && t.due <= today).sort(taskOrder);
  const tkTomorrow = tasks.filter((t) => visible(t) && t.due === tomorrow).sort(taskOrder);
  const tkOther = tasks.filter((t) => visible(t) && (!t.due || t.due > tomorrow)).sort(taskOrder);

  // Le week-end à venir, sans répéter les jours déjà affichés (aujourd'hui, demain).
  const dow = now.getDay();
  const sat = addDays(now, dow === 6 ? 7 : dow === 0 ? 6 : 6 - dow);
  const wk = [keyOf(sat), keyOf(addDays(sat, 1))].filter((k) => k > tomorrow);
  const wkEvents = (k: string) => eventsOn(events, k).filter((e) => keep(e.owner)).sort(byStart);
  const wkBusy = wk.reduce((n, k) => n + wkEvents(k).filter((e) => !e.birthday).length, 0);
  const wkTitle = dow >= 1 && dow <= 5 ? (wk.length === 1 ? 'Et dimanche' : 'Ce week-end') : 'Le week-end prochain';
  const wkW = wk.map((k) => forecast?.[k]).filter((w): w is DayWeather => !!w);
  const wkNice = wk.filter((k) => forecast?.[k] && isNice(forecast[k]));
  let wkSky = '';
  if (wkW.length === wk.length && wk.length) {
    if (wkNice.length === wk.length) wkSky = ' et il va faire beau ☀️';
    else if (!wkNice.length) wkSky = ` et ça s’annonce ${wmo(wkW[0].code).label} ${wmo(wkW[0].code).emoji}`;
    else wkSky = `, ${DAYS[fromKey(wkNice[0]).getDay()]} sera le plus beau ${wmo(forecast![wkNice[0]].code).emoji}`;
  }
  const wkMood = `${wkBusy ? `Vous avez ${wkBusy} rendez-vous` : 'Rien de prévu pour l’instant'}${wkSky}.`;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    await addTask(h.id, me, { title, list: h.lists[0]?.id ?? 'maison', due: null, time: null, owner: filter === 'all' ? 'both' : filter });
  };
  const partner = partnerUid(h, me);

  const pills = [{ id: 'all', label: 'Tout' }, ...ownerChoices(h, me)];

  return (
    <div className="screen">
      <header className="hello">
        <span className="deco-a" aria-hidden="true" />
        <span className="deco-b" aria-hidden="true" />
        <div className="col gap2 rel">
          <span className="hello-date">{longDate(today)}</span>
          <h1 className="hello-title">{now.getHours() >= 18 || now.getHours() < 5 ? 'Bonsoir' : 'Bonjour'}<br />{h.people[me]?.name}</h1>
          <span className="version">{__APP_VERSION__}</span>
        </div>
        <div className="col rel hello-side">
          <div className="row center gap8">
            <button className="row hello-avs plain" onClick={onProfile} aria-label="Profil : lieu, partage, déconnexion">
              <Avatar h={h} owner={me} size={40} />
              {partner && <span className="overlap"><Avatar h={h} owner={partner} size={40} /></span>}
            </button>
          </div>
          {!partner && (
            <button className="invite-chip" onClick={onShare} title="Ta moitié n’est pas encore là">
              {Icon.share}Inviter ta moitié
            </button>
          )}
        </div>
      </header>

      <Focus h={h} today={evToday} tomorrow={evTomorrow} nowM={nowM} onOpen={onEditEvent} />

      <div className="pills" role="group" aria-label="Filtrer par personne">
        {pills.map((p) => {
          const on = p.id === filter;
          const tone = p.id !== 'all' ? toneOf(h, p.id) : null;
          return (
            <button key={p.id} className={on ? 'pill on' : 'pill'} onClick={() => setFilter(p.id)} aria-pressed={on}>
              {tone && <span className="pill-dot" style={{ background: tone.c }} />}
              {p.label}
            </button>
          );
        })}
      </div>

      <DayPlan
        h={h} k={today} title="Aujourd’hui" main evs={evToday} tks={tkToday} nowM={nowM} nowHM={hm(now)} today={today} weather={forecast?.[today]}
        onAdd={() => onAdd(today)} onCoco={() => onCoco('Trouve-moi une activité pour aujourd’hui')} onEditEvent={onEditEvent} onEditTask={onEditTask}
      />
      <DayPlan
        h={h} k={tomorrow} title="Demain" evs={evTomorrow} tks={tkTomorrow} today={today} weather={forecast?.[tomorrow]}
        onAdd={() => onAdd(tomorrow)} onCoco={() => onCoco('Trouve-moi une activité pour demain')} onEditEvent={onEditEvent} onEditTask={onEditTask}
      />

      {wk.length > 0 && (
        <section className={wkW.length && wkNice.length ? 'weekend sunny' : 'weekend'}>
          <div className="weekend-head">
            <h2>{wkTitle} {wkNice.length ? '😎' : '🎈'}</h2>
            <p className="weekend-mood">{wkMood}</p>
          </div>
          {wk.map((k) => (
            <DayPlan
              key={k} sub h={h} k={k} title={cap(DAYS[fromKey(k).getDay()])} evs={wkEvents(k)}
              tks={tasks.filter((t) => visible(t) && t.due === k)} today={today} weather={forecast?.[k]}
              onAdd={() => onAdd(k)} onCoco={() => onCoco(`Trouve-moi une activité pour ${dayDate(k)}`)} onEditEvent={onEditEvent} onEditTask={onEditTask}
            />
          ))}
        </section>
      )}

      <section className="col gap10">
        <div className="section-head">
          <h2>À faire</h2>
          <span className="sub">sans date ou plus tard</span>
        </div>
        <div className="card-list">
          {tkOther.map((t) => (
            <div key={t.id} className="task-row">
              <Check h={h} task={t} onToggle={() => toggleTask(h.id, t)} />
              <button className={t.done ? 'task-title done' : 'task-title'} onClick={() => onEditTask(t)}>{t.title}</button>
              {t.due && <span className="chip" style={{ background: '#FFF3CC', color: '#7A5500' }}>{dueLabel(t.due)}</span>}
            </div>
          ))}
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
 * La grande carte du haut : ce qui se passe maintenant, ou le prochain rendez-vous
 * avec le temps qu'il reste. En fin de journée, elle annonce le premier rendez-vous de demain.
 */
function Focus({ h, today, tomorrow, nowM, onOpen }: {
  h: Household; today: EventItem[]; tomorrow: EventItem[]; nowM: number;
  onOpen: (e: EventItem) => void;
}) {
  const timed = today.filter((e) => e.start);
  const cur = timed.find((e) => mins(e.start!) <= nowM && nowM < endMins(e));
  const next = timed.find((e) => mins(e.start!) > nowM);
  const first = tomorrow.find((e) => e.start) ?? tomorrow[0];
  const where = (e: EventItem) => [e.place, toneOf(h, e.owner).name].filter(Boolean).join(' · ');

  const card = (e: EventItem, kicker: string, meta: string, progress?: number) => {
    const t = toneOf(h, e.owner);
    return (
      <button className="focus" style={{ background: t.c, color: t.on }} onClick={() => onOpen(e)}>
        <span className="focus-kicker">{kicker}</span>
        <span className="focus-title">{e.title}</span>
        <span className="focus-meta">{meta}</span>
        {progress !== undefined && (
          <span className="focus-bar" aria-hidden="true"><span style={{ width: `${Math.round(progress * 100)}%` }} /></span>
        )}
      </button>
    );
  };

  if (cur) {
    const s = mins(cur.start!);
    const left = endMins(cur) - nowM;
    return card(
      cur,
      `En ce moment · ${inLabel(left).replace('Dans', 'encore')}`,
      [`${cur.start}${cur.end ? `–${cur.end}` : ''}`, where(cur)].join(' · '),
      (nowM - s) / (endMins(cur) - s),
    );
  }
  if (next) {
    return card(next, `${inLabel(mins(next.start!) - nowM)} · à ${next.start}`, [next.end && `jusqu’à ${next.end}`, where(next)].filter(Boolean).join(' · '));
  }
  if (first && nowM >= 17 * 60) {
    return card(first, first.start ? `Demain à ${first.start}` : 'Demain', where(first));
  }
  // Rien en cours ni à venir : les blocs Aujourd'hui / Demain suffisent.
  return null;
}

/** Le programme d'un jour : rendez-vous dans l'ordre, la ligne « maintenant », puis les tâches. */
function DayPlan({ h, k, title, main = false, sub = false, evs, tks, nowM, nowHM, today, weather, onAdd, onCoco, onEditEvent, onEditTask }: {
  h: Household; k: string; title: string; main?: boolean; sub?: boolean; evs: EventItem[]; tks: Task[]; nowM?: number; nowHM?: string; today: string; weather?: DayWeather;
  onAdd: () => void; onCoco?: () => void; onEditEvent: (e: EventItem) => void; onEditTask: (t: Task) => void;
}) {
  const allDay = evs.filter((e) => !e.start);
  const timed = evs.filter((e) => e.start);
  const status = (e: EventItem) => {
    if (nowM === undefined || !e.start) return '';
    if (endMins(e) <= nowM) return 'past';
    return mins(e.start) <= nowM ? 'now' : '';
  };
  // La ligne « maintenant » se place avant le premier rendez-vous pas encore terminé.
  let nowAt = -1;
  if (nowM !== undefined && timed.length) {
    nowAt = timed.findIndex((e) => endMins(e) > nowM);
    if (nowAt === -1) nowAt = timed.length;
  }
  const open = tks.filter((t) => !t.done).length;
  const count = [evs.length && `${evs.length} rendez-vous`, open && `${open} ${open > 1 ? 'tâches' : 'tâche'}`].filter(Boolean).join(' · ');

  const evRow = (e: EventItem) => {
    const t = toneOf(h, e.owner);
    const st = status(e);
    return (
      <button key={e.id} className={`plan-row ${st}`} style={st === 'now' ? { background: t.s } : undefined} onClick={() => onEditEvent(e)}>
        <span className="plan-time">
          <b>{e.start ?? 'Jour'}</b>
          {e.end && <small>{e.end}</small>}
        </span>
        <span className="plan-bar" style={{ background: t.c }} />
        <span className="col grow min0 gap2">
          <span className="ev-title row gap6 center">
            <span className="ell">{e.title}</span>
            {e.seriesId && <RepeatMark />}
            {e.birthday && <BirthdayMark />}
            {e.vacation && <VacationMark />}
          </span>
          <span className="ev-meta">{[e.birthday && ageOn(e, k), e.dateEnd && stayOn(e, k), e.place].filter(Boolean).join(' · ') || t.name}</span>
        </span>
        {st === 'now' ? <span className="now-chip">En cours</span> : <Avatar h={h} owner={e.owner} size={28} soft />}
      </button>
    );
  };

  return (
    <section className={main ? 'plan main' : sub ? 'plan sub' : 'plan'}>
      <div className="plan-head">
        <div className="col min0">
          <h2>{title}</h2>
          <span className="plan-date">{dayDate(k)}{count && ` · ${count}`}</span>
        </div>
        {weather && (
          <span className="wx" title={wmo(weather.code).label}>
            <span className="wx-ico" aria-hidden="true">{wmo(weather.code).emoji}</span>
            <span className="col">
              <b>{weather.tmax}°</b>
              <small>{weather.rain >= 30 ? `💧${weather.rain} %` : `${weather.tmin}°`}</small>
            </span>
            <span className="sr-only">{wmo(weather.code).label}</span>
          </span>
        )}
        <button className="plan-add" onClick={onAdd} aria-label={`Ajouter pour ${title.toLowerCase()}`}>{Icon.plusSm}</button>
      </div>
      <div className="plan-card">
        {evs.length + tks.length === 0 && <p className="plan-empty">Rien de prévu pour l’instant.</p>}
        {allDay.map(evRow)}
        {timed.map((e, i) => [i === nowAt && <NowLine key="now" hm={nowHM!} />, evRow(e)])}
        {nowAt === timed.length && <NowLine hm={nowHM!} />}
        {tks.length > 0 && evs.length > 0 && <div className="plan-sep">À faire</div>}
        {tks.map((t) => {
          const late = !!t.due && t.due < today && !t.done;
          const tone = toneOf(h, t.owner);
          return (
            <div key={t.id} className="task-row">
              <Check h={h} task={t} onToggle={() => toggleTask(h.id, t)} />
              <button className={t.done ? 'task-title done' : 'task-title'} onClick={() => onEditTask(t)}>{t.title}</button>
              {late ? (
                <span className="chip" style={{ background: '#FFE3E7', color: '#A81D33' }}>En retard</span>
              ) : (
                <span className="chip" style={{ background: tone.s, color: tone.t }}>{t.time ?? tone.name}</span>
              )}
            </div>
          );
        })}
        {onCoco && evs.every((e) => e.birthday) && (
          <button className="plan-ideas" onClick={onCoco}><span aria-hidden="true">🐥</span>Trouve-moi une activité</button>
        )}
      </div>
    </section>
  );
}

function NowLine({ hm }: { hm: string }) {
  return (
    <div className="now-line" role="note" aria-label={`Il est ${hm}`}>
      <span>{hm}</span>
    </div>
  );
}
