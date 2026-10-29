import { useState } from 'react';
import { ageOn, eventsOn, stayDays } from '../birthday';
import { cap, MONTHS, MONTHS_SHORT, shortDate, todayKey } from '../dates';
import { ownerChoices, toneOf } from '../tones';
import type { EventItem, Household, Task } from '../types';
import { MonthDetail } from './MonthDetail';
import { Icon, scrollToTop } from '../ui';
import { VacationWidget } from '../widgets';

interface Props {
  h: Household;
  me: string;
  events: EventItem[];
  tasks: Task[];
  onEditEvent: (e: EventItem) => void;
  onEditTask: (t: Task) => void;
  onPick: (day: string | null) => void;
  onAdd: (date: string) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Le mural : douze mois à partir du mois en cours, présentés comme l'agenda.
 * Chaque mois garde son calendrier (vacances en capsules de couleur, anniversaires
 * en rond jaune) et ses annotations : les vacances et les anniversaires du mois.
 */
export function Year({ h, me, events, tasks, onEditEvent, onEditTask, onPick, onAdd }: Props) {
  const today = todayKey();
  const now = new Date();
  // Décalage en mois depuis le mois en cours (les flèches avancent de 12 mois).
  const [shift, setShift] = useState(0);
  // Mois ouvert en détail (null = le mural).
  const [open, setOpen] = useState<{ y: number; m: number } | null>(null);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + shift + i, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const first = `${months[0].y}-${pad(months[0].m + 1)}-01`;
  const lastM = months[11];
  const last = `${lastM.y}-${pad(lastM.m + 1)}-${pad(new Date(lastM.y, lastM.m + 1, 0).getDate())}`;

  const stays = events
    .filter((e) => e.vacation && e.dateEnd && e.date <= last && e.dateEnd >= first)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Un anniversaire compte à partir de l'année de la fiche ; le 29.02 se fête le 28 les autres années.
  const bdaysOf = (y: number, m: number) =>
    events
      .filter((e) => e.birthday && e.date.slice(0, 4) <= String(y) && Number(e.date.slice(5, 7)) === m + 1)
      .map((e) => {
        let md = e.date.slice(5);
        if (md === '02-29' && new Date(y, 1, 29).getMonth() !== 1) md = '02-28';
        return { e, k: `${y}-${md}` };
      })
      .sort((a, b) => a.k.localeCompare(b.k));

  if (open !== null) {
    return (
      <MonthDetail
        h={h}
        events={events}
        tasks={tasks}
        year={open.y}
        month={open.m}
        onBack={() => { onPick(null); setOpen(null); }}
        onMonth={(y, m) => setOpen({ y, m })}
        onEditEvent={onEditEvent}
        onEditTask={onEditTask}
        onPick={onPick}
        onAdd={onAdd}
      />
    );
  }

  const range = `${MONTHS_SHORT[months[0].m]} ${months[0].y} → ${MONTHS_SHORT[lastM.m]} ${lastM.y}`;

  return (
    <div className="screen dash">
      <header className="d-head">
        <span className="d-stamp">NOTRE MURAL</span>
        <h1 className="d-hello">{shift === 0 ? <>Les <em>12 mois</em> à venir</> : <>Plus <em>loin</em></>}</h1>
        <div className="wall-legend">
          {ownerChoices(h, me).map((c) => (
            <span key={c.id} className="row gap4 center"><span className="wall-key" style={{ background: toneOf(h, c.id).soft }} />{c.label}</span>
          ))}
          <span className="row gap4 center"><span className="wall-key round" />Anniversaire</span>
        </div>
      </header>

      <div className="d-sec center">
        <div className="col gap2 grow min0">
          <h2>{shift === 0 ? 'Dès ce mois-ci' : 'Mois suivants'}</h2>
          <span className="d-mono">{range}</span>
        </div>
        <button className="sq-btn" aria-label="12 mois plus tôt" onClick={() => { setShift(shift - 12); scrollToTop(); }}>{Icon.left}</button>
        <button className="sq-btn dark" aria-label="12 mois plus tard" onClick={() => { setShift(shift + 12); scrollToTop(); }}>{Icon.right}</button>
      </div>

      <section className="col gap18">
        {months.map(({ y, m }) => {
          const prefix = `${y}-${pad(m + 1)}`;
          const len = new Date(y, m + 1, 0).getDate();
          const blanks = (new Date(y, m, 1).getDay() + 6) % 7;
          const keys = Array.from({ length: len }, (_, i) => `${prefix}-${pad(i + 1)}`);
          const cur = prefix === today.slice(0, 7);
          const monthStays = stays.filter((s) => s.date <= keys[len - 1] && s.dateEnd! >= keys[0]);
          const bdays = bdaysOf(y, m);
          const bdayDays = new Set(bdays.map((b) => b.k));
          const ownersOn = (k: string) => [...new Set(monthStays.filter((s) => s.date <= k && k <= s.dateEnd!).map((s) => s.owner))];
          const sig = (k?: string) => (k ? ownersOn(k).join() : '');
          const summary = [
            monthStays.length && `${monthStays.length} vacances`,
            bdays.length && `${bdays.length} anniv.`,
          ].filter(Boolean).join(' · ');
          const openMonth = () => { setOpen({ y, m }); scrollToTop(); };

          return (
            <section key={prefix} className={cur ? 'd-day today' : 'd-day'} aria-label={`${MONTHS[m]} ${y}`}>
              <div className="d-date">
                <span className="d-kicker">{y}</span>
                <span className="d-num ym-num">{cap(MONTHS_SHORT[m]).replace('.', '')}</span>
              </div>
              <div className="col gap8 grow min0">
                <div className="d-dayhead">
                  <span className="d-daytitle">{cap(MONTHS[m])}{cur ? ' · ce mois-ci' : ''}</span>
                  {summary && <span className="d-mono">{summary}</span>}
                  <button className="d-add" onClick={() => onAdd(cur ? today : keys[0])} aria-label={`Ajouter en ${MONTHS[m]}`}>{Icon.plusSm}</button>
                </div>
                <div className="d-card">
                  <button className="ym-cal" onClick={openMonth} aria-label={`Voir ${MONTHS[m]} ${y} en détail`}>
                    {LETTERS.map((l, i) => <span key={i} className="ym-l" aria-hidden="true">{l}</span>)}
                    {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
                    {keys.map((k, i) => {
                      const owners = ownersOn(k);
                      const tones = owners.map((o) => toneOf(h, o).soft);
                      const bg = tones.length === 0 ? undefined : tones.length === 1 ? tones[0] : `linear-gradient(135deg, ${tones[0]} 50%, ${tones[1]} 50%)`;
                      // Les jours de vacances se suivent en capsule : arrondie au début, à la fin et en bord de semaine.
                      const col = (blanks + i) % 7;
                      const l = col === 0 || sig(keys[i - 1]) !== sig(k);
                      const r = col === 6 || sig(keys[i + 1]) !== sig(k);
                      const dots = [...new Set(eventsOn(events, k).filter((e) => !e.birthday && !e.vacation).map((e) => e.owner))].slice(0, 2);
                      const cls = `ym-d${bg ? ' on' : ''}${l ? ' l' : ''}${r ? ' r' : ''}${k === today ? ' now' : ''}${k < today ? ' past' : ''}`;
                      return (
                        <span key={k} className={cls} style={bg ? { background: bg } : undefined}>
                          <span className={bdayDays.has(k) ? 'ym-n bday' : 'ym-n'}>{i + 1}</span>
                          <span className="ym-dots">{dots.map((o) => <span key={o} style={{ background: toneOf(h, o).c }} />)}</span>
                        </span>
                      );
                    })}
                  </button>
                  {monthStays.map((e) => {
                    const t = toneOf(h, e.owner);
                    return (
                      <button key={e.id} className="d-row" onClick={() => onEditEvent(e)}>
                        <span className="d-bar" style={{ background: t.c }} />
                        <span className="d-ico" style={{ background: t.s }} aria-hidden="true">🏖️</span>
                        <span className="col grow min0 gap2">
                          <span className="d-title ell">{e.title}</span>
                          <span className="d-meta">{[t.name, `${shortDate(e.date)} → ${shortDate(e.dateEnd!)}`, `${stayDays(e)} j`, e.place].filter(Boolean).join(' · ')}</span>
                        </span>
                      </button>
                    );
                  })}
                  {bdays.map(({ e, k }) => (
                    <button key={e.id} className={`d-row${k < today ? ' past' : ''}`} onClick={() => onEditEvent(e)}>
                      <span className="d-bar" style={{ background: 'var(--sun)' }} />
                      <span className="d-ico" style={{ background: '#FFF0B8' }} aria-hidden="true">🎂</span>
                      <span className="col grow min0 gap2">
                        <span className="d-title ell">{e.title}</span>
                        <span className="d-meta">{[shortDate(k), ageOn(e, k)].filter(Boolean).join(' · ')}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </section>

      <button className="d-btn d-next" onClick={() => { setShift(shift + 12); scrollToTop(); }}>12 mois suivants{Icon.right}</button>

      <VacationWidget h={h} me={me} events={events} year={now.getFullYear()} today={today} />
    </div>
  );
}
