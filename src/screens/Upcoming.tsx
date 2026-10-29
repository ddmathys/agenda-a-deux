import { useState } from 'react';
import { addDays, DAYS, fromKey, isoWeek, keyOf, longLabel, mondayOf, shortDate } from '../dates';
import { eventsOn } from '../birthday';
import { toneOf } from '../tones';
import type { EventItem, Household, Task } from '../types';
import { Icon } from '../ui';
import type { Forecast } from '../weather';
import { DayBlock, useNow } from './Today';

interface Props {
  h: Household;
  events: EventItem[];
  tasks: Task[];
  day?: string; // jour choisi depuis Aujourd'hui
  forecast: Forecast | null;
  onAdd: (date: string) => void;
  onCoco: (question: string) => void;
  onEditTask: (t: Task) => void;
  onEditEvent: (e: EventItem) => void;
}

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function Upcoming({ h, events, tasks, day, forecast, onAdd, onCoco, onEditTask, onEditEvent }: Props) {
  const now = useNow();
  const today = keyOf(now);
  const tomorrow = keyOf(addDays(now, 1));
  const [sel, setSel] = useState(day ?? today);
  const [monday, setMonday] = useState(() => mondayOf(day ? fromKey(day) : new Date()));

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

  // Les 7 jours à partir du jour choisi, présentés comme sur Aujourd'hui.
  const days = Array.from({ length: 7 }, (_, i) => keyOf(addDays(fromKey(sel), i)));

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

      <div className="strip sticky" role="group" aria-label="Jours de la semaine">
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
        {days.map((k) => {
          const d = fromKey(k);
          const when = k === today ? 'aujourd’hui' : k === tomorrow ? 'demain' : longLabel(k).toLowerCase();
          return (
            <DayBlock
              key={k}
              h={h}
              k={k}
              kicker={k === today ? 'AUJ.' : k === tomorrow ? 'DEMAIN' : DAYS[d.getDay()].slice(0, 3).toUpperCase()}
              title={k === today ? 'Aujourd’hui' : k === tomorrow ? 'Demain' : longLabel(k)}
              isToday={k === today}
              evs={eventsOn(events, k).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))}
              tks={tasks.filter((t) => t.due === k)}
              today={today}
              nowM={k === today ? now.getHours() * 60 + now.getMinutes() : undefined}
              weather={forecast?.[k]}
              onAdd={() => onAdd(k)}
              onCoco={() => onCoco(`Trouve-moi une activité pour ${when}`)}
              onEditEvent={onEditEvent}
              onEditTask={onEditTask}
            />
          );
        })}
      </div>
    </div>
  );
}
