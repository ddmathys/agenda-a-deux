import { useEffect, useState, type FormEvent } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { addEvent, chooseIdea, setHome, useIdeas } from '../data';
import { addDays, cap, DAYS, fromKey, keyOf, MONTHS_SHORT } from '../dates';
import { eventsOn } from '../birthday';
import type { EventItem, Home, Household, Idea } from '../types';
import { isNice, searchPlace, wmo, type DayWeather, type Forecast } from '../weather';
import { Icon } from '../ui';

export type Slot = 'day' | 'evening';

const dayName = (k: string) => DAYS[fromKey(k).getDay()];
/** « samedi 1 nov. » */
const dayShort = (k: string) => {
  const d = fromKey(k);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};
const wLine = (w?: DayWeather) => (w ? `${wmo(w.code).emoji} ${w.tmax}°` : '');
/** Rendez-vous qui occupent vraiment la journée (un anniversaire ne bloque rien). */
const busyOn = (events: EventItem[], k: string) => eventsOn(events, k).filter((e) => !e.birthday);

/**
 * La carte « vivante » : le week-end qui arrive (jeudi → dimanche) ou une soirée libre en semaine,
 * avec la météo et un bouton pour demander des idées de sorties.
 */
export function momentPlan(events: EventItem[], now: Date): { title: string; days: { k: string; slot: Slot }[] } | null {
  const dow = now.getDay();
  const today = keyOf(now);
  let title = '';
  let days: { k: string; slot: Slot }[] = [];

  if (dow === 0) {
    title = 'Dernier jour du week-end';
    days = [{ k: today, slot: 'day' }];
  } else if (dow >= 4) {
    const sat = keyOf(addDays(now, 6 - dow));
    days = [sat, keyOf(addDays(fromKey(sat), 1))].filter((k) => k >= today).map((k) => ({ k, slot: 'day' as Slot }));
    title = dow === 4 ? 'Le week-end arrive 🎉' : dow === 5 ? 'Demain, c’est le week-end 🎉' : 'C’est le week-end !';
  } else {
    // En semaine : seulement quand la soirée est libre.
    const h0 = now.getHours();
    if (h0 < 12 || h0 >= 21 || busyOn(events, today).some((e) => !e.start || e.start >= '17:00')) return null;
    title = 'Ce soir, c’est libre 🌙';
    days = [{ k: today, slot: 'evening' }];
  }
  return days.length ? { title, days } : null;
}

export function MomentCard({ h, events, forecast, now, onIdeas }: {
  h: Household; events: EventItem[]; forecast: Forecast | null; now: Date; onIdeas: (day: string, slot: Slot) => void;
}) {
  if (!h.home) return <HomePicker h={h} />;
  const plan = momentPlan(events, now);
  if (!plan) return null;
  const { title, days } = plan;

  const ws = days.map((d) => forecast?.[d.k]).filter((w): w is DayWeather => !!w);
  const nice = days.filter((d) => forecast?.[d.k] && isNice(forecast[d.k]));
  let mood = 'Qu’est-ce qu’on fait ?';
  if (ws.length) {
    if (nice.length === days.length) mood = days.length > 1 ? 'Il va faire beau ☀️ : parfait pour sortir.' : `Il fera beau, ${ws[0].tmax}° ☀️ : profitez-en.`;
    else if (!nice.length) mood = `Ça s’annonce ${wmo(ws[0].code).label} ${wmo(ws[0].code).emoji} : des idées au sec ?`;
    else mood = `${cap(dayName(nice[0].k))} sera le plus beau ${wmo(forecast![nice[0].k].code).emoji}`;
  }
  const sunny = ws.length > 0 && nice.length > 0;

  return (
    <section className={sunny ? 'moment sunny' : 'moment grey'}>
      <span className="moment-float" aria-hidden="true">{ws.length ? wmo(ws[0].code).emoji : '✨'}</span>
      <span className="moment-kicker">{h.home.name}</span>
      <h2 className="moment-title">{title}</h2>
      <p className="moment-mood">{mood}</p>
      <div className="col gap8">
        {days.map(({ k, slot }) => {
          const n = busyOn(events, k).filter((e) => slot === 'day' || !e.start || e.start >= '17:00').length;
          return (
            <div key={k} className="moment-day">
              <span className="col grow min0">
                <span className="moment-dname">{slot === 'evening' ? 'Ce soir' : cap(dayShort(k))}</span>
                <span className="moment-dsub">
                  {[wLine(forecast?.[k]), n ? `${n} rendez-vous` : 'rien de prévu'].filter(Boolean).join(' · ')}
                </span>
              </span>
              <button className="moment-btn" onClick={() => onIdeas(k, slot)}>{Icon.spark}Des idées</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Première fois : où habitez-vous ? (pour la météo et les idées près de chez vous) */
function HomePicker({ h }: { h: Household }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Home[] | null>(null);
  const [busy, setBusy] = useState(false);
  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    setList(await searchPlace(q.trim()).catch(() => []));
    setBusy(false);
  };
  return (
    <section className="moment grey">
      <span className="moment-float" aria-hidden="true">🌤️</span>
      <span className="moment-kicker">Nouveau</span>
      <h2 className="moment-title">Où habitez-vous ?</h2>
      <p className="moment-mood">Pour la météo et des idées de sorties près de chez vous quand l’agenda est libre.</p>
      <form className="row gap8" onSubmit={search}>
        <label className="sr-only" htmlFor="home-q">Ville</label>
        <input id="home-q" className="moment-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bulle, Fribourg…" enterKeyHint="search" />
        <button className="moment-btn" type="submit" disabled={busy}>Chercher</button>
      </form>
      {list && list.length === 0 && <p className="moment-dsub">Aucune ville trouvée.</p>}
      {list && list.length > 0 && (
        <div className="col gap6">
          {list.map((p) => (
            <button key={`${p.lat},${p.lon}`} className="moment-place" onClick={() => setHome(h.id, p)}>
              <b>{p.name}</b> {p.region && <span>{p.region}</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

const suggest = httpsCallable<{ day: string; slot: Slot; more?: boolean }, { ok: boolean }>(functions, 'suggestIdeas');

const endOf = (start: string, minutes: number) => {
  const t = Math.min(23 * 60 + 59, Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + minutes);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const duration = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`);

/** Les idées d'un jour : on en choisit une, elle part dans l'agenda pour « Nous ». */
export function IdeasSheet({ h, me, day, slot, forecast, onClose }: {
  h: Household; me: string; day: string; slot: Slot; forecast: Forecast | null; onClose: () => void;
}) {
  const ideas = useIdeas(h.id, day);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const ask = async (more = false) => {
    setLoading(true);
    setError('');
    try {
      await suggest({ day, slot, more });
    } catch (e) {
      setError((e as { message?: string }).message || 'Les idées ne répondent pas. Réessaie.');
    }
    setLoading(false);
  };

  // Pas encore d'idées pour ce jour (ou pour un autre moment) : on les demande tout de suite.
  const missing = ideas === null || (ideas !== undefined && ideas.slot !== slot);
  useEffect(() => {
    if (missing && !loading && !error) ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  const pick = async (idea: Idea, i: number) => {
    await addEvent(h.id, me, {
      title: idea.title,
      date: day,
      start: idea.start,
      end: idea.start ? endOf(idea.start, idea.duration) : null,
      place: idea.place,
      owner: 'both',
    });
    await chooseIdea(h.id, day, i);
    navigator.vibrate?.(20);
    setDone(idea.title);
    setTimeout(onClose, 1400);
  };

  const w = forecast?.[day] ?? ideas?.weather ?? undefined;
  const items = ideas && ideas.slot === slot ? ideas.items : [];

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Idées de sorties">
      <div className="scrim" onClick={onClose} />
      <div className="sheet">
        <span className="grabber" aria-hidden="true" />
        <div className="row between center">
          <div className="col min0">
            <h2 className="sheet-title">Des idées ✨</h2>
            <span className="sub">
              {slot === 'evening' ? 'Ce soir' : cap(dayShort(day))}
              {w && ` · ${wmo(w.code).emoji} ${wmo(w.code).label}, ${w.tmin}–${w.tmax}°`}
            </span>
          </div>
          <button className="round-btn" onClick={onClose} aria-label="Fermer">{Icon.close}</button>
        </div>

        {done && <p className="idea-done" role="status">🎉 « {done} » est dans votre agenda !</p>}

        {(loading || ideas === undefined) && (
          <div className="idea-wait" role="status">
            <span className="idea-wait-dot" aria-hidden="true">🧭</span>
            Je cherche des idées autour de {h.home?.name}…
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}

        {!loading && items.map((idea, i) => {
          const chosen = ideas?.chosen === i;
          return (
            <article key={`${i}-${idea.title}`} className={chosen ? 'idea chosen' : 'idea'} style={{ animationDelay: `${i * 70}ms` }}>
              <span className="idea-emoji" aria-hidden="true">{idea.emoji}</span>
              <div className="col grow min0 gap4">
                <h3 className="idea-title">{idea.title}</h3>
                <p className="idea-why">{idea.why}</p>
                <div className="row wrap gap6">
                  {idea.place && <span className="idea-chip">{Icon.pin}{idea.place}</span>}
                  {idea.start && <span className="idea-chip">{idea.start} · {duration(idea.duration)}</span>}
                  {idea.cost && <span className="idea-chip">{idea.cost}</span>}
                  <span className="idea-chip">{idea.indoor ? 'au sec' : 'dehors'}</span>
                </div>
                <button className={chosen ? 'idea-go on' : 'idea-go'} onClick={() => pick(idea, i)} disabled={chosen || !!done}>
                  {chosen ? '✓ C’est validé' : 'On fait ça ✓'}
                </button>
              </div>
            </article>
          );
        })}

        {!loading && items.length > 0 && (
          <button className="btn-ghost" onClick={() => ask(true)}>🔄 D’autres idées</button>
        )}
        {!loading && error && !items.length && <button className="btn-outline" onClick={() => ask()}>Réessayer</button>}
      </div>
    </div>
  );
}
