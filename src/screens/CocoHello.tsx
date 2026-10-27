import type { ReactNode } from 'react';
import { addDays, keyOf } from '../dates';
import { ageOn, eventsOn, nextBirthday } from '../birthday';
import { partnerUid } from '../tones';
import type { EventItem, Household, Task } from '../types';
import { daysUntil, nextVacation } from '../vacation';
import { wmo, type Forecast } from '../weather';
import { Icon } from '../ui';

/**
 * Coco dit bonjour à l'ouverture : aujourd'hui, demain, et ce qui approche.
 * Résumé calculé dans l'app (instantané, sans IA) ; on le ferme d'un geste.
 */
export function CocoHello({ h, me, events, tasks, forecast, onClose, onChat }: {
  h: Household; me: string; events: EventItem[]; tasks: Task[]; forecast: Forecast | null; onClose: () => void; onChat: () => void;
}) {
  const now = new Date();
  const today = keyOf(now);
  const tomorrow = keyOf(addDays(now, 1));
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const partner = partnerUid(h, me);
  const whose = (e: EventItem) => (e.owner === partner ? ` (${h.people[partner!]?.name})` : '');
  const byStart = (a: EventItem, b: EventItem) => (a.start ?? '').localeCompare(b.start ?? '');
  const name = h.people[me]?.name ?? '';
  const evening = now.getHours() >= 18 || now.getHours() < 5;

  /** « **Dentiste** à 08:30, **Piscine** à 18:00 (Karin) et 1 autre » */
  const list = (evs: EventItem[]): ReactNode => {
    const shown = evs.slice(0, 3);
    return (
      <>
        {shown.map((e, i) => (
          <span key={e.id}>
            {i > 0 && (i === shown.length - 1 && evs.length <= 3 ? ' et ' : ', ')}
            <b>{e.title}</b>{e.start ? ` à ${e.start}` : ''}{whose(e)}
          </span>
        ))}
        {evs.length > 3 && ` et ${evs.length - 3} autre${evs.length > 4 ? 's' : ''}`}
      </>
    );
  };

  const lines: ReactNode[] = [];
  const wToday = forecast?.[today];
  const wTomorrow = forecast?.[tomorrow];

  // Aujourd'hui : ce qui reste (le soir, on ne parle plus de ce qui est passé).
  const left = eventsOn(events, today).filter((e) => !e.birthday && (!e.start || e.start >= hm || (e.end ?? '') > hm)).sort(byStart);
  const open = tasks.filter((t) => !t.done && t.due && t.due <= today);
  const late = open.filter((t) => t.due! < today).length;
  lines.push(
    <>
      {wToday && <>{wmo(wToday.code).emoji} {wToday.tmax}° aujourd’hui. </>}
      {left.length ? <>Au programme : {list(left)}.</> : evening ? <>Plus rien au programme ce soir, repos ! 🛋️</> : <>Rien au programme aujourd’hui, profite ! ✨</>}
      {open.length > 0 && <> Et <b>{open.length} tâche{open.length > 1 ? 's' : ''}</b> à cocher{late ? ` (dont ${late} en retard 👀)` : ''}.</>}
    </>,
  );

  // Demain.
  const tmr = eventsOn(events, tomorrow).filter((e) => !e.birthday).sort(byStart);
  lines.push(
    <>
      <b>Demain</b>{wTomorrow && <> {wmo(wTomorrow.code).emoji} {wTomorrow.tmax}°</>} : {tmr.length ? <>{list(tmr)}.</> : <>c’est libre pour l’instant.</>}
    </>,
  );

  // Ce qui approche : un anniversaire dans la semaine, des vacances dans le mois.
  const b = nextBirthday(events, today);
  if (b) {
    const n = daysUntil(b.on, today);
    if (n <= 7) {
      const age = ageOn(b.e, b.on);
      lines.push(<>🎂 {n === 0 ? 'C’est l’anniversaire de' : n === 1 ? 'Demain, anniversaire de' : `Dans ${n} jours, anniversaire de`} <b>{b.e.title}</b>{age ? ` (${age})` : ''} !</>);
    }
  }
  const v = nextVacation(events, today);
  if (v) {
    const n = daysUntil(v.date, today);
    if (n <= 0) lines.push(<>🏖️ Bonnes vacances ! <b>{v.title}</b> jusqu’au {v.dateEnd?.slice(8)}.{v.dateEnd?.slice(5, 7)}.</>);
    else if (n <= 30) lines.push(<>🏖️ Plus que <b>{n} jour{n > 1 ? 's' : ''}</b> avant <b>{v.title}</b> !</>);
  }
  if (!h.home) lines.push(<>💡 Dis-moi où vous habitez (ton profil, en haut à droite) et je te donnerai la météo.</>);

  return (
    <div className="hello-wrap" role="dialog" aria-modal="true" aria-label="Coco te dit bonjour">
      <div className="hello-scrim" onClick={onClose} />
      <div className="coco-card">
        <button className="coco-x" onClick={onClose} aria-label="Fermer">{Icon.close}</button>
        <div className="row center gap10">
          <span className="coco-face" aria-hidden="true">🐥</span>
          <span className="coco-hi">{evening ? 'Bonsoir' : 'Coucou'} {name} ! 👋</span>
        </div>
        <div className="col gap6">
          {lines.map((l, i) => (
            <p key={i} className="coco-line" style={{ animationDelay: `${150 + i * 220}ms` }}>{l}</p>
          ))}
        </div>
        <div className="row gap8">
          <button className="btn-dark sm grow" onClick={onClose}>Merci Coco 👍</button>
          <button className="share-copy" onClick={onChat}>Discuter</button>
        </div>
      </div>
    </div>
  );
}
