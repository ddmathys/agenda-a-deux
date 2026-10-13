import { useState } from 'react';
import { ageOn, stayDays } from '../birthday';
import { MONTHS_SHORT, cap, shortDate, todayKey } from '../dates';
import { ownerChoices, toneOf } from '../tones';
import type { EventItem, Household } from '../types';
import { Avatar, Icon } from '../ui';

interface Props {
  h: Household;
  me: string;
  events: EventItem[];
  onEditEvent: (e: EventItem) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const BDAY = '#FF7A1A';

/**
 * Le mural de l'année : une ligne par mois, une case par jour.
 * Les vacances colorent les cases (couleur de la personne), les anniversaires y font un point.
 */
export function Year({ h, me, events, onEditEvent }: Props) {
  const today = todayKey();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const y0 = `${year}-01-01`;
  const y1 = `${year}-12-31`;

  const stays = events
    .filter((e) => e.vacation && e.dateEnd && e.date <= y1 && e.dateEnd >= y0)
    .sort((a, b) => a.date.localeCompare(b.date));
  // Un anniversaire compte à partir de l'année de la fiche ; le 29.02 se fête le 28 les autres années.
  const bdays = events
    .filter((e) => e.birthday && e.date.slice(0, 4) <= String(year))
    .map((e) => {
      let md = e.date.slice(5);
      if (md === '02-29' && new Date(year, 1, 29).getMonth() !== 1) md = '02-28';
      return { e, k: `${year}-${md}` };
    })
    .sort((a, b) => a.k.localeCompare(b.k));
  const bdayDays = new Set(bdays.map((b) => b.k));

  const cell = (month: number, day: number) => {
    const d = new Date(year, month, day);
    if (d.getMonth() !== month) return <span key={day} className="wall-cell none" />;
    const k = `${year}-${pad(month + 1)}-${pad(day)}`;
    const owners = [...new Set(stays.filter((s) => s.date <= k && k <= s.dateEnd!).map((s) => s.owner))];
    const tones = owners.map((o) => toneOf(h, o).c);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const bg = tones.length === 0 ? undefined : tones.length === 1 ? tones[0] : `linear-gradient(${tones[0]} 50%, ${tones[1]} 50%)`;
    return (
      <span
        key={day}
        className={`wall-cell${weekend ? ' we' : ''}${k === today ? ' now' : ''}`}
        style={bg ? { background: bg } : undefined}
      >
        {bdayDays.has(k) && <span className="wall-dot" style={{ background: tones.length ? '#FFFFFF' : BDAY }} />}
      </span>
    );
  };

  return (
    <div className="screen">
      <header className="page-head">
        <div className="col gap4">
          <span className="kicker" style={{ color: '#7048E8' }}>Le mural</span>
          <h1>{year}</h1>
        </div>
        <div className="row gap8">
          <button className="sq-btn" aria-label="Année précédente" onClick={() => setYear(year - 1)}>{Icon.left}</button>
          <button className="sq-btn dark" aria-label="Année suivante" onClick={() => setYear(year + 1)}>{Icon.right}</button>
        </div>
      </header>

      <section className="wall" aria-label={`Vacances et anniversaires ${year}`}>
        <div className="wall-row wall-head" aria-hidden="true">
          <span className="wall-m" />
          {DAYS.map((d) => <span key={d} className="wall-n">{d === 1 || d % 5 === 0 ? d : ''}</span>)}
        </div>
        {MONTHS_SHORT.map((m, i) => (
          <div key={m} className={`wall-row${`${year}-${pad(i + 1)}` === today.slice(0, 7) ? ' cur' : ''}`}>
            <span className="wall-m">{cap(m.replace('.', ''))}</span>
            {DAYS.map((d) => cell(i, d))}
          </div>
        ))}
        <div className="wall-legend">
          {ownerChoices(h, me).map((c) => (
            <span key={c.id} className="row gap4 center"><span className="wall-key" style={{ background: toneOf(h, c.id).c }} />{c.label}</span>
          ))}
          <span className="row gap4 center"><span className="wall-key round" style={{ background: BDAY }} />Anniversaire</span>
        </div>
      </section>

      <section className="col gap10">
        <div className="section-head"><h2>🏖️ Vacances</h2></div>
        {stays.length === 0 && (
          <p className="empty">Aucunes vacances en {year}. Ajoute-les avec le +, case « Vacances, du… au… ».</p>
        )}
        {stays.map((e) => {
          const t = toneOf(h, e.owner);
          return (
            <button key={e.id} className="ev-block" onClick={() => onEditEvent(e)}>
              <span className="ev-time" style={{ background: t.c }}>
                <span className="ev-start">{stayDays(e)}</span>
                <span className="ev-end">{stayDays(e) === 1 ? 'jour' : 'jours'}</span>
              </span>
              <span className="row grow min0 gap10 center ev-body">
                <span className="col grow min0 gap2">
                  <span className="ev-title ell">{e.title}</span>
                  <span className="ev-meta">
                    {shortDate(e.date)} → {shortDate(e.dateEnd!)}{e.place ? ` · ${e.place}` : ''}
                  </span>
                </span>
                <Avatar h={h} owner={e.owner} size={28} soft />
              </span>
            </button>
          );
        })}
      </section>

      <section className="col gap10">
        <div className="section-head"><h2>🎂 Anniversaires</h2></div>
        {bdays.length === 0 && <p className="empty">Aucun anniversaire noté.</p>}
        {bdays.length > 0 && (
          <div className="card-list">
            {bdays.map(({ e, k }) => (
              <button key={e.id} className={`bday-row${k < today ? ' past' : ''}`} onClick={() => onEditEvent(e)}>
                <span className="bday-date">{shortDate(k)}</span>
                <span className="grow min0 ell">{e.title}</span>
                {ageOn(e, k) && <span className="chip" style={{ background: '#FFEBDC', color: '#9A4300' }}>{ageOn(e, k)}</span>}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
