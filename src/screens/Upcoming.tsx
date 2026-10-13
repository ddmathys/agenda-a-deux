import { useState } from 'react';
import { addDays, dayGroupTitle, fromKey, isoWeek, keyOf, mondayOf, shortDate, todayKey } from '../dates';
import { ageOn, eventsOn, stayOn } from '../birthday';
import { toggleTask } from '../data';
import { toneOf } from '../tones';
import type { EventItem, Household, Task } from '../types';
import { Avatar, BirthdayMark, Check, Empty, Icon, RepeatMark, VacationMark } from '../ui';

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
    eventsOn(events, k).forEach((e) => set.add(e.owner));
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
      evs: eventsOn(events, k).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? '')),
      tks: tasks.filter((t) => t.due === k),
    }))
    .filter((g) => g.evs.length + g.tks.length > 0);

  return (
    <div className="screen">
      <header className="page-head center">
        <div className="col gap2">
          <span className="kicker" style={{ color: '#C2410C' }}>Semaine {isoWeek(monday)}</span>
          <h1>À venir</h1>
        </div>
        <div className="row gap8">
          <button className="sq-btn" aria-label="Semaine précédente" onClick={() => goWeek(-1)}>{Icon.left}</button>
          <button className="sq-btn dark" aria-label="Semaine suivante" onClick={() => goWeek(1)}>{Icon.right}</button>
        </div>
      </header>

      <div className="strip" role="group" aria-label="Jours de la semaine">
        {week.map((k, i) => {
          const on = k === sel;
          return (
            <button
              key={k}
              className={`strip-day${on ? ' sel' : k === today ? ' on' : k < today ? ' past' : ''}`}
              onClick={() => setSel(k)}
              aria-label={`Voir le ${shortDate(k)}`}
              aria-pressed={on}
            >
              <span className="strip-l">{LETTERS[i]}</span>
              <span className="strip-n">{fromKey(k).getDate()}</span>
              <span className="dots">
                {ownersOn(k).map((o) => <span key={o} className="dot" style={{ background: toneOf(h, o).c }} />)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="col gap18">
        {groups.length === 0 && <Empty>Rien de prévu sur les 7 jours à partir d’ici.</Empty>}
        {groups.map((g) => (
          <section key={g.k} className="day-group">
            <div className="day-badge" aria-hidden="true">
              <span className="day-badge-n">{fromKey(g.k).getDate()}</span>
              <span className="day-badge-m">{shortDate(g.k).split(' ')[1]}</span>
            </div>
            <div className="col gap8 grow min0">
              <h2 className="day-title">{dayGroupTitle(g.k)}<span className="sr-only"> {shortDate(g.k)}</span></h2>
              {g.evs.map((e) => {
                const t = toneOf(h, e.owner);
                return (
                  <button key={e.id} className="ev-card" style={{ background: t.s }} onClick={() => onEditEvent(e)}>
                    <span className="ev-hour">{e.start ?? 'Jour'}</span>
                    <span className="col grow min0 gap2">
                      <span className="ev-title row gap6 center">
                        <span className="ell">{e.title}</span>
                        {e.seriesId && <RepeatMark />}
                        {e.birthday && <BirthdayMark />}
                        {e.vacation && <VacationMark />}
                      </span>
                      <span className="ev-meta" style={{ color: t.t }}>
                        {[e.birthday && ageOn(e, g.k), e.dateEnd && stayOn(e, g.k), e.end && `jusqu’à ${e.end}`, e.place].filter(Boolean).join(' · ') || t.name}
                      </span>
                    </span>
                    <Avatar h={h} owner={e.owner} size={30} />
                  </button>
                );
              })}
              {g.tks.length > 0 && (
                <div className="card-list">
                  {g.tks.map((tk) => {
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
          </section>
        ))}
      </div>
    </div>
  );
}
