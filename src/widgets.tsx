import { ageOn, nextBirthday, stayDays } from './birthday';
import { DAYS, fromKey, shortDate } from './dates';
import { ownerChoices, toneOf } from './tones';
import type { EventItem, Household } from './types';
import { daysUntil, nextVacation, vacationCount } from './vacation';

/**
 * Les deux comptes à rebours côte à côte : prochain anniversaire et prochaines vacances,
 * puis, en petit dessous, le cumul de jours de vacances de l'année.
 */
export function Countdowns({ h, me, events, today, onYear, onBirthdays, onVacations }: {
  h: Household; me: string; events: EventItem[]; today: string; onOpen: (e: EventItem) => void; onYear: () => void; onBirthdays: () => void; onVacations: () => void;
}) {
  const vac = nextVacation(events, today);
  const bday = nextBirthday(events, today);
  const vacIn = vac ? daysUntil(vac.date, today) : 0;
  const bdayIn = bday ? daysUntil(bday.on, today) : 0;
  const year = Number(today.slice(0, 4));
  const mine = vacationCount(events, me, year, today);
  return (
    <div className="col gap8">
      <div className="count-grid">
        {bday ? (
          <button className="count-card sun" onClick={onBirthdays}>
            <span className="count-kicker">Anniversaire</span>
            <span className="count-big">{bdayIn === 0 ? 'Jour J' : `J-${bdayIn}`}</span>
            <span className="count-title ell">{[bday.e.title, ageOn(bday.e, bday.on)].filter(Boolean).join(' · ')}</span>
            <span className="count-sub">{DAYS[fromKey(bday.on).getDay()]} {shortDate(bday.on)}</span>
          </button>
        ) : (
          <button className="count-card sun" onClick={onBirthdays}>
            <span className="count-kicker">Anniversaire</span>
            <span className="count-big">—</span>
            <span className="count-sub">Aucun noté pour l’instant</span>
          </button>
        )}
        {vac ? (
          <button className="count-card lilac" onClick={onVacations}>
            <span className="count-kicker">Vacances</span>
            <span className="count-big">{vacIn <= 0 ? 'En cours' : `J-${vacIn}`}</span>
            <span className="count-title ell">{vac.title}</span>
            <span className="count-sub">{shortDate(vac.date)} → {shortDate(vac.dateEnd!)} · {stayDays(vac)} j</span>
          </button>
        ) : (
          <button className="count-card lilac" onClick={onVacations}>
            <span className="count-kicker">Vacances</span>
            <span className="count-big">—</span>
            <span className="count-sub">Rien de prévu : ajoute-les avec le +</span>
          </button>
        )}
      </div>
      <button className="vac-line" onClick={onVacations}>
        <span className="pill-dot" style={{ background: toneOf(h, me).c }} />
        Vacances {year} : <b>{mine.taken} {mine.taken > 1 ? 'jours pris' : 'jour pris'}</b>
        {mine.planned > 0 && <> · {mine.planned} prévu{mine.planned > 1 ? 's' : ''}</>}
      </button>
    </div>
  );
}

/** Le compteur de vacances de l'année : jours de congé pris et prévus, pour chacun. */
export function VacationWidget({ h, me, events, year, today, onClick }: {
  h: Household; me: string; events: EventItem[]; year: number; today: string; onClick?: () => void;
}) {
  const people = ownerChoices(h, me).filter((c) => c.id !== 'both');
  const mine = vacationCount(events, me, year, today);
  const others = people.filter((p) => p.id !== me);
  const body = (
    <>
      <span className="count-kicker">Mes vacances {year}</span>
      <span className="row baseline gap8">
        <span className="count-big">{mine.taken}</span>
        <span className="vw-unit">{mine.taken > 1 ? 'jours pris' : 'jour pris'}</span>
        {mine.planned > 0 && <span className="vw-plan">+ {mine.planned} prévu{mine.planned > 1 ? 's' : ''}</span>}
      </span>
      <span className="vw-bar" aria-hidden="true">
        <span style={{ flexGrow: mine.taken, background: toneOf(h, me).c }} />
        <span style={{ flexGrow: mine.planned, background: toneOf(h, me).c, opacity: 0.35 }} />
      </span>
      {others.map((p) => {
        const n = vacationCount(events, p.id, year, today);
        return (
          <span key={p.id} className="vw-other">
            <span className="pill-dot" style={{ background: toneOf(h, p.id).c }} />
            {p.label} : {n.taken} pris{n.planned ? ` · ${n.planned} prévus` : ''}
          </span>
        );
      })}
      <span className="vw-note">Jours de congé, du lundi au vendredi</span>
    </>
  );
  return onClick ? <button className="count-card peach wide" onClick={onClick}>{body}</button> : <div className="count-card peach wide">{body}</div>;
}
