import { useState } from 'react';
import { addDays, cap, DAYS, fromKey, keyOf, mondayOf, MONTHS, todayKey } from '../dates';
import { ownerChoices, toneOf } from '../tones';
import type { EventItem, Household, Task } from '../types';
import { Icon } from '../ui';

interface Props {
  h: Household;
  me: string;
  events: EventItem[];
  tasks: Task[];
  onEditTask: (t: Task) => void;
  onEditEvent: (e: EventItem) => void;
}

export function Month({ h, me, events, tasks, onEditTask, onEditEvent }: Props) {
  const today = todayKey();
  const [sel, setSel] = useState(today);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const move = (n: number) => {
    const c = new Date(cursor.getFullYear(), cursor.getMonth() + n, 1);
    setCursor(c);
    const now = new Date();
    setSel(c.getFullYear() === now.getFullYear() && c.getMonth() === now.getMonth() ? today : keyOf(c));
  };

  const start = mondayOf(cursor);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const cells: string[] = [];
  for (let d = start; d <= last || cells.length % 7 !== 0; d = addDays(d, 1)) cells.push(keyOf(d));

  const ownersOn = (k: string) => {
    const set = new Set<string>();
    events.filter((e) => e.date === k).forEach((e) => set.add(e.owner));
    tasks.filter((t) => t.due === k && !t.done).forEach((t) => set.add(t.owner));
    return [...set].slice(0, 3);
  };

  const dayEvents = events.filter((e) => e.date === sel).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const dayTasks = tasks.filter((t) => t.due === sel);
  const count = dayEvents.length + dayTasks.length;
  const sd = fromKey(sel);

  // Qui fait quoi cette semaine (tâches datées de lundi à dimanche).
  const mon = keyOf(mondayOf(new Date()));
  const sun = keyOf(addDays(mondayOf(new Date()), 6));
  const weekTasks = tasks.filter((t) => t.due && t.due >= mon && t.due <= sun);
  const split = ownerChoices(h, me).map((c) => ({ ...c, n: weekTasks.filter((t) => t.owner === c.id).length, tone: toneOf(h, c.id) }));

  return (
    <div className="screen">
      <header className="page-head center">
        <div className="col gap4">
          <span className="kicker" style={{ color: '#3451E6' }}>{cursor.getFullYear()}</span>
          <h1>{cap(MONTHS[cursor.getMonth()])}</h1>
        </div>
        <div className="row gap8">
          <button className="sq-btn" aria-label="Mois précédent" onClick={() => move(-1)}>{Icon.left}</button>
          <button className="sq-btn dark" aria-label="Mois suivant" onClick={() => move(1)}>{Icon.right}</button>
        </div>
      </header>

      <div className="month">
        <div className="month-head" aria-hidden="true">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, i) => <span key={i}>{l}</span>)}
        </div>
        <div className="month-grid">
          {cells.map((k) => {
            const d = fromKey(k);
            const inMonth = d.getMonth() === cursor.getMonth();
            const on = k === sel;
            return (
              <button
                key={k}
                className={`mcell${on ? ' on' : k === today ? ' today' : ''}${inMonth ? '' : ' out'}`}
                onClick={() => {
                  setSel(k);
                  if (!inMonth) setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
                }}
                aria-label={`${d.getDate()} ${MONTHS[d.getMonth()]}`}
                aria-pressed={on}
              >
                <span>{d.getDate()}</span>
                <span className="dots sm">
                  {inMonth && ownersOn(k).map((o) => <span key={o} className="dot" style={{ background: on ? '#FFFFFF' : toneOf(h, o).c }} />)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="day-card">
        <div className="section-head">
          <h2 className="h20">{cap(DAYS[sd.getDay()])} {sd.getDate()}</h2>
          <span className="day-count">{count ? `${count} élément${count > 1 ? 's' : ''}` : 'Rien de prévu'}</span>
        </div>
        {count === 0 && (
          <div className="day-item"><span className="mark" style={{ background: '#FFC530' }} /><span className="grow">Journée libre</span></div>
        )}
        {dayEvents.map((e) => {
          const t = toneOf(h, e.owner);
          return (
            <button key={e.id} className="day-item" onClick={() => onEditEvent(e)}>
              <span className="mark" style={{ background: t.soft }} />
              <span className="day-time">{e.start ?? '—'}</span>
              <span className="grow min0 ellipsis">{e.title}</span>
              <span className="who">{t.name}</span>
            </button>
          );
        })}
        {dayTasks.map((tk) => {
          const t = toneOf(h, tk.owner);
          return (
            <button key={tk.id} className="day-item" onClick={() => onEditTask(tk)}>
              <span className="mark" style={{ background: t.soft }} />
              <span className="day-time">{tk.time ?? '—'}</span>
              <span className={`grow min0 ellipsis${tk.done ? ' struck' : ''}`}>{tk.title}</span>
              <span className="who">{t.name}</span>
            </button>
          );
        })}
      </section>

      <section className="white-card col gap12">
        <div className="section-head">
          <h2 className="h18">Qui fait quoi cette semaine</h2>
          <span className="sub">{weekTasks.length} tâche{weekTasks.length > 1 ? 's' : ''}</span>
        </div>
        <div className="split-bar">
          {weekTasks.length === 0 ? <div style={{ flexGrow: 1, background: '#F1E8DA' }} /> :
            split.filter((s) => s.n > 0).map((s) => <div key={s.id} style={{ flexGrow: s.n, background: s.tone.c }} />)}
        </div>
        <div className="row gap16 wrap legend">
          {split.map((s) => (
            <span key={s.id} className="row gap6 center"><span className="legend-dot" style={{ background: s.tone.c }} />{s.tone.name} {s.n}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
