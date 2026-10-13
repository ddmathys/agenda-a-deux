import { useState, type FormEvent } from 'react';
import { addDays, cap, DAYS, fromKey, keyOf, mondayOf, MONTHS, shortDate, todayKey } from '../dates';
import { ageOn, eventsOn, stayOn } from '../birthday';
import { addTask, toggleTask } from '../data';
import { ownerChoices, partnerUid, toneOf } from '../tones';
import type { EventItem, Household, Task } from '../types';
import { Avatar, BirthdayMark, Check, DueChip, Empty, Icon, RepeatMark, VacationMark, type Tab } from '../ui';
import { Countdowns, VacationWidget } from '../widgets';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** « Mardi 13 octobre » */
const longDate = (k: string) => {
  const d = fromKey(k);
  return `${cap(DAYS[d.getDay()])} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

interface Props {
  h: Household;
  me: string;
  events: EventItem[];
  tasks: Task[];
  onTab: (t: Tab) => void;
  onEditTask: (t: Task) => void;
  onEditEvent: (e: EventItem) => void;
}

export function Today({ h, me, events, tasks, onTab, onEditTask, onEditEvent }: Props) {
  const [filter, setFilter] = useState<string>('all');
  const [draft, setDraft] = useState('');
  const today = todayKey();
  const keep = (o: string) => filter === 'all' || o === filter;

  const monday = mondayOf(new Date());
  const week = Array.from({ length: 7 }, (_, i) => keyOf(addDays(monday, i)));
  const ownersOn = (k: string) => {
    const set = new Set<string>();
    eventsOn(events, k).forEach((e) => set.add(e.owner));
    tasks.filter((t) => t.due === k && !t.done).forEach((t) => set.add(t.owner));
    return [...set].slice(0, 3);
  };
  const evs = eventsOn(events, today).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));

  const shownEvents = evs.filter((e) => keep(e.owner));
  // Toutes les tâches ouvertes (+ celles cochées aujourd'hui) : en retard / du jour, puis datées, puis sans date.
  const shownTasks = tasks
    .filter((t) => keep(t.owner) && (!t.done || t.doneOn === today))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || (a.time ?? '99').localeCompare(b.time ?? '99'));

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
          <h1 className="hello-title">Bonjour<br />{h.people[me]?.name}</h1>
          <span className="version">{__APP_VERSION__}</span>
        </div>
        <div className="row rel hello-avs">
          <Avatar h={h} owner={me} size={40} />
          {partner && <span className="overlap"><Avatar h={h} owner={partner} size={40} /></span>}
        </div>
      </header>

      <div className="strip" role="group" aria-label="Cette semaine">
        {week.map((k, i) => (
          <button key={k} className={k === today ? 'strip-day on' : k < today ? 'strip-day past' : 'strip-day'} onClick={() => onTab('upcoming')} aria-label={`Voir le ${shortDate(k)}`}>
            <span className="strip-l">{LETTERS[i]}</span>
            <span className="strip-n">{fromKey(k).getDate()}</span>
            <span className="dots">
              {ownersOn(k).map((o) => <span key={o} className="dot" style={{ background: toneOf(h, o).c }} />)}
            </span>
          </button>
        ))}
      </div>

      <Countdowns events={events} today={today} onOpen={onEditEvent} />
      <VacationWidget h={h} me={me} events={events} year={Number(today.slice(0, 4))} today={today} onClick={() => onTab('year')} />

      {!partner && <Invite code={h.id} />}

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

      <section className="col gap10">
        <div className="section-head">
          <h2>Au programme</h2>
          <button className="link" onClick={() => onTab('upcoming')}>Toute la semaine</button>
        </div>
        {shownEvents.length === 0 && <Empty>Rien au programme aujourd’hui.</Empty>}
        {shownEvents.map((e) => {
          const t = toneOf(h, e.owner);
          return (
            <div key={e.id} className="row">
              <button className="ev-card" style={{ background: t.s }} onClick={() => onEditEvent(e)}>
                <span className="ev-hour">{e.start ?? 'Jour'}</span>
                <span className="col grow min0 gap2">
                  <span className="ev-title row gap6 center">
                    <span className="ell">{e.title}</span>
                    {e.seriesId && <RepeatMark />}
                    {e.birthday && <BirthdayMark />}
                    {e.vacation && <VacationMark />}
                  </span>
                  <span className="ev-meta">{[e.birthday && ageOn(e, today), e.dateEnd && stayOn(e, today), e.end && `jusqu’à ${e.end}`, e.place].filter(Boolean).join(' · ') || t.name}</span>
                </span>
                <Avatar h={h} owner={e.owner} />
              </button>
            </div>
          );
        })}
      </section>

      <section className="col gap10">
        <div className="section-head">
          <h2>Tâches</h2>
        </div>
        <div className="card-list">
          {shownTasks.length === 0 && <Empty>Rien à faire. Profitez-en.</Empty>}
          {shownTasks.map((t) => (
            <div key={t.id} className="task-row">
              <Check h={h} task={t} onToggle={() => toggleTask(h.id, t)} />
              <button className={t.done ? 'task-title done' : 'task-title'} onClick={() => onEditTask(t)}>{t.title}</button>
              <DueChip h={h} task={t} personTone={t.due === today} />
            </div>
          ))}
          <form className="add-inline" onSubmit={add}>
            <span aria-hidden="true">{Icon.plusSm}</span>
            <label className="sr-only" htmlFor="today-task">Nouvelle tâche</label>
            <input id="today-task" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ajouter une tâche…" enterKeyHint="done" />
          </form>
        </div>
      </section>
    </div>
  );
}

function Invite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Rejoins notre agenda à deux : ouvre ${location.origin} et entre le code ${code}`;
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Agenda à deux', text });
      } catch {
        /* partage annulé */
      }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    }
  };
  return (
    <section className="invite">
      <span>Ta moitié n’est pas encore là</span>
      <button className="link" onClick={share}>{Icon.share}{copied ? 'Lien copié' : 'Inviter'}</button>
    </section>
  );
}
