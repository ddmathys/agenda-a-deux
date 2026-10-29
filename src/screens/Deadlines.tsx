import { useState, type FormEvent } from 'react';
import { cap, fromKey, MONTHS, shortDate, todayKey } from '../dates';
import { addDeadlineComment, deleteDeadline, deleteDeadlineComment, updateDeadline } from '../data';
import {
  addMonths, autoRenews, cancelBy, chf, daysTo, everyLabel, inDaysLabel, KIND_INFO, KINDS, keyDate, monthly, nextOf,
} from '../deadlines';
import { toneOf } from '../tones';
import type { Deadline, DeadlineKind, Household } from '../types';
import { Avatar, Empty, Icon, scrollToTop } from '../ui';

interface Props {
  h: Household;
  me: string;
  items: Deadline[];
  detail: string | null; // échéance ouverte en détail
  onDetail: (id: string | null) => void;
  onAdd: () => void;
  onEdit: (d: Deadline) => void;
}

/**
 * Les échéances du foyer en trois niveaux : les prochains renouvellements (par mois),
 * les catégories, puis le détail d'une échéance avec ses commentaires.
 */
export function Deadlines({ h, me, items, detail, onDetail, onAdd, onEdit }: Props) {
  const today = todayKey();
  const [view, setView] = useState<'next' | 'cats'>('next');
  const [cat, setCat] = useState<DeadlineKind | null>(null);
  const open = (d: Deadline) => { onDetail(d.id); scrollToTop(); };

  const current = detail ? items.find((d) => d.id === detail) : undefined;
  if (current) return <DeadlineDetail h={h} me={me} d={current} today={today} onBack={() => onDetail(null)} onEdit={onEdit} />;

  const sorted = [...items].sort((a, b) => keyDate(a, today).localeCompare(keyDate(b, today)));

  if (cat) {
    const list = sorted.filter((d) => d.kind === cat);
    const total = list.reduce((s, d) => s + monthly(d), 0);
    return (
      <div className="screen dash">
        <header className="d-head">
          <button className="back-link" onClick={() => setCat(null)}>{Icon.left}Catégories</button>
          <span className="d-stamp">{list.length} {list.length > 1 ? 'ÉCHÉANCES' : 'ÉCHÉANCE'}</span>
          <h1 className="d-hello"><span aria-hidden="true">{KIND_INFO[cat].icon}</span> {KIND_INFO[cat].plural}</h1>
          {total > 0 && <span className="d-mono dl-total">≈ {chf(Math.round(total))} / mois · {chf(Math.round(total * 12))} / an</span>}
        </header>
        {list.length === 0 ? <Empty>Rien dans cette catégorie pour l’instant.</Empty> : (
          <div className="d-card">{list.map((d) => <DeadlineRow key={d.id} h={h} d={d} today={today} onOpen={open} />)}</div>
        )}
        <button className="d-btn primary d-next" onClick={onAdd}>{Icon.plusSm}Ajouter</button>
      </div>
    );
  }

  const perMonth = items.reduce((s, d) => s + monthly(d), 0);
  // Prochains renouvellements, regroupés par mois de la date qui compte.
  const months: { label: string; list: Deadline[] }[] = [];
  for (const d of sorted) {
    const k = keyDate(d, today);
    const x = fromKey(k);
    const label = k < today ? 'En retard' : `${cap(MONTHS[x.getMonth()])} ${x.getFullYear()}`;
    const g = months[months.length - 1];
    if (g && g.label === label) g.list.push(d);
    else months.push({ label, list: [d] });
  }

  return (
    <div className="screen dash">
      <header className="d-head">
        <span className="d-stamp">ÉCHÉANCES</span>
        <h1 className="d-hello">Abos <em>&amp;</em> contrats</h1>
        {perMonth > 0 && <span className="d-mono dl-total">≈ {chf(Math.round(perMonth))} / mois · {chf(Math.round(perMonth * 12))} / an</span>}
      </header>

      <div className="d-pills" role="group" aria-label="Affichage">
        <button className={view === 'next' ? 'on' : ''} onClick={() => setView('next')} aria-pressed={view === 'next'}>Prochains</button>
        <button className={view === 'cats' ? 'on' : ''} onClick={() => setView('cats')} aria-pressed={view === 'cats'}>Par catégorie</button>
      </div>

      {items.length === 0 && (
        <Empty>
          Note ici tes abonnements, assurances, contrats, l’entretien de la voiture ou les papiers à renouveler.
          Tu seras prévenu un mois avant de devoir résilier ou renouveler.
        </Empty>
      )}

      {view === 'next' && months.map((g) => (
        <section key={g.label} className="col gap12">
          <div className="d-sec"><h2>{g.label}</h2><span className="d-mono">{g.list.length}</span></div>
          <div className="d-card">{g.list.map((d) => <DeadlineRow key={d.id} h={h} d={d} today={today} onOpen={open} />)}</div>
        </section>
      ))}

      {view === 'cats' && items.length > 0 && (
        <div className="dl-cats">
          {KINDS.map((k) => {
            const list = sorted.filter((d) => d.kind === k);
            const total = list.reduce((s, d) => s + monthly(d), 0);
            const first = list[0];
            return (
              <button key={k} className="dl-cat" style={{ background: KIND_INFO[k].tint }} onClick={() => { setCat(k); scrollToTop(); }}>
                <span className="dl-cat-ico" aria-hidden="true">{KIND_INFO[k].icon}</span>
                <span className="dl-cat-name">{KIND_INFO[k].plural}</span>
                <span className="dl-cat-n">{list.length ? `${list.length} · ${total ? `≈ ${chf(Math.round(total))}/mois` : 'montants à compléter'}` : 'Aucune'}</span>
                {first && <span className="dl-cat-next">Prochain : {first.title}, {inDaysLabel(daysTo(keyDate(first, today), today))}</span>}
              </button>
            );
          })}
        </div>
      )}

      <button className="d-btn primary d-next" onClick={onAdd}>{Icon.plusSm}Ajouter une échéance</button>
    </div>
  );
}

/** Une échéance dans une liste : icône, nom, prochaine date, montant ; touche pour le détail. */
export function DeadlineRow({ h, d, today, onOpen }: { h: Household; d: Deadline; today: string; onOpen: (d: Deadline) => void }) {
  const k = KIND_INFO[d.kind];
  const t = toneOf(h, d.owner);
  const next = nextOf(d, today);
  const cancel = cancelBy(d, today);
  const late = d.next < today && !autoRenews(d);
  const n = daysTo(keyDate(d, today), today);
  const when = cancel && cancel >= today
    ? `Résilier d’ici le ${shortDate(cancel)} · renouvelé le ${shortDate(next)}`
    : `${autoRenews(d) ? (d.every ? 'Renouvelé le' : 'Fin le') : 'Le'} ${shortDate(next)} · ${everyLabel(d.every).toLowerCase()}`;
  const notes = d.comments?.length ?? 0;
  return (
    <button className="d-row" onClick={() => onOpen(d)}>
      <span className="d-bar" style={{ background: t.c }} />
      <span className="d-ico" style={{ background: k.tint }} aria-hidden="true">{k.icon}</span>
      <span className="col grow min0 gap2">
        <span className="d-title ell">{d.title}{d.provider ? <span className="dl-provider"> · {d.provider}</span> : null}</span>
        <span className="d-meta">{when}{notes ? ` · 💬 ${notes}` : ''}</span>
      </span>
      <span className="col gap2 dl-side">
        {d.amount ? <span className="d-amount">{chf(d.amount)}{d.per === 'year' ? '/an' : '/mois'}</span> : null}
        <span className={`dl-when${late ? ' late' : n <= 7 ? ' hot' : ''}`}>{late ? 'en retard' : inDaysLabel(n)}</span>
      </span>
    </button>
  );
}

/** Le détail d'une échéance : les faits, ce qu'il faut faire et quand, puis les commentaires. */
function DeadlineDetail({ h, me, d, today, onBack, onEdit }: {
  h: Household; me: string; d: Deadline; today: string; onBack: () => void; onEdit: (d: Deadline) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const k = KIND_INFO[d.kind];
  const t = toneOf(h, d.owner);
  const next = nextOf(d, today);
  const cancel = cancelBy(d, today);
  const key = keyDate(d, today);
  const n = daysTo(key, today);
  const late = d.next < today && !autoRenews(d);
  const comments = [...(d.comments ?? [])].sort((a, b) => b.at.localeCompare(a.at));

  const headline = late
    ? `En retard depuis le ${shortDate(d.next)}`
    : cancel && cancel >= today
      ? `Résilier d’ici le ${shortDate(cancel)}`
      : autoRenews(d) ? (d.every ? `Renouvelé le ${shortDate(next)}` : `Se termine le ${shortDate(next)}`) : `À faire le ${shortDate(next)}`;

  const facts: [string, string][] = [
    ['Chez', d.provider || '—'],
    ['Montant', d.amount ? `${chf(d.amount)} ${d.per === 'year' ? 'par an' : 'par mois'}${d.per === 'year' ? ` (≈ ${chf(Math.round(d.amount / 12))}/mois)` : ` (${chf(Math.round(d.amount * 12))}/an)`}` : 'À compléter'],
    ['Revient', everyLabel(d.every)],
    [autoRenews(d) ? (d.every ? 'Prochain renouvellement' : 'Fin') : 'Prochaine fois', shortDate(next) + ` ${fromKey(next).getFullYear()}`],
  ];
  if (autoRenews(d)) facts.push(['Préavis', d.notice ? `${d.notice} mois${cancel ? ` · au plus tard le ${shortDate(cancel)}` : ''}` : 'Aucun']);
  facts.push(['Pour', t.name]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setBusy(true);
    await addDeadlineComment(h.id, d.id, { by: me, at: new Date().toISOString(), text: v });
    setText('');
    setBusy(false);
  };

  const done = async () => {
    setBusy(true);
    if (d.every) await updateDeadline(h.id, d.id, { next: addMonths(today > d.next ? today : d.next, d.every) });
    else {
      await deleteDeadline(h.id, d.id);
      onBack();
    }
    setBusy(false);
  };

  return (
    <div className="screen dash">
      <header className="d-head">
        <button className="back-link" onClick={onBack}>{Icon.left}Échéances</button>
        <span className="d-stamp">{k.label.toUpperCase()}</span>
        <div className="row gap12 center">
          <span className="dl-big-ico" style={{ background: k.tint }} aria-hidden="true">{k.icon}</span>
          <h1 className="d-hello dl-title">{d.title}</h1>
        </div>
      </header>

      <section className={`dl-hero${late ? ' late' : n <= 30 ? ' hot' : ''}`}>
        <span className="dl-hero-when">{late ? 'en retard' : inDaysLabel(n)}</span>
        <span className="dl-hero-what">{headline}</span>
        {cancel && cancel >= today && <span className="dl-hero-sub">Sinon renouvelé le {shortDate(next)}. Rappels un mois avant, une semaine avant et la veille.</span>}
      </section>

      <div className="d-card">
        {facts.map(([label, value]) => (
          <div key={label} className="dl-fact">
            <span className="dl-fact-l">{label}</span>
            <span className="dl-fact-v">{value}</span>
          </div>
        ))}
        {d.note && (
          <div className="dl-fact">
            <span className="dl-fact-l">Note</span>
            <span className="dl-fact-v">{d.note}</span>
          </div>
        )}
      </div>

      <div className="row gap8 wrap">
        <button className="d-btn grow d-next" onClick={() => onEdit(d)}>Modifier</button>
        {!autoRenews(d) && (
          <button className="d-btn primary grow d-next" onClick={done} disabled={busy}>
            {Icon.check}C’est fait{d.every ? ` · suivant le ${shortDate(addMonths(today > d.next ? today : d.next, d.every))}` : ''}
          </button>
        )}
      </div>

      <section className="col gap12">
        <div className="d-sec"><h2>Commentaires</h2><span className="d-mono">{comments.length}</span></div>
        <form className="dl-comment-form" onSubmit={send}>
          <label className="sr-only" htmlFor="dl-comment">Ajouter un commentaire</label>
          <textarea
            id="dl-comment"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Appelé l’assurance, offre reçue, à comparer…"
          />
          <button type="submit" className="d-btn primary" disabled={busy || !text.trim()}>Ajouter</button>
        </form>
        {comments.length === 0 && <p className="muted small">Pas encore de commentaire. Note ici ce qui a été fait, une offre reçue, un numéro de client…</p>}
        {comments.length > 0 && (
          <div className="d-card">
            {comments.map((c) => (
              <div key={`${c.at}-${c.by}`} className="dl-comment">
                <Avatar h={h} owner={c.by} size={30} />
                <div className="col grow min0 gap2">
                  <span className="dl-comment-meta">{toneOf(h, c.by).name} · {when(c.at)}</span>
                  <p className="dl-comment-text">{c.text}</p>
                </div>
                {c.by === me && (
                  <button className="dl-comment-x" aria-label="Supprimer ce commentaire" onClick={() => deleteDeadlineComment(h.id, d.id, c)}>{Icon.close}</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** « 29 oct. 2026 · 18:42 » */
function when(iso: string) {
  const x = new Date(iso);
  const k = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return `${shortDate(k)} ${x.getFullYear()} · ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
}
