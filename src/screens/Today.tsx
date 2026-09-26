import { useState } from 'react';
import { longLabel, todayKey } from '../dates';
import { toggleTask } from '../data';
import { ownerChoices, partnerUid, toneOf } from '../tones';
import type { EventItem, Household, Task } from '../types';
import { Avatar, Check, DueChip, Empty, Icon, type Tab } from '../ui';

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
  const today = todayKey();
  const keep = (o: string) => filter === 'all' || o === filter;

  const todays = tasks
    .filter((t) => t.due && t.due <= today && (!t.done || t.doneOn === today))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? '').localeCompare(b.due ?? '') || (a.time ?? '99').localeCompare(b.time ?? '99'));
  const doneCount = todays.filter((t) => t.done).length;
  const evs = events.filter((e) => e.date === today).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));

  const shownEvents = evs.filter((e) => keep(e.owner));
  const shownTasks = todays.filter((t) => keep(t.owner));
  const partner = partnerUid(h, me);
  const pills = [{ id: 'all', label: 'Tout' }, ...ownerChoices(h, me)];

  return (
    <div className="screen">
      <section className="hero">
        <div className="hero-sun" />
        <div className="hero-dot" />
        <div className="row between rel">
          <span className="hero-hello">Bonjour {h.people[me]?.name}</span>
          <div className="row">
            <span className="hero-av"><Avatar h={h} owner={me} size={34} /></span>
            {partner && <span className="hero-av overlap"><Avatar h={h} owner={partner} size={34} /></span>}
          </div>
        </div>
        <h1 className="hero-title rel">{longLabel(today)}</h1>
        <div className="rel col gap8">
          <div className="row between hero-stats">
            <span>{todays.length ? `${doneCount} sur ${todays.length} tâches faites` : 'Aucune tâche pour aujourd’hui'}</span>
            <span>{evs.length} rendez-vous</span>
          </div>
          {todays.length > 0 && (
            <div className="segs" aria-hidden="true">
              {todays.map((t, i) => <div key={t.id} className={i < doneCount ? 'seg on' : 'seg'} />)}
            </div>
          )}
        </div>
      </section>

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
          <button className="link" onClick={() => onTab('upcoming')}>Tout voir</button>
        </div>
        {shownEvents.length === 0 && <Empty>Rien au programme aujourd’hui.</Empty>}
        {shownEvents.map((e) => {
          const t = toneOf(h, e.owner);
          return (
            <div key={e.id} className="row gap10 center">
              <div className="time-col">{e.start ?? 'Jour'}</div>
              <button className="ev-card" style={{ background: t.s }} onClick={() => onEditEvent(e)}>
                <span className="col grow min0 gap2">
                  <span className="ev-title">{e.title}</span>
                  <span className="ev-meta">{[e.end && `jusqu’à ${e.end}`, e.place].filter(Boolean).join(' · ') || t.name}</span>
                </span>
                <Avatar h={h} owner={e.owner} />
              </button>
            </div>
          );
        })}
      </section>

      <section className="col gap10">
        <div className="section-head">
          <h2>À faire aujourd’hui</h2>
          <button className="link" onClick={() => onTab('lists')}>Listes</button>
        </div>
        {shownTasks.length === 0 ? (
          <Empty>Rien d’urgent. Profitez-en.</Empty>
        ) : (
          <div className="card-list">
            {shownTasks.map((t) => (
              <div key={t.id} className="task-row">
                <Check h={h} task={t} onToggle={() => toggleTask(h.id, t)} />
                <button className={t.done ? 'task-title done' : 'task-title'} onClick={() => onEditTask(t)}>{t.title}</button>
                <DueChip h={h} task={t} personTone={t.due === today} />
              </div>
            ))}
          </div>
        )}
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
      <div className="col gap2 grow min0">
        <span className="invite-label">Invite ta moitié avec ce code</span>
        <span className="invite-code">{code}</span>
      </div>
      <button className="btn-dark sm" onClick={share}>{Icon.share}{copied ? 'Copié' : 'Partager'}</button>
    </section>
  );
}
