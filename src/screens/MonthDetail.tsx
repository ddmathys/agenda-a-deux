import { useState } from 'react';
import { ageOn, eventsOn, stayDays } from '../birthday';
import { cap, DAYS, fromKey, MONTHS, shortDate, todayKey } from '../dates';
import { toggleTask } from '../data';
import { toneOf } from '../tones';
import type { EventItem, Household, Task } from '../types';
import { Avatar, Check, Empty, Icon, RepeatMark } from '../ui';

interface Props {
  h: Household;
  events: EventItem[];
  tasks: Task[];
  year: number;
  month: number; // 0 à 11
  onBack: () => void;
  onMonth: (year: number, month: number) => void;
  onEditEvent: (e: EventItem) => void;
  onEditTask: (t: Task) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Le détail d'un mois du mural : grand calendrier, puis vacances, anniversaires,
 * rendez-vous et tâches du mois. Toucher un jour ne montre que ce jour-là.
 */
export function MonthDetail({ h, events, tasks, year, month, onBack, onMonth, onEditEvent, onEditTask }: Props) {
  const today = todayKey();
  const [day, setDay] = useState<string | null>(null);
  const prefix = `${year}-${pad(month + 1)}`;
  const len = new Date(year, month + 1, 0).getDate();
  const blanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const keys = Array.from({ length: len }, (_, i) => `${prefix}-${pad(i + 1)}`);
  const first = keys[0];
  const last = keys[len - 1];

  const stays = events
    .filter((e) => e.vacation && e.dateEnd && e.date <= last && e.dateEnd >= first)
    .sort((a, b) => a.date.localeCompare(b.date));
  const bdays = keys.flatMap((k) => eventsOn(events, k).filter((e) => e.birthday).map((e) => ({ e, k })));
  const plainOn = (k: string) =>
    eventsOn(events, k).filter((e) => !e.birthday && !e.vacation).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const tasksOn = (k: string) => tasks.filter((t) => t.due === k);

  const shownDays = (day ? [day] : keys).filter((k) => plainOn(k).length + tasksOn(k).length > 0);
  const shownStays = day ? stays.filter((s) => s.date <= day && day <= s.dateEnd!) : stays;
  const shownBdays = day ? bdays.filter((b) => b.k === day) : bdays;

  const go = (n: number) => {
    const d = new Date(year, month + n, 1);
    setDay(null);
    onMonth(d.getFullYear(), d.getMonth());
  };

  return (
    <div className="screen">
      <header className="page-head center">
        <div className="col gap2">
          <button className="back-link" onClick={onBack}>{Icon.left}{year}</button>
          <h1>{cap(MONTHS[month])}</h1>
        </div>
        <div className="row gap8">
          <button className="sq-btn" aria-label="Mois précédent" onClick={() => go(-1)}>{Icon.left}</button>
          <button className="sq-btn dark" aria-label="Mois suivant" onClick={() => go(1)}>{Icon.right}</button>
        </div>
      </header>

      <div className="big-month" role="group" aria-label={`Jours de ${MONTHS[month]}`}>
        {LETTERS.map((l, i) => <span key={i} className="bm-l" aria-hidden="true">{l}</span>)}
        {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
        {keys.map((k, i) => {
          const owners = [...new Set(stays.filter((s) => s.date <= k && k <= s.dateEnd!).map((s) => s.owner))];
          const tones = owners.map((o) => toneOf(h, o).soft);
          const bg = tones.length === 0 ? undefined : tones.length === 1 ? tones[0] : `linear-gradient(135deg, ${tones[0]} 50%, ${tones[1]} 50%)`;
          const dots = [...new Set([...plainOn(k).map((e) => e.owner), ...tasksOn(k).filter((t) => !t.done).map((t) => t.owner)])].slice(0, 3);
          const isBday = bdays.some((b) => b.k === k);
          return (
            <button
              key={k}
              className={`bm-d${k === day ? ' sel' : ''}${k === today ? ' now' : ''}`}
              style={bg ? { background: bg } : undefined}
              onClick={() => setDay(k === day ? null : k)}
              aria-pressed={k === day}
              aria-label={`${cap(DAYS[fromKey(k).getDay()])} ${shortDate(k)}`}
            >
              <span className={isBday ? 'bm-n bday' : 'bm-n'}>{i + 1}</span>
              <span className="dots sm">{dots.map((o) => <span key={o} className="dot" style={{ background: toneOf(h, o).c }} />)}</span>
            </button>
          );
        })}
      </div>

      {day && (
        <button className="vac-line" onClick={() => setDay(null)}>
          {cap(DAYS[fromKey(day).getDay()])} {shortDate(day)} · voir tout le mois
        </button>
      )}

      {shownStays.length > 0 && (
        <section className="col gap8">
          <div className="section-head"><h2>Vacances</h2></div>
          {shownStays.map((e) => {
            const t = toneOf(h, e.owner);
            return (
              <button key={e.id} className="ev-card" style={{ background: t.s }} onClick={() => onEditEvent(e)}>
                <span className="ev-hour">{stayDays(e)} j</span>
                <span className="col grow min0 gap2">
                  <span className="ev-title ell">{e.title}</span>
                  <span className="ev-meta" style={{ color: t.t }}>{shortDate(e.date)} → {shortDate(e.dateEnd!)}{e.place ? ` · ${e.place}` : ''}</span>
                </span>
                <Avatar h={h} owner={e.owner} size={30} />
              </button>
            );
          })}
        </section>
      )}

      {shownBdays.length > 0 && (
        <section className="col gap8">
          <div className="section-head"><h2>Anniversaires</h2></div>
          <div className="card-list">
            {shownBdays.map(({ e, k }) => (
              <button key={e.id} className={`bday-row${k < today ? ' past' : ''}`} onClick={() => onEditEvent(e)}>
                <span className="bday-date">{shortDate(k)}</span>
                <span className="grow min0 ell">{e.title}</span>
                {ageOn(e, k) && <span className="chip" style={{ background: '#FFF0B8', color: '#7A4A00' }}>{ageOn(e, k)}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="col gap8">
        <div className="section-head"><h2>Au programme</h2></div>
        {shownDays.length === 0 && <Empty>{day ? 'Rien d’autre ce jour-là.' : 'Aucun rendez-vous ni tâche ce mois-ci.'}</Empty>}
        {shownDays.map((k) => (
          <div key={k} className="col gap6">
            <span className="md-day">{cap(DAYS[fromKey(k).getDay()])} {shortDate(k)}</span>
            {plainOn(k).map((e) => {
              const t = toneOf(h, e.owner);
              return (
                <button key={e.id} className="ev-card" style={{ background: t.s }} onClick={() => onEditEvent(e)}>
                  <span className="ev-hour">{e.start ?? 'Jour'}</span>
                  <span className="col grow min0 gap2">
                    <span className="ev-title row gap6 center"><span className="ell">{e.title}</span>{e.seriesId && <RepeatMark />}</span>
                    <span className="ev-meta" style={{ color: t.t }}>{[e.end && `jusqu’à ${e.end}`, e.place].filter(Boolean).join(' · ') || t.name}</span>
                  </span>
                  <Avatar h={h} owner={e.owner} size={30} />
                </button>
              );
            })}
            {tasksOn(k).length > 0 && (
              <div className="card-list">
                {tasksOn(k).map((tk) => {
                  const t = toneOf(h, tk.owner);
                  return (
                    <div key={tk.id} className="task-row">
                      <Check h={h} task={tk} onToggle={() => toggleTask(h.id, tk)} />
                      <button className={tk.done ? 'task-title done' : 'task-title'} onClick={() => onEditTask(tk)}>{tk.title}</button>
                      <span className="chip" style={{ background: t.s, color: t.t }}>{tk.time ?? t.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
