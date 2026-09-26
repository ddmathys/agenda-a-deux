import { useState, type FormEvent } from 'react';
import { addTask, toggleTask } from '../data';
import { ownerChoices, toneOf } from '../tones';
import type { Household, Task } from '../types';
import { Check, DueChip, Empty, Icon } from '../ui';

interface Props {
  h: Household;
  me: string;
  tasks: Task[];
  onEditTask: (t: Task) => void;
}

export function Lists({ h, me, tasks, onEditTask }: Props) {
  const [list, setList] = useState(h.lists[0]?.id ?? 'maison');
  const [who, setWho] = useState<string>('all');
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);

  const open = tasks.filter((t) => !t.done);
  const cur = h.lists.find((l) => l.id === list) ?? h.lists[0];
  const inList = tasks.filter((t) => t.list === list);
  const rows = inList
    .filter((t) => who === 'all' || t.owner === who)
    .filter((t) => showDone || !t.done)
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? '9999').localeCompare(b.due ?? '9999'));
  const doneCount = inList.filter((t) => t.done).length;
  const undated = inList.filter((t) => !t.due && !t.done).length;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    await addTask(h.id, me, { title, list, due: null, time: null, owner: who === 'all' ? 'both' : who });
  };

  const choices = [{ id: 'all', label: 'Tous' }, ...ownerChoices(h, me)];

  return (
    <div className="screen">
      <header className="page-head">
        <div className="col gap4">
          <span className="kicker" style={{ color: '#7048E8' }}>{open.length} tâche{open.length > 1 ? 's' : ''} ouverte{open.length > 1 ? 's' : ''}</span>
          <h1>Listes</h1>
        </div>
      </header>

      <div className="lists-grid">
        {h.lists.map((l) => {
          const n = open.filter((t) => t.list === l.id).length;
          return (
            <button
              key={l.id}
              className={l.id === list ? 'list-tile on' : 'list-tile'}
              style={{ background: l.bg, color: l.fg }}
              onClick={() => setList(l.id)}
              aria-pressed={l.id === list}
            >
              <span className="list-icon" style={{ background: l.fg === '#FFFFFF' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.5)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={l.icon} /></svg>
              </span>
              <span className="col gap2 left">
                <span className="list-name">{l.name}</span>
                <span className="list-count">{n} à faire</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="segmented four" role="group" aria-label="Filtrer par personne">
        {choices.map((c) => {
          const on = c.id === who;
          return (
            <button
              key={c.id}
              className={on ? 'on' : ''}
              style={on && c.id !== 'all' ? { color: toneOf(h, c.id).t } : undefined}
              onClick={() => setWho(c.id)}
              aria-pressed={on}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <section className="col gap10">
        <div className="section-head">
          <h2>{cur?.name}</h2>
          <span className="sub">{undated} sans date</span>
        </div>
        <div className="card-list">
          {rows.length === 0 && <Empty>Liste vide.</Empty>}
          {rows.map((t) => (
            <div key={t.id} className="task-row tall">
              <Check h={h} task={t} onToggle={() => toggleTask(h.id, t)} />
              <button className="col grow min0 gap2 plain left" onClick={() => onEditTask(t)}>
                <span className={t.done ? 'task-title done' : 'task-title'}>{t.title}</span>
                <span className="owner-line">{toneOf(h, t.owner).name}</span>
              </button>
              <DueChip h={h} task={t} />
            </div>
          ))}
          <form className="add-inline" onSubmit={add}>
            <span aria-hidden="true">{Icon.plusSm}</span>
            <label className="sr-only" htmlFor="new-task">Nouvelle tâche dans {cur?.name}</label>
            <input id="new-task" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ajouter une tâche…" enterKeyHint="done" />
          </form>
        </div>
        {doneCount > 0 && (
          <button className="link self-start" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Masquer les tâches faites' : `Voir les ${doneCount} tâche${doneCount > 1 ? 's' : ''} faite${doneCount > 1 ? 's' : ''}`}
          </button>
        )}
      </section>
    </div>
  );
}
