import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { addEvent } from '../data';
import { cap, DAYS, fromKey, MONTHS } from '../dates';
import { toneOf } from '../tones';
import type { Household } from '../types';
import { Icon } from '../ui';

/** Une proposition de Coco, ajoutée à l'agenda seulement si on touche « Ajouter ». */
interface Action {
  title: string;
  date: string;
  start: string | null;
  end: string | null;
  place: string;
  owner: string;
  added?: boolean;
}

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  actions?: Action[];
}

const callChat = httpsCallable<{ messages: { role: string; content: string }[] }, { reply: string; actions: Action[] }>(functions, 'chat');

const SUGGESTIONS = [
  'C’est quand notre prochain voyage ? ✈️',
  'Qu’est-ce qu’on fait ce week-end ?',
  'Qu’est-ce qui m’attend demain ?',
  'Le prochain anniversaire ? 🎂',
  'Il me reste quoi à faire ?',
];

/** **gras** et retours à la ligne, sans HTML. */
function rich(text: string): ReactNode {
  return text.split('\n').map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => (part.startsWith('**') && part.endsWith('**') ? <b key={j}>{part.slice(2, -2)}</b> : part))}
    </Fragment>
  ));
}

const when = (a: Action) => {
  const d = fromKey(a.date);
  return `${cap(DAYS[d.getDay()])} ${d.getDate()} ${MONTHS[d.getMonth()]}${a.start ? ` · ${a.start}${a.end ? `–${a.end}` : ''}` : ''}`;
};

export function Chat({ h, me, onClose }: { h: Household; me: string; onClose: () => void }) {
  const store = `coco-${me}`;
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(store) ?? '[]');
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const name = h.people[me]?.name ?? '';

  useEffect(() => {
    try {
      localStorage.setItem(store, JSON.stringify(msgs.slice(-40)));
    } catch {
      /* pas de mémoire locale : la conversation repartira de zéro */
    }
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, busy, store]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: t }];
    setMsgs(next);
    setDraft('');
    setBusy(true);
    setError('');
    try {
      const { data } = await callChat({ messages: next.slice(-16).map(({ role, content }) => ({ role, content })) });
      setMsgs((m) => [...m, { role: 'assistant', content: data.reply, actions: data.actions }]);
    } catch (e) {
      setError((e as { message?: string }).message || 'Coco ne répond pas. Réessaie.');
    }
    setBusy(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  const add = async (mi: number, ai: number) => {
    const a = msgs[mi].actions![ai];
    await addEvent(h.id, me, { title: a.title, date: a.date, start: a.start, end: a.end, place: a.place, owner: a.owner });
    navigator.vibrate?.(20);
    setMsgs((m) => m.map((x, i) => (i === mi ? { ...x, actions: x.actions!.map((y, j) => (j === ai ? { ...y, added: true } : y)) } : x)));
  };

  const reset = () => {
    setMsgs([]);
    setError('');
  };

  return (
    <div className="chat" role="dialog" aria-modal="true" aria-label="Discuter avec Coco">
      <header className="chat-head">
        <button className="round-btn" onClick={onClose} aria-label="Fermer">{Icon.left}</button>
        <span className="chat-avatar" aria-hidden="true">🐥</span>
        <span className="col grow min0">
          <span className="chat-name">Coco</span>
          <span className="chat-status">{busy ? 'écrit…' : 'ton assistant à deux'}</span>
        </span>
        {msgs.length > 0 && <button className="link" onClick={reset}>Nouvelle discussion</button>}
      </header>

      <div className="chat-body" aria-live="polite">
        <div className="bubble bot">
          Coucou {name} ! 👋 Je connais votre agenda par cœur : voyages, anniversaires, tâches… et j’ai plein d’idées de sorties. Qu’est-ce que je peux faire pour toi ?
        </div>
        {msgs.length === 0 && (
          <div className="chat-sugg">
            {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        {msgs.map((m, i) => (
          <Fragment key={i}>
            <div className={m.role === 'user' ? 'bubble me' : 'bubble bot'}>{m.role === 'user' ? m.content : rich(m.content)}</div>
            {m.actions?.map((a, j) => {
              const t = toneOf(h, a.owner);
              return (
                <div key={j} className="chat-action" style={{ borderColor: t.c }}>
                  <span className="col grow min0 gap2">
                    <b className="ell">{a.title}</b>
                    <span className="chat-action-sub">{when(a)}{a.place && ` · ${a.place}`} · {t.name}</span>
                  </span>
                  <button className={a.added ? 'chat-add on' : 'chat-add'} disabled={a.added} onClick={() => add(i, j)}>
                    {a.added ? '✓ Ajouté' : 'Ajouter'}
                  </button>
                </div>
              );
            })}
          </Fragment>
        ))}
        {busy && <div className="bubble bot typing" aria-label="Coco écrit"><span /><span /><span /></div>}
        {error && <p className="error" role="alert">{error}</p>}
        <div ref={end} />
      </div>

      <form className="chat-input" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-q">Message</label>
        <input id="chat-q" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Demande-moi n’importe quoi…" enterKeyHint="send" autoComplete="off" />
        <button type="submit" className="chat-send" disabled={!draft.trim() || busy} aria-label="Envoyer">{Icon.right}</button>
      </form>
    </div>
  );
}
