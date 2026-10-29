import { useEffect, useRef, useState, type FormEvent } from 'react';
import { shortDate, todayKey } from '../dates';
import { addDeadline, deleteDeadline, updateDeadline } from '../data';
import { addMonths, autoRenews, cancelBy, everyLabel, EVERY_CHOICES, KIND_INFO, KINDS, nextOf, NOTICE_CHOICES } from '../deadlines';
import { ownerChoices, toneOf } from '../tones';
import type { Deadline, DeadlineKind, Household } from '../types';
import { Icon } from '../ui';

interface Props {
  h: Household;
  me: string;
  item: Deadline | null; // null = nouvelle échéance
  onClose: () => void;
}

const TITLE_HINT: Record<DeadlineKind, string> = {
  abo: 'Netflix, Spotify, fitness…',
  assurance: 'Assurance auto, ménage, maladie…',
  contrat: 'Téléphone, internet, leasing, bail…',
  entretien: 'Service voiture, chaudière, pneus…',
  admin: 'Passeport, permis, impôts…',
};

/** Ajouter ou modifier une échéance : abonnement, assurance, contrat, entretien ou papiers. */
export function DeadlineSheet({ h, me, item, onClose }: Props) {
  const today = todayKey();
  const [kind, setKind] = useState<DeadlineKind>(item?.kind ?? 'abo');
  const [title, setTitle] = useState(item?.title ?? '');
  const [provider, setProvider] = useState(item?.provider ?? '');
  const [amount, setAmount] = useState(item?.amount != null ? String(item.amount) : '');
  const [per, setPer] = useState<'month' | 'year'>(item?.per ?? 'month');
  const [every, setEvery] = useState(item?.every ?? 1);
  const [next, setNext] = useState(item ? nextOf(item, today) : '');
  const [notice, setNotice] = useState(item?.notice ?? 0);
  const [owner, setOwner] = useState(item?.owner ?? 'both');
  const [note, setNote] = useState(item?.note ?? '');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!item) firstRef.current?.focus();
  }, [item]);

  // Valeurs par défaut selon la sorte : un abo se paie au mois, une assurance à l'année avec préavis…
  const pickKind = (k: DeadlineKind) => {
    setKind(k);
    if (item) return;
    if (k === 'abo') { setEvery(1); setPer('month'); setNotice(0); }
    if (k === 'assurance') { setEvery(12); setPer('year'); setNotice(4); }
    if (k === 'contrat') { setEvery(12); setPer('month'); setNotice(4); }
    if (k === 'entretien') { setEvery(12); setPer('year'); setNotice(0); }
    if (k === 'admin') { setEvery(0); setPer('year'); setNotice(0); }
  };

  const draft: Deadline = {
    id: item?.id ?? '', title, provider, kind, amount: amount ? Number(amount.replace(',', '.')) : null, per, every, next,
    notice: kind === 'entretien' || kind === 'admin' ? 0 : notice, owner, note,
  };
  const cancel = next ? cancelBy(draft, today) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Donne-lui un nom.');
      return;
    }
    if (!next) {
      setError(kind === 'abo' || kind === 'assurance' || kind === 'contrat' ? 'Indique la prochaine date de renouvellement.' : 'Indique la date.');
      return;
    }
    if (draft.amount !== null && !(draft.amount >= 0)) {
      setError('Le montant n’est pas un nombre.');
      return;
    }
    setBusy(true);
    const { id: _id, ...data } = { ...draft, title: title.trim(), provider: provider.trim(), note: note.trim() };
    try {
      if (item) await updateDeadline(h.id, item.id, data);
      else await addDeadline(h.id, me, data);
      onClose();
    } catch {
      setError('Pas pu enregistrer. Réessaie.');
      setBusy(false);
    }
  };

  /** Entretien ou papiers faits : la prochaine fois est reportée d'un cycle (ou la fiche disparaît). */
  const done = async () => {
    if (!item) return;
    setBusy(true);
    if (item.every) await updateDeadline(h.id, item.id, { next: addMonths(today > item.next ? today : item.next, item.every) });
    else await deleteDeadline(h.id, item.id);
    onClose();
  };

  const remove = async () => {
    if (!item) return;
    setBusy(true);
    await deleteDeadline(h.id, item.id);
    onClose();
  };

  const recurring = every > 0;
  const nextName = kind === 'entretien' ? 'Prochain' : kind === 'admin' ? (recurring ? 'Prochaine fois' : 'Pour le') : recurring ? 'Renouvellement' : 'Fin le';

  return (
    <div className="sheet-wrap" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="dl-title" onSubmit={submit}>
        <div className="grabber" aria-hidden="true" />
        <div className="row between center">
          <h1 id="dl-title" className="sheet-title">{item ? KIND_INFO[kind].label : 'Nouvelle échéance'}</h1>
          <button type="button" className="round-btn" aria-label="Fermer" onClick={onClose}>{Icon.close}</button>
        </div>

        <div className="dl-kinds" role="group" aria-label="Sorte d’échéance">
          {KINDS.map((k) => (
            <button type="button" key={k} className={k === kind ? 'on' : ''} aria-pressed={k === kind} onClick={() => pickKind(k)}>
              <span aria-hidden="true">{KIND_INFO[k].icon}</span>{KIND_INFO[k].label}
            </button>
          ))}
        </div>

        <div className="fields">
          <label className="field">
            <span className="field-name">Quoi</span>
            <input ref={firstRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={TITLE_HINT[kind]} />
          </label>
          <label className="field">
            <span className="field-name">Chez</span>
            <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Fournisseur, assureur, garage…" />
          </label>
          <label className="field">
            <span className="field-name">Montant</span>
            <span className="row gap8 center grow">
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="CHF" className="grow" />
              <select aria-label="Par" value={per} onChange={(e) => setPer(e.target.value as 'month' | 'year')}>
                <option value="month">/ mois</option>
                <option value="year">/ an</option>
              </select>
            </span>
          </label>
          <label className="field">
            <span className="field-name">Revient</span>
            <select value={every} onChange={(e) => setEvery(Number(e.target.value))}>
              {EVERY_CHOICES.map((n) => <option key={n} value={n}>{everyLabel(n)}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-name">{nextName}</span>
            <input type="date" value={next} onChange={(e) => setNext(e.target.value)} />
          </label>
          {kind !== 'entretien' && kind !== 'admin' && (
            <label className="field">
              <span className="field-name">Préavis</span>
              <select value={notice} onChange={(e) => setNotice(Number(e.target.value))}>
                {NOTICE_CHOICES.map((n) => <option key={n} value={n}>{n ? `${n} mois` : 'Aucun'}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span className="field-name">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="N° de police, de client…" />
          </label>
        </div>

        {cancel && (
          <p className="muted small">
            {cancel >= today
              ? `Pour ne pas renouveler, résilier au plus tard le ${shortDate(cancel)}.`
              : `Le délai pour résilier avant le ${shortDate(nextOf(draft, today))} est passé (${shortDate(cancel)}).`}
            {' '}Tu auras un rappel un mois avant, une semaine avant et la veille.
          </p>
        )}
        {!cancel && next && (
          <p className="muted small">Rappel un mois avant, une semaine avant et la veille.</p>
        )}

        <div className="col gap6">
          <span className="field-label" id="dl-for">Pour</span>
          <div className="segmented who" role="group" aria-labelledby="dl-for">
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

        {error && <p className="error" role="alert">{error}</p>}

        <div className="col gap8 push-bottom">
          <button type="submit" className="btn-dark" disabled={busy}>{item ? 'Enregistrer' : 'Ajouter'}</button>
          {item && !autoRenews(item) && (
            <button type="button" className="btn-ghost" onClick={done} disabled={busy}>
              {Icon.check} C’est fait{item.every ? ` · prochaine fois le ${shortDate(addMonths(today > item.next ? today : item.next, item.every))}` : ''}
            </button>
          )}
          {item && (
            <button type="button" className="btn-ghost danger" onClick={() => setConfirm(true)} disabled={busy}>Supprimer</button>
          )}
        </div>
      </form>

      {confirm && (
        <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="dl-confirm">
          <div className="confirm-scrim" onClick={() => setConfirm(false)} aria-hidden="true" />
          <div className="confirm-card">
            <span className="confirm-ico" aria-hidden="true">🗑️</span>
            <h2 id="dl-confirm">Supprimer « {item?.title} » ?</h2>
            <p className="muted">Elle disparaît pour vous deux, avec ses rappels.</p>
            <div className="col gap8">
              <button type="button" className="btn-confirm danger" onClick={remove}>Supprimer</button>
              <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
