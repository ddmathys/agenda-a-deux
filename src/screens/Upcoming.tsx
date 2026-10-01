import { useState } from 'react';
import { addDays, dayGroupTitle, fromKey, isoWeek, keyOf, mondayOf, shortDate, todayKey } from '../dates';
import { toggleTask } from '../data';
import { toneOf } from '../tones';
import type { EventItem, Household, Task } from '../types';
import { Avatar, Check, Empty, Icon, RepeatMark } from '../ui';

interface Props {
  h: Household;
  events: EventItem[];
  tasks: Task[];
  onEditTask: (t: Task) => void;
  onEditEvent: (e: EventItem) => void;
}

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function Upcoming({ h, events, tasks, onEditTask, onEditEvent }: Props) {
  const today = todayKey();
  const [sel, setSel] = useState(today);
  const [monday, setMonday] = useState(() => mondayOf(new Date()));

  const ownersOn = (k: string) => {
    const set = new Set<string>();
    events.filter((e) => e.date === k).forEach((e) => set.add(e.owner));
    tasks.filter((t) => t.due === k && !t.done).forEach((t) => set.add(t.owner));
    return [...set].slice(0, 3);
  };

  const week = Array.from({ length: 7 }, (_, i) => keyOf(addDays(monday, i)));
  const goWeek = (n: number) => {
    const m = addDays(monday, n * 7);
    const sunday = keyOf(addDays(m, 6));
    setMonday(m);
    // Semaine courante : on revient sur aujourd'hui ; sinon sur le lundi.
    setSel(keyOf(m) <= today && today <= sunday ? today : keyOf(m));
  };

  // Les 7 jours à partir du jour choisi, en sautant les jours vides.
  const groups = Array.from({ length: 7 }, (_, i) => keyOf(addDays(fromKey(sel), i)))
    .map((k) => ({
      k,
      evs: events.filter((e) => e.date === k).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? '')),
      tks: tasks.filter((t) => t.due === k),
    }))
    .filter((g) => g.evs.length + g.tks.length > 0);

  return (
    <div className="screen">
      <header className="page-head">
        <div className="col gap4">
          <span className="kicker" style={{ color: '#D92B45' }}>Semaine {isoWeek(monday)}</span>
          <h1>À venir</h1>
        </div>
        <div className="row gap8">
          <button className="sq-btn" aria-label="Semaine précédente" onClick={() => goWeek(-1)}>{Icon.left}</button>
          <button className="sq-btn dark" aria-label="Semaine suivante" onClick={() => goWeek(1)}>{Icon.right}</button>
        </div>
      </header>

      <div className="week">
        {week.map((k, i) => {
          const on = k === sel;
          const isToday = k === today;
          const past = k < today;
          return (
            <button
              key={k}
              className={`day${on ? ' on' : isToday ? ' today' : past ? ' past' : ''}`}
              onClick={() => setSel(k)}
              aria-label={`Voir le ${shortDate(k)}`}
              aria-pressed={on}
            >
              <span className="day-l">{LETTERS[i]}</span>
              <span className="day-n">{fromKey(k).getDate()}</span>
              <span className="dots">
                {ownersOn(k).map((o) => <span key={o} className="dot" style={{ background: on ? '#FFFFFF' : toneOf(h, o).c, opacity: past && !on ? 0.45 : 1 }} />)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="col gap16">
        {groups.length === 0 && <Empty>Rien de prévu sur les 7 jours à partir d’ici.</Empty>}
        {groups.map((g) => (
          <section key={g.k} className="col gap8">
            <div className="row gap8 baseline">
              <h2 className="h19">{dayGroupTitle(g.k)}</h2>
              <span className="sub">{shortDate(g.k)}</span>
            </div>
            {g.evs.map((e) => {
              const t = toneOf(h, e.owner);
              return (
                <button key={e.id} className="ev-block" onClick={() => onEditEvent(e)}>
                  <span className="ev-time" style={{ background: t.c }}>
                    <span className="ev-start">{e.start ?? 'Jour'}</span>
                    {e.end && <span className="ev-end">{e.end}</span>}
                  </span>
                  <span className="row grow min0 gap10 center ev-body">
                    <span className="col grow min0 gap2">
                      <span className="ev-title row gap6 center">
                        <span className="ell">{e.title}</span>
                        {e.seriesId && <RepeatMark />}
                      </span>
                      {e.place && <span className="ev-meta row gap4 center">{Icon.pin}{e.place}</span>}
                    </span>
                    <Avatar h={h} owner={e.owner} size={28} soft />
                  </span>
                </button>
              );
            })}
            {g.tks.map((tk) => {
              const t = toneOf(h, tk.owner);
              return (
                <div key={tk.id} className="task-dashed">
                  <Check h={h} task={tk} onToggle={() => toggleTask(h.id, tk)} square />
                  <button className={tk.done ? 'task-title done' : 'task-title'} onClick={() => onEditTask(tk)}>{tk.title}</button>
                  <span className="chip" style={{ background: t.s, color: t.t }}>{tk.time ?? t.name}</span>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
