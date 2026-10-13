import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { stayDays } from '../birthday';
import { todayKey } from '../dates';
import {
  addEvent, addEventSeries, addTask, deleteEvent, deleteEvents, deleteTask, updateEvent, updateEvents, updateTask,
} from '../data';
import { calendarToken, createCal, deleteCal, recurrenceRule, updateCal, YEARLY } from '../gcal';
import { defaultUntil, MAX_DATES, REPEAT_CHOICES, repeatDates, repeatLabel } from '../repeat';
import { ownerChoices, partnerUid, toneOf } from '../tones';
import type { EventItem, Household, Repeat, Task } from '../types';
import { Icon } from '../ui';

type TileId = 'task' | 'event' | 'vac' | 'bday';

const tileStroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const TILES: { id: TileId; label: string; icon: ReactNode }[] = [
  { id: 'task', label: 'Tâche', icon: <svg width="20" height="20" viewBox="0 0 24 24" {...tileStroke} strokeWidth={2.6}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> },
  { id: 'event', label: 'Rendez-vous', icon: <svg width="20" height="20" viewBox="0 0 24 24" {...tileStroke}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg> },
  { id: 'vac', label: 'Vacances', icon: <svg width="20" height="20" viewBox="0 0 24 24" {...tileStroke}><circle cx="12" cy="9" r="4" /><path d="M3 20c3-2 6-2 9 0s6 2 9 0M12 2v1.5M4.5 9H6M18 9h1.5" /></svg> },
  { id: 'bday', label: 'Anniv.', icon: <svg width="20" height="20" viewBox="0 0 24 24" {...tileStroke}><path d="M4 20h16M5 20v-7h14v7M8 13v-3M12 13v-3M16 13v-3M8 6.5c0-1 1-2 0-3M12 6.5c0-1 1-2 0-3M16 6.5c0-1 1-2 0-3" /></svg> },
];

export type SheetMode = { kind: 'new'; preset?: 'bday' | 'vac' } | { kind: 'task'; task: Task } | { kind: 'event'; ev: EventItem };

interface Props {
  h: Household;
  me: string;
  events: EventItem[];
  mode: SheetMode;
  onClose: () => void;
}

export function AddSheet({ h, me, events, mode, onClose }: Props) {
  const isNew = mode.kind === 'new';
  const task = mode.kind === 'task' ? mode.task : null;
  const ev = mode.kind === 'event' ? mode.ev : null;

  const preset = mode.kind === 'new' ? mode.preset : undefined;
  const [kind, setKind] = useState<'task' | 'event'>(ev || preset ? 'event' : 'task');
  const [title, setTitle] = useState(task?.title ?? ev?.title ?? '');
  const [date, setDate] = useState(task?.due ?? ev?.date ?? '');
  const [start, setStart] = useState(task?.time ?? ev?.start ?? '');
  const [end, setEnd] = useState(ev?.end ?? '');
  const [place, setPlace] = useState(ev?.place ?? '');
  const [owner, setOwner] = useState<string>(task?.owner ?? ev?.owner ?? me);
  const [list, setList] = useState(task?.list ?? h.lists[0]?.id ?? 'maison');
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [birthday, setBirthday] = useState(!!ev?.birthday || preset === 'bday');
  // Date de naissance tapée au clavier (« 12.03.2019 ») : plus rapide que remonter le calendrier.
  const [bdayText, setBdayText] = useState(ev?.birthday ? ev.date.split('-').reverse().join('.') : '');
  const [vacation, setVacation] = useState(!!ev?.vacation || preset === 'vac');
  const [dateEnd, setDateEnd] = useState(ev?.dateEnd ?? '');
  const [until, setUntil] = useState('');
  const [untilTouched, setUntilTouched] = useState(false);
  const [flipped, setFlipped] = useState(false);
  // Un événement répété donne une fiche par date, toutes reliées : on choisit
  // si une retouche vaut pour cette fois-là ou pour toute la série.
  const [scope, setScope] = useState<'one' | 'all'>('one');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Un événement vit dans le Google Agenda de celui qui l'a créé : seul lui peut le synchroniser.
  const calMine = !ev?.gcalOwner || ev.gcalOwner === me;
  const [toCal, setToCal] = useState(ev ? !!ev.gcalId : true);
  const series = ev?.seriesId ? events.filter((x) => x.seriesId === ev.seriesId) : [];
  const inSeries = series.length > 0;
  const wholeSeries = inSeries && scope === 'all';
  const repeating = isNew && kind === 'event' && !birthday && !vacation && repeat !== 'none';
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (repeat !== 'none' && !untilTouched) setUntil(defaultUntil(date || todayKey(), repeat));
  }, [date, repeat, untilTouched]);

  // La tuile choisie en haut : tâche, rendez-vous, vacances ou anniversaire.
  const tile: TileId = birthday ? 'bday' : vacation ? 'vac' : kind === 'event' ? 'event' : 'task';
  const pickTile = (id: TileId) => {
    if (id === 'vac') return pickVacation(true);
    if (id === 'bday') return pickBirthday(true);
    setVacation(false);
    setBirthday(false);
    setKind(id);
    if (id === 'task') {
      setRepeat('none');
      setFlipped(false);
    }
  };

  const pickVacation = (on: boolean) => {
    setVacation(on);
    if (!on) return;
    setKind('event');
    setRepeat('none');
    setBirthday(false);
    if (!dateEnd || dateEnd < date) setDateEnd(date);
  };

  const pickBirthday = (on: boolean) => {
    setBirthday(on);
    if (!on) return;
    setKind('event');
    setRepeat('none');
    setVacation(false);
    setDate(birthKey(bdayText));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      setError('Donne un titre.');
      return;
    }
    if (birthday && !date) {
      setError('Écris la date comme 12.03.2019 (ou 12.03 sans l’année).');
      return;
    }
    if (kind === 'event' && !date) {
      setError('Un événement a besoin d’une date.');
      return;
    }
    if (vacation && (!dateEnd || dateEnd < date)) {
      setError('Choisis un dernier jour de vacances après le premier.');
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
        // Un anniversaire dure toute la journée : ni heure ni lieu. Des vacances : des jours entiers, avec un lieu.
        const data = birthday
          ? { title: t, date, start: null, end: null, place: '', owner, birthday: true, vacation: false, dateEnd: null }
          : vacation
            ? { title: t, date, start: null, end: null, place: place.trim(), owner, birthday: false, vacation: true, dateEnd }
            : { title: t, date, start: start || null, end: (start && end) || null, place: place.trim(), owner, birthday: false, vacation: false, dateEnd: null };
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
          // Côté Google : un événement annuel ; si on retire le drapeau, on enlève la règle.
          const recurrence = birthday ? YEARLY : ev?.birthday ? [] : undefined;
          const input = { ...data, attendees: partnerEmail && owner !== me ? [partnerEmail] : [], recurrence };
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

  const heading = isNew ? 'Ajouter' : ev?.birthday ? 'Anniversaire' : ev?.vacation ? 'Vacances' : inSeries ? 'Événement répété' : kind === 'event' ? 'Événement' : 'Tâche';

  return (
    <div className="sheet-wrap" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onSubmit={submit}>
        <div className="grabber" aria-hidden="true" />
        <div className="row between center">
          <h1 id="sheet-title" className="sheet-title">{heading}</h1>
          <button type="button" className="round-btn" aria-label="Fermer" onClick={onClose}>{Icon.close}</button>
        </div>

        {!inSeries && (
          <div className="tiles" role="group" aria-label="Que veux-tu ajouter ?">
            {TILES.map((t) => {
              const on = t.id === tile;
              return (
                <button type="button" key={t.id} className={`tile ${t.id}${on ? ' on' : ''}`} aria-pressed={on} onClick={() => pickTile(t.id)}>
                  <span className="tile-bubble" aria-hidden="true">{t.icon}</span>
                  {t.label}
                </button>
              );
            })}
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
            <input ref={firstRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={birthday ? 'Qui ? (ex. Léa)' : vacation ? 'Vacances à…' : 'Quoi ?'} />
          </label>
          {birthday ? (
            <label className="field">
              <span className="field-name">Né·e le</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                placeholder="JJ.MM.AAAA"
                maxLength={10}
                value={bdayText}
                onChange={(e) => {
                  const v = maskDate(e.target.value);
                  setBdayText(v);
                  setDate(birthKey(v));
                }}
              />
            </label>
          ) : (
          <label className="field">
            <span className="field-name">{vacation ? 'Du' : 'Quand'}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                // Le retour suit le départ s'il tombait avant.
                if (vacation && e.target.value && (!dateEnd || dateEnd < e.target.value)) setDateEnd(e.target.value);
              }}
              min={isNew ? todayKey() : undefined}
              disabled={wholeSeries}
            />
          </label>
          )}
          {vacation && (
            <label className="field">
              <span className="field-name">Au</span>
              <input type="date" value={dateEnd} min={date || undefined} onChange={(e) => setDateEnd(e.target.value)} />
            </label>
          )}
          {!birthday && !vacation && (
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
          )}
          {kind === 'event' && !birthday && (
            <label className="field">
              <span className="field-name">Où</span>
              <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Lieu (facultatif)" />
            </label>
          )}
          {isNew && !birthday && !vacation && (
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
        {vacation && date && dateEnd >= date && (
          <p className="muted small">{stayDays({ date, dateEnd })} jours, visibles chaque jour dans l’agenda et sur le mural de l’année.</p>
        )}
        {birthday && (
          <p className="muted small">Revient tous les ans au même jour. Avec l’année de naissance, l’app affiche l’âge.</p>
        )}
        {flipped && repeating && (
          <p className="muted small">Une tâche ne se répète pas encore : c’est devenu un événement.</p>
        )}
        {repeating && until >= (date || '') && (
          <p className="muted small">{repeatDates(date, repeat, until).length} fois au programme, de la première date au {until.split('-').reverse().join('.')}.</p>
        )}

        <div className="col gap6">
          <span className="field-label" id="for-label">Pour</span>
          <div className="segmented who" role="group" aria-labelledby="for-label">
            {ownerChoices(h, me).map((c) => {
              const on = c.id === owner;
              const t = toneOf(h, c.id);
              return (
                <button type="button" key={c.id} className={on ? 'on' : ''} style={on ? { color: t.t, background: t.s, borderColor: t.c } : undefined} onClick={() => setOwner(c.id)} aria-pressed={on}>
                  <span className="who-dot" style={{ background: t.c, color: t.on }}>{t.initial}</span>
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
                  : birthday
                    ? 'Ajouter l’anniversaire'
                    : vacation
                      ? 'Ajouter les vacances'
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

/** « 12032019 » → « 12.03.2019 » au fil de la frappe. */
function maskDate(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('.');
}

/** « 12.03.2019 » → « 2019-03-12 » ; sans année (« 12.03 »), l'année en cours, sans âge affiché. */
function birthKey(v: string): string {
  const m = v.match(/^(\d{2})\.(\d{2})(?:\.(\d{2}|\d{4}))?$/);
  if (!m) return '';
  const now = new Date().getFullYear();
  let y = m[3] ? Number(m[3]) : now;
  if (m[3]?.length === 2) y += y + 2000 > now ? 1900 : 2000;
  const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
  if (d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || y > now) return '';
  return `${y}-${m[2]}-${m[1]}`;
}
