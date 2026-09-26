import { useEffect, useRef, useState, type FormEvent } from 'react';
import { todayKey } from '../dates';
import { addEvent, addTask, deleteEvent, deleteTask, updateEvent, updateTask } from '../data';
import { parseQuick } from '../parse';
import { ownerChoices, toneOf } from '../tones';
import type { EventItem, Household, Task } from '../types';
import { Icon } from '../ui';

export type SheetMode = { kind: 'new' } | { kind: 'task'; task: Task } | { kind: 'event'; ev: EventItem };

interface Props {
  h: Household;
  me: string;
  mode: SheetMode;
  onClose: () => void;
}

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};
const Speech: SpeechCtor | undefined =
  (window as unknown as { SpeechRecognition?: SpeechCtor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: SpeechCtor }).webkitSpeechRecognition;

export function AddSheet({ h, me, mode, onClose }: Props) {
  const isNew = mode.kind === 'new';
  const task = mode.kind === 'task' ? mode.task : null;
  const ev = mode.kind === 'event' ? mode.ev : null;

  const [text, setText] = useState('');
  const [kind, setKind] = useState<'task' | 'event'>(ev ? 'event' : 'task');
  const [title, setTitle] = useState(task?.title ?? ev?.title ?? '');
  const [date, setDate] = useState(task?.due ?? ev?.date ?? '');
  const [start, setStart] = useState(task?.time ?? ev?.start ?? '');
  const [end, setEnd] = useState(ev?.end ?? '');
  const [place, setPlace] = useState(ev?.place ?? '');
  const [owner, setOwner] = useState<string>(task?.owner ?? ev?.owner ?? me);
  const [list, setList] = useState(task?.list ?? h.lists[0]?.id ?? 'maison');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recRef = useRef<InstanceType<SpeechCtor> | null>(null);
  const firstRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      recRef.current?.stop();
    };
  }, []);

  const people = h.members.map((uid) => ({ uid, name: h.people[uid]?.name ?? '' }));

  const applyText = (value: string) => {
    setText(value);
    const p = parseQuick(value, me, people);
    setKind(p.kind);
    setTitle(p.title);
    setDate(p.date ?? '');
    setStart(p.start ?? '');
    setEnd(p.end ?? '');
    if (p.owner) setOwner(p.owner);
    if (p.list && h.lists.some((l) => l.id === p.list)) setList(p.list);
  };

  const dictate = () => {
    if (!Speech) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Speech();
    rec.lang = 'fr-FR';
    rec.interimResults = true;
    rec.onresult = (e) => applyText(Array.from(e.results, (r) => r[0].transcript).join(' '));
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      setError('Donne un titre.');
      return;
    }
    if (kind === 'event' && !date) {
      setError('Un événement a besoin d’une date.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (kind === 'event') {
        const data = { title: t, date, start: start || null, end: (start && end) || null, place: place.trim(), owner };
        if (ev) await updateEvent(h.id, ev.id, data);
        else {
          if (task) await deleteTask(h.id, task.id);
          await addEvent(h.id, me, data);
        }
      } else {
        const data = { title: t, list, due: date || null, time: (date && start) || null, owner };
        if (task) await updateTask(h.id, task.id, data);
        else {
          if (ev) await deleteEvent(h.id, ev.id);
          await addTask(h.id, me, data);
        }
      }
      onClose();
    } catch {
      setError('Impossible d’enregistrer. Réessaie.');
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    if (task) await deleteTask(h.id, task.id);
    if (ev) await deleteEvent(h.id, ev.id);
    onClose();
  };

  const heading = isNew ? 'Ajout rapide' : kind === 'event' ? 'Événement' : 'Tâche';

  return (
    <div className="sheet-wrap" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onSubmit={submit}>
        <div className="grabber" aria-hidden="true" />
        <div className="row between center">
          <h1 id="sheet-title" className="sheet-title">{heading}</h1>
          <button type="button" className="round-btn" aria-label="Fermer" onClick={onClose}>{Icon.close}</button>
        </div>

        {isNew && (
          <div className="col gap6">
            <label htmlFor="quick" className="field-label">Écris comme tu parles</label>
            <div className="rel">
              <textarea
                id="quick"
                ref={firstRef}
                rows={2}
                className="quick"
                value={text}
                onChange={(e) => applyText(e.target.value)}
                placeholder="Appeler la crèche mardi 10h pour Karin"
              />
              {Speech && (
                <button type="button" className={listening ? 'mic on' : 'mic'} aria-label={listening ? 'Arrêter la dictée' : 'Dicter'} onClick={dictate}>
                  {Icon.mic}
                </button>
              )}
            </div>
            {text && (
              <div className="understood">
                <span className="spark">{Icon.spark}</span>
                Compris automatiquement · vérifie avant d’ajouter
              </div>
            )}
          </div>
        )}

        <div className="segmented" role="group" aria-label="Type">
          <button type="button" className={kind === 'task' ? 'on' : ''} onClick={() => setKind('task')} aria-pressed={kind === 'task'}>Tâche</button>
          <button type="button" className={kind === 'event' ? 'on' : ''} onClick={() => setKind('event')} aria-pressed={kind === 'event'}>Événement</button>
        </div>

        <div className="fields">
          <label className="field">
            <span className="field-name">Titre</span>
            <input ref={isNew ? undefined : firstRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quoi ?" />
          </label>
          <label className="field">
            <span className="field-name">Quand</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={isNew ? todayKey() : undefined} />
          </label>
          <div className="field">
            <span className="field-name">Heure</span>
            <span className="row gap6 center">
              <input type="time" aria-label="Début" value={start} onChange={(e) => setStart(e.target.value)} />
              {kind === 'event' && (
                <>
                  <span aria-hidden="true">–</span>
                  <input type="time" aria-label="Fin" value={end} onChange={(e) => setEnd(e.target.value)} />
                </>
              )}
            </span>
          </div>
          {kind === 'event' ? (
            <label className="field">
              <span className="field-name">Où</span>
              <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Lieu (facultatif)" />
            </label>
          ) : (
            <label className="field">
              <span className="field-name">Liste</span>
              <select value={list} onChange={(e) => setList(e.target.value)}>
                {h.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="col gap6">
          <span className="field-label" id="for-label">Pour</span>
          <div className="segmented" role="group" aria-labelledby="for-label">
            {ownerChoices(h, me).map((c) => {
              const on = c.id === owner;
              return (
                <button type="button" key={c.id} className={on ? 'on' : ''} style={on ? { color: toneOf(h, c.id).t } : undefined} onClick={() => setOwner(c.id)} aria-pressed={on}>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="col gap8 push-bottom">
          <button type="submit" className="btn-dark" disabled={busy}>
            {isNew ? (kind === 'task' ? 'Ajouter la tâche' : 'Ajouter à l’agenda') : 'Enregistrer'}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
          {!isNew && (
            <button type="button" className="btn-ghost danger" onClick={remove} disabled={busy}>Supprimer</button>
          )}
        </div>
      </form>
    </div>
  );
}
