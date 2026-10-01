import { useEffect, useRef, useState, type FormEvent } from 'react';
import { todayKey } from '../dates';
import {
  addEvent, addEventSeries, addTask, deleteEvent, deleteEvents, deleteTask, updateEvent, updateEvents, updateTask,
} from '../data';
import { calendarToken, createCal, deleteCal, recurrenceRule, updateCal } from '../gcal';
import { parseQuick } from '../parse';
import { defaultUntil, MAX_DATES, REPEAT_CHOICES, repeatDates, repeatLabel } from '../repeat';
import { ownerChoices, partnerUid, toneOf } from '../tones';
import type { EventItem, Household, Repeat, Task } from '../types';
import { Icon } from '../ui';

export type SheetMode = { kind: 'new' } | { kind: 'task'; task: Task } | { kind: 'event'; ev: EventItem };

interface Props {
  h: Household;
  me: string;
  events: EventItem[];
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

export function AddSheet({ h, me, events, mode, onClose }: Props) {
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
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [until, setUntil] = useState('');
  const [untilTouched, setUntilTouched] = useState(false);
  const [flipped, setFlipped] = useState(false);
  // Un événement répété donne une fiche par date, toutes reliées : on choisit
  // si une retouche vaut pour cette fois-là ou pour toute la série.
  const [scope, setScope] = useState<'one' | 'all'>('one');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Un événement vit dans le Google Agenda de celui qui l'a créé : seul lui peut le synchroniser.
  const calMine = !ev?.gcalOwner || ev.gcalOwner === me;
  const [toCal, setToCal] = useState(ev ? !!ev.gcalId : true);
  const series = ev?.seriesId ? events.filter((x) => x.seriesId === ev.seriesId) : [];
  const inSeries = series.length > 0;
  const wholeSeries = inSeries && scope === 'all';
  const repeating = isNew && kind === 'event' && repeat !== 'none';
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

  useEffect(() => {
    if (repeat !== 'none' && !untilTouched) setUntil(defaultUntil(date || todayKey(), repeat));
  }, [date, repeat, untilTouched]);

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
    setRepeat(p.repeat);
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
    let dates: string[] = [];
    if (repeating) {
      if (!until || until < date) {
        setError('Choisis une fin de répétition après la première date.');
        return;
      }
      dates = repeatDates(date, repeat, until);
      if (dates.length > MAX_DATES) {
        setError(`Ça fait plus de ${MAX_DATES} fois : rapproche la fin de la répétition.`);
        return;
      }
    }
    setBusy(true);
    setError('');

    // Le jeton Google se demande avant tout autre await, sinon la popup est bloquée.
    // Une série reste telle quelle dans Google Agenda : on n'y touche qu'à la création et à la suppression.
    const ownCalEvent = !!ev?.gcalId && !ev.seriesId && ev.gcalOwner === me;
    const needCal = (kind === 'event' && toCal && calMine && !inSeries) || ownCalEvent;
    let token: string | null = null;
    let calFailed = false;
    if (needCal) {
      try {
        token = await calendarToken();
      } catch {
        calFailed = true;
      }
    }

    try {
      if (kind === 'event') {
        const data = { title: t, date, start: start || null, end: (start && end) || null, place: place.trim(), owner };
        if (wholeSeries) {
          // La date reste propre à chaque occurrence : le reste change partout.
          const { date: _keep, ...shared } = data;
          await updateEvents(h.id, series.map((x) => x.id), shared);
          onClose();
          return;
        }
        if (repeating) {
          let gcal: Partial<EventItem> = {};
          if (token) {
            const partner = partnerUid(h, me);
            const partnerEmail = partner ? h.people[partner]?.email : undefined;
            try {
              const gcalId = await createCal(token, {
                ...data,
                attendees: partnerEmail && owner !== me ? [partnerEmail] : [],
                recurrence: recurrenceRule(repeat, until, !!start),
              });
              gcal = { gcalId, gcalOwner: me, gcalSeries: true };
            } catch {
              calFailed = true;
            }
          }
          if (task) await deleteTask(h.id, task.id);
          await addEventSeries(h.id, me, { ...data, repeat, ...gcal }, dates);
          if (!calFailed) {
            onClose();
            return;
          }
          setNotice('Les dates sont dans l’agenda de l’app, mais Google Agenda n’a pas pu être mis à jour.');
          setBusy(false);
          return;
        }
        let gcal: { gcalId: string | null; gcalOwner: string | null } | null = null;
        if (token && calMine) {
          const partner = partnerUid(h, me);
          const partnerEmail = partner ? h.people[partner]?.email : undefined;
          const input = { ...data, attendees: partnerEmail && owner !== me ? [partnerEmail] : [] };
          try {
            if (toCal && ev?.gcalId) await updateCal(token, ev.gcalId, input);
            else if (toCal) gcal = { gcalId: await createCal(token, input), gcalOwner: me };
            else if (ev?.gcalId) {
              await deleteCal(token, ev.gcalId);
              gcal = { gcalId: null, gcalOwner: null };
            }
          } catch {
            calFailed = true;
          }
        }
        if (ev) await updateEvent(h.id, ev.id, { ...data, ...gcal });
        else {
          if (task) await deleteTask(h.id, task.id);
          await addEvent(h.id, me, { ...data, ...(gcal ?? {}) });
        }
      } else {
        const data = { title: t, list, due: date || null, time: (date && start) || null, owner };
        if (task) await updateTask(h.id, task.id, data);
        else {
          if (ev) {
            if (token && ownCalEvent) await deleteCal(token, ev.gcalId!).catch(() => (calFailed = true));
            await deleteEvent(h.id, ev.id);
          }
          await addTask(h.id, me, data);
        }
      }
      if (calFailed) {
        setNotice('C’est enregistré dans l’app, mais Google Agenda n’a pas pu être mis à jour.');
        setBusy(false);
      } else onClose();
    } catch {
      setError('Impossible d’enregistrer. Réessaie.');
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    let calFailed = false;
    // Côté Google, une série est un seul événement récurrent : on ne l'enlève que si
    // on supprime toute la série (ou sa dernière date restante).
    const lastOfSeries = inSeries && series.length === 1;
    const killCal = !!ev?.gcalId && ev.gcalOwner === me && (!ev.seriesId || wholeSeries || lastOfSeries);
    if (killCal) {
      try {
        await deleteCal(await calendarToken(), ev!.gcalId!);
      } catch {
        calFailed = true;
      }
    }
    if (task) await deleteTask(h.id, task.id);
    if (ev) {
      if (wholeSeries) await deleteEvents(h.id, series.map((x) => x.id));
      else await deleteEvent(h.id, ev.id);
    }
    if (calFailed) {
      setNotice('Supprimé de l’app, mais pas de Google Agenda : supprime-le là-bas à la main.');
      setBusy(false);
    } else onClose();
  };

  const heading = isNew ? 'Ajout rapide' : inSeries ? 'Événement répété' : kind === 'event' ? 'Événement' : 'Tâche';

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

        {!inSeries && (
          <div className="segmented" role="group" aria-label="Type">
            <button type="button" className={kind === 'task' ? 'on' : ''} onClick={() => { setKind('task'); setRepeat('none'); setFlipped(false); }} aria-pressed={kind === 'task'}>Tâche</button>
            <button type="button" className={kind === 'event' ? 'on' : ''} onClick={() => setKind('event')} aria-pressed={kind === 'event'}>Événement</button>
          </div>
        )}

        {inSeries && (
          <div className="col gap6">
            <span className="field-label" id="scope-label">
              {repeatLabel(ev!.repeat ?? 'none', null) || 'Se répète'} · {series.length} dates
            </span>
            <div className="segmented" role="group" aria-labelledby="scope-label">
              <button type="button" className={scope === 'one' ? 'on' : ''} onClick={() => setScope('one')} aria-pressed={scope === 'one'}>Cette fois</button>
              <button type="button" className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')} aria-pressed={scope === 'all'}>Toutes les fois</button>
            </div>
          </div>
        )}

        <div className="fields">
          <label className="field">
            <span className="field-name">Titre</span>
            <input ref={isNew ? undefined : firstRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quoi ?" />
          </label>
          <label className="field">
            <span className="field-name">Quand</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={isNew ? todayKey() : undefined}
              disabled={wholeSeries}
            />
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
          {kind === 'event' && (
            <label className="field">
              <span className="field-name">Où</span>
              <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Lieu (facultatif)" />
            </label>
          )}
          {isNew && (
            <label className="field">
              <span className="field-name">Répéter</span>
              <select
                value={repeat}
                onChange={(e) => {
                  const r = e.target.value as Repeat;
                  setRepeat(r);
                  // Seuls les événements se répètent : on bascule et on le dit.
                  if (r !== 'none' && kind === 'task') {
                    setKind('event');
                    setFlipped(true);
                  }
                  if (r === 'none') setFlipped(false);
                }}
              >
                {REPEAT_CHOICES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          )}
          {repeating && (
            <label className="field">
              <span className="field-name">Jusqu’au</span>
              <input
                type="date"
                value={until}
                min={date || todayKey()}
                onChange={(e) => {
                  setUntil(e.target.value);
                  setUntilTouched(true);
                }}
              />
            </label>
          )}
        </div>
        {flipped && repeating && (
          <p className="muted small">Une tâche ne se répète pas encore : c’est devenu un événement.</p>
        )}
        {repeating && until >= (date || '') && (
          <p className="muted small">{repeatDates(date, repeat, until).length} fois au programme, de la première date au {until.split('-').reverse().join('.')}.</p>
        )}

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

        {kind === 'event' && inSeries && (
          <p className="muted small">
            {ev!.gcalId && ev!.gcalOwner === me
              ? 'La série est aussi dans ton Google Agenda. Les retouches faites ici n’y sont pas renvoyées ; si tu supprimes toutes les fois, elle en part aussi.'
              : 'Cette série n’est pas dans Google Agenda.'}
          </p>
        )}

        {kind === 'event' && !inSeries && (
          calMine ? (
            <label className="toggle-row">
              <span className="grow">Mettre dans mon Google Agenda</span>
              <input type="checkbox" checked={toCal} onChange={(e) => setToCal(e.target.checked)} />
            </label>
          ) : (
            <p className="muted small">Cet événement est dans le Google Agenda de {h.people[ev!.gcalOwner!]?.name ?? 'l’autre'} : les changements faits ici ne s’y reportent pas.</p>
          )
        )}

        {error && <p className="error" role="alert">{error}</p>}

        {notice ? (
          <div className="col gap8">
            <p className="error" role="alert">{notice}</p>
            <button type="button" className="btn-dark" onClick={onClose}>Fermer</button>
          </div>
        ) : (
        <div className="col gap8 push-bottom">
          <button type="submit" className="btn-dark" disabled={busy}>
            {isNew
              ? kind === 'task'
                ? 'Ajouter la tâche'
                : repeating
                  ? `Ajouter les ${repeatDates(date || todayKey(), repeat, until || defaultUntil(date || todayKey(), repeat)).length} dates`
                  : 'Ajouter à l’agenda'
              : wholeSeries ? 'Enregistrer pour toutes les fois' : 'Enregistrer'}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
          {!isNew && (
            <button type="button" className="btn-ghost danger" onClick={remove} disabled={busy}>
              {wholeSeries ? `Supprimer les ${series.length} dates` : 'Supprimer'}
            </button>
          )}
        </div>
        )}
      </form>
    </div>
  );
}
