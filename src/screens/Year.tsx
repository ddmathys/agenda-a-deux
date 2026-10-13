import { useState } from 'react';
import { ageOn, stayDays } from '../birthday';
import { MONTHS, shortDate, todayKey } from '../dates';
import { ownerChoices, toneOf } from '../tones';
import type { EventItem, Household } from '../types';
import { Avatar, Icon } from '../ui';
import { VacationWidget } from '../widgets';

interface Props {
  h: Household;
  me: string;
  events: EventItem[];
  onEditEvent: (e: EventItem) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Le mural de l'année : douze petits calendriers, les vacances et les anniversaires
 * en couleur, puis le compteur de vacances et les listes.
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

  // Un petit calendrier par mois : vacances en couleur de la personne, anniversaires en rond jaune.
  const month = (m: number) => {
    const blanks = (new Date(year, m, 1).getDay() + 6) % 7;
    const len = new Date(year, m + 1, 0).getDate();
    const cur = `${year}-${pad(m + 1)}` === today.slice(0, 7);
    return (
      <div key={m} className={cur ? 'mini cur' : 'mini'}>
        <span className="mini-name">{MONTHS[m].charAt(0).toUpperCase() + MONTHS[m].slice(1)}</span>
        <div className="mini-grid">
          {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: len }, (_, i) => {
            const k = `${year}-${pad(m + 1)}-${pad(i + 1)}`;
            const owners = [...new Set(stays.filter((s) => s.date <= k && k <= s.dateEnd!).map((s) => s.owner))];
            const tones = owners.map((o) => toneOf(h, o).soft);
            const bg = tones.length === 0 ? undefined : tones.length === 1 ? tones[0] : `linear-gradient(135deg, ${tones[0]} 50%, ${tones[1]} 50%)`;
            const cls = `mini-d${bdayDays.has(k) ? ' bday' : ''}${k === today ? ' now' : ''}${bg ? ' on' : ''}`;
            return <span key={k} className={cls} style={bg && !bdayDays.has(k) ? { background: bg } : undefined}>{i + 1}</span>;
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="screen">
      <header className="page-head">
        <div className="col gap4">
          <span className="kicker" style={{ color: '#5530C9' }}>Notre mural</span>
          <h1>{year}</h1>
        </div>
        <div className="row gap8">
          <button className="sq-btn" aria-label="Année précédente" onClick={() => setYear(year - 1)}>{Icon.left}</button>
          <button className="sq-btn dark" aria-label="Année suivante" onClick={() => setYear(year + 1)}>{Icon.right}</button>
        </div>
      </header>

      <div className="wall-legend">
        {ownerChoices(h, me).map((c) => (
          <span key={c.id} className="row gap4 center"><span className="wall-key" style={{ background: toneOf(h, c.id).soft }} />{c.label}</span>
        ))}
        <span className="row gap4 center"><span className="wall-key round" />Anniversaire</span>
      </div>

      <section className="minis" aria-label={`Vacances et anniversaires ${year}`}>
        {Array.from({ length: 12 }, (_, m) => month(m))}
      </section>

      <VacationWidget h={h} me={me} events={events} year={year} today={today} />

      <section className="col gap10">
        <div className="section-head"><h2>🏖️ Vacances</h2></div>
        {stays.length === 0 && (
          <p className="empty">Aucunes vacances en {year}. Ajoute-les avec le +, case « Vacances, du… au… ».</p>
        )}
        {stays.map((e) => {
          const t = toneOf(h, e.owner);
          return (
            <button key={e.id} className="ev-block" onClick={() => onEditEvent(e)}>
              <span className="ev-time" style={{ background: t.c, color: t.on }}>
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
