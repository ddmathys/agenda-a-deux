import { stayDays } from '../birthday';
import { MONTHS_SHORT, fromKey, shortDate, todayKey } from '../dates';
import { toneOf } from '../tones';
import type { EventItem, Household } from '../types';
import { Avatar, Empty, Icon } from '../ui';
import { daysUntil } from '../vacation';
import { VacationWidget } from '../widgets';

interface Props {
  h: Household;
  me: string;
  events: EventItem[];
  onBack: () => void;
  onAdd: () => void;
  onEditEvent: (e: EventItem) => void;
}

/**
 * Toutes les vacances : celles en cours et à venir (la prochaine en grand),
 * le compteur de l'année, puis celles déjà passées.
 */
export function Vacations({ h, me, events, onBack, onAdd, onEditEvent }: Props) {
  const today = todayKey();
  const all = events.filter((e) => e.vacation && e.dateEnd).sort((a, b) => a.date.localeCompare(b.date));
  const coming = all.filter((e) => e.dateEnd! >= today);
  const past = all.filter((e) => e.dateEnd! < today).reverse();
  const next = coming[0];
  const nextIn = next ? daysUntil(next.date, today) : 0;

  const line = (e: EventItem) => {
    const t = toneOf(h, e.owner);
    const d = fromKey(e.date);
    const n = daysUntil(e.date, today);
    const when = e.date <= today && today <= e.dateEnd! ? 'en cours' : n > 0 ? `dans ${n} jour${n > 1 ? 's' : ''}` : '';
    return (
      <button key={e.id} className="bday-line" onClick={() => onEditEvent(e)}>
        <span className="bday-cal" style={{ background: t.s }} aria-hidden="true">
          <span className="bday-cal-n" style={{ color: t.t }}>{d.getDate()}</span>
          <span className="bday-cal-m" style={{ color: t.t }}>{MONTHS_SHORT[d.getMonth()]}</span>
        </span>
        <span className="col grow min0 gap2">
          <span className="bday-name ell">{e.title}</span>
          <span className="bday-meta">
            {[`${shortDate(e.date)} → ${shortDate(e.dateEnd!)}`, `${stayDays(e)} j`, e.place, when].filter(Boolean).join(' · ')}
          </span>
        </span>
        <Avatar h={h} owner={e.owner} size={28} soft />
      </button>
    );
  };

  return (
    <div className="screen">
      <header className="page-head center">
        <div className="col gap2">
          <button className="back-link" onClick={onBack}>{Icon.left}Agenda</button>
          <h1>Vacances</h1>
        </div>
        <button className="sq-btn dark" aria-label="Ajouter des vacances" onClick={onAdd}>{Icon.plusSm}</button>
      </header>

      {next ? (
        <button className="bday-hero vac" onClick={() => onEditEvent(next)}>
          <span className="count-kicker">{nextIn <= 0 ? 'En ce moment' : 'Les prochaines'}</span>
          <span className="bday-hero-row">
            <span className="count-big">{nextIn <= 0 ? 'En cours' : `J-${nextIn}`}</span>
            <span className="bday-hero-cake" aria-hidden="true">🏖️</span>
          </span>
          <span className="bday-hero-name">{next.title}</span>
          <span className="count-sub">{shortDate(next.date)} → {shortDate(next.dateEnd!)} · {stayDays(next)} jours{next.place ? ` · ${next.place}` : ''}</span>
        </button>
      ) : (
        <Empty>Aucunes vacances prévues. Touche + pour en ajouter.</Empty>
      )}

      <VacationWidget h={h} me={me} events={events} year={Number(today.slice(0, 4))} today={today} />

      {coming.length > 1 && (
        <section className="col gap8">
          <h2 className="md-day">À venir</h2>
          <div className="card-list">{coming.slice(1).map(line)}</div>
        </section>
      )}

      {past.length > 0 && (
        <section className="col gap8">
          <h2 className="md-day">Déjà passées</h2>
          <div className="card-list">{past.map(line)}</div>
        </section>
      )}
    </div>
  );
}
