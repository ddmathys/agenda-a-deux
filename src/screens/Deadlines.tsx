import { useState } from 'react';
import { shortDate, todayKey } from '../dates';
import { cancelBy, chf, daysTo, everyLabel, inDaysLabel, KIND_INFO, KINDS, keyDate, monthly, nextOf } from '../deadlines';
import { toneOf } from '../tones';
import type { Deadline, DeadlineKind, Household } from '../types';
import { Empty, Icon } from '../ui';

interface Props {
  h: Household;
  items: Deadline[];
  onBack: () => void;
  onAdd: () => void;
  onEdit: (d: Deadline) => void;
}

const SOON = 45; // jours : ce qui arrive dans ce délai passe en tête

/**
 * Abonnements, assurances, contrats, entretien et papiers du foyer :
 * ce qu'ils coûtent, quand ils se renouvellent et jusqu'à quand on peut résilier.
 */
export function Deadlines({ h, items, onBack, onAdd, onEdit }: Props) {
  const today = todayKey();
  const [filter, setFilter] = useState<DeadlineKind | 'all'>('all');
  const sorted = [...items].sort((a, b) => keyDate(a, today).localeCompare(keyDate(b, today)));
  const shown = sorted.filter((d) => filter === 'all' || d.kind === filter);
  const soon = shown.filter((d) => daysTo(keyDate(d, today), today) <= SOON);
  const later = shown.filter((d) => daysTo(keyDate(d, today), today) > SOON);
  const perMonth = shown.reduce((s, d) => s + monthly(d), 0);
  const present = KINDS.filter((k) => items.some((d) => d.kind === k));

  return (
    <div className="screen dash">
      <header className="d-head">
        <button className="back-link" onClick={onBack}>{Icon.left}Agenda</button>
        <span className="d-stamp">ÉCHÉANCES</span>
        <h1 className="d-hello">Abos <em>&amp;</em> contrats</h1>
        {perMonth > 0 && (
          <span className="d-mono dl-total">≈ {chf(Math.round(perMonth))} / mois · {chf(Math.round(perMonth * 12))} / an</span>
        )}
      </header>

      {present.length > 1 && (
        <div className="dl-filter" role="group" aria-label="Filtrer">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')} aria-pressed={filter === 'all'}>Tout</button>
          {present.map((k) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)} aria-pressed={filter === k}>
              <span aria-hidden="true">{KIND_INFO[k].icon}</span>{KIND_INFO[k].plural}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <Empty>
          Note ici tes abonnements, assurances, contrats, l’entretien de la voiture ou les papiers à renouveler.
          Tu seras prévenu un mois avant de devoir résilier ou renouveler.
        </Empty>
      )}

      {soon.length > 0 && (
        <section className="col gap12">
          <div className="d-sec"><h2>Bientôt</h2><span className="d-mono">{SOON} prochains jours</span></div>
          <div className="d-card">{soon.map((d) => <DeadlineRow key={d.id} h={h} d={d} today={today} onEdit={onEdit} />)}</div>
        </section>
      )}

      {later.length > 0 && (
        <section className="col gap12">
          <div className="d-sec"><h2>Plus tard</h2><span className="d-mono">{later.length}</span></div>
          <div className="d-card">{later.map((d) => <DeadlineRow key={d.id} h={h} d={d} today={today} onEdit={onEdit} />)}</div>
        </section>
      )}

      <button className="d-btn primary d-next" onClick={onAdd}>{Icon.plusSm}Ajouter une échéance</button>
    </div>
  );
}

/** Une échéance : icône, nom, prochaine date, préavis et montant. */
export function DeadlineRow({ h, d, today, onEdit }: { h: Household; d: Deadline; today: string; onEdit: (d: Deadline) => void }) {
  const k = KIND_INFO[d.kind];
  const t = toneOf(h, d.owner);
  const next = nextOf(d, today);
  const cancel = cancelBy(d, today);
  const late = d.next < today && (d.kind === 'entretien' || d.kind === 'admin');
  const key = keyDate(d, today);
  const n = daysTo(key, today);
  const when = cancel && cancel >= today
    ? `Résilier d’ici le ${shortDate(cancel)} · renouvelé le ${shortDate(next)}`
    : `${d.kind === 'entretien' || d.kind === 'admin' ? 'Le' : d.every ? 'Renouvelé le' : 'Fin le'} ${shortDate(next)} · ${everyLabel(d.every).toLowerCase()}`;
  return (
    <button className="d-row" onClick={() => onEdit(d)}>
      <span className="d-bar" style={{ background: t.c }} />
      <span className="d-ico" style={{ background: k.tint }} aria-hidden="true">{k.icon}</span>
      <span className="col grow min0 gap2">
        <span className="d-title ell">{d.title}{d.provider ? <span className="dl-provider"> · {d.provider}</span> : null}</span>
        <span className="d-meta">{when}</span>
      </span>
      <span className="col gap2 dl-side">
        {d.amount ? <span className="d-amount">{chf(d.amount)}{d.per === 'year' ? '/an' : '/mois'}</span> : null}
        <span className={`dl-when${late ? ' late' : n <= 7 ? ' hot' : ''}`}>{late ? 'en retard' : inDaysLabel(n)}</span>
      </span>
    </button>
  );
}
