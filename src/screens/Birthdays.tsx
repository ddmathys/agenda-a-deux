import { ageOn, nextBirthday } from '../birthday';
import { cap, DAYS, fromKey, MONTHS, MONTHS_SHORT, todayKey } from '../dates';
import type { EventItem, Household } from '../types';
import { Avatar, Empty, Icon } from '../ui';
import { daysUntil } from '../vacation';

interface Props {
  h: Household;
  events: EventItem[];
  onAdd: () => void;
  onEditEvent: (e: EventItem) => void;
}

/** « dans 12 jours », « demain », « aujourd'hui ! » */
function inDays(n: number): string {
  if (n === 0) return 'aujourd’hui !';
  if (n === 1) return 'demain';
  return `dans ${n} jours`;
}

/**
 * Tous les anniversaires, du plus proche au plus lointain, regroupés par mois,
 * avec en tête le prochain en grand.
 */
export function Birthdays({ h, events, onAdd, onEditEvent }: Props) {
  const today = todayKey();
  const list = events
    .filter((e) => e.birthday)
    .map((e) => ({ e, on: nextBirthday([e], today)?.on ?? e.date }))
    .sort((a, b) => a.on.localeCompare(b.on));
  const next = list[0];

  // Regroupés par mois, dans l'ordre où ils arrivent.
  const groups: { label: string; items: typeof list }[] = [];
  for (const it of list) {
    const d = fromKey(it.on);
    const label = `${cap(MONTHS[d.getMonth()])} ${d.getFullYear()}`;
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(it);
    else groups.push({ label, items: [it] });
  }

  return (
    <div className="screen">
      <header className="page-head center">
        <div className="col gap2">
          <span className="kicker" style={{ color: '#9A4300' }}>{list.length} à fêter</span>
          <h1>Anniversaires</h1>
        </div>
        <button className="sq-btn dark" aria-label="Ajouter un anniversaire" onClick={onAdd}>{Icon.plusSm}</button>
      </header>

      {next && (
        <button className="bday-hero" onClick={() => onEditEvent(next.e)}>
          <span className="count-kicker">Le prochain</span>
          <span className="bday-hero-row">
            <span className="count-big">{daysUntil(next.on, today) === 0 ? 'Jour J' : `J-${daysUntil(next.on, today)}`}</span>
            <span className="bday-hero-cake" aria-hidden="true">🎂</span>
          </span>
          <span className="bday-hero-name">{next.e.title}</span>
          <span className="count-sub">
            {[ageOn(next.e, next.on) && `fête ses ${ageOn(next.e, next.on)}`, `${DAYS[fromKey(next.on).getDay()]} ${fromKey(next.on).getDate()} ${MONTHS[fromKey(next.on).getMonth()]}`].filter(Boolean).join(' · ')}
          </span>
        </button>
      )}

      {list.length === 0 && <Empty>Aucun anniversaire noté. Touche + pour en ajouter un.</Empty>}

      {groups.map((g) => (
        <section key={g.label} className="col gap8">
          <h2 className="md-day">{g.label}</h2>
          <div className="card-list">
            {g.items.map(({ e, on }) => {
              const d = fromKey(on);
              const n = daysUntil(on, today);
              return (
                <button key={e.id} className="bday-line" onClick={() => onEditEvent(e)}>
                  <span className="bday-cal" aria-hidden="true">
                    <span className="bday-cal-n">{d.getDate()}</span>
                    <span className="bday-cal-m">{MONTHS_SHORT[d.getMonth()]}</span>
                  </span>
                  <span className="col grow min0 gap2">
                    <span className="bday-name ell">{e.title}</span>
                    <span className="bday-meta">{[ageOn(e, on) && `${ageOn(e, on)}`, inDays(n)].filter(Boolean).join(' · ')}</span>
                  </span>
                  {n <= 30 && <span className="chip" style={{ background: '#FFF0B8', color: '#7A4A00' }}>J-{n}</span>}
                  <Avatar h={h} owner={e.owner} size={28} soft />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
