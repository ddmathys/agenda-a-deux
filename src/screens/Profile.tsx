import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { setHome } from '../data';
import { cap, DAYS, fromKey, keyOf } from '../dates';
import { partnerUid } from '../tones';
import type { Household } from '../types';
import { wmo, type Forecast } from '../weather';
import { Avatar, Icon } from '../ui';
import { PlaceSearch } from './Ideas';

/**
 * Profil (avatars en haut à droite) : qui je suis, où vous habitez (météo de la semaine,
 * changer de ville), partager, se déconnecter.
 */
export function ProfileSheet({ h, me, forecast, onShare, onClose }: {
  h: Household; me: string; forecast: Forecast | null; onShare: () => void; onClose: () => void;
}) {
  const [changing, setChanging] = useState(!h.home);
  const [saved, setSaved] = useState('');
  const [leaving, setLeaving] = useState(false);
  const partner = partnerUid(h, me);
  const days = forecast && h.home ? Object.keys(forecast).sort().slice(0, 7) : [];
  const email = auth.currentUser?.email ?? h.people[me]?.email ?? '';

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Profil">
      <div className="scrim" onClick={onClose} />
      <div className="sheet">
        <span className="grabber" aria-hidden="true" />
        <div className="row between center">
          <h2 className="sheet-title">Profil</h2>
          <button className="round-btn" onClick={onClose} aria-label="Fermer">{Icon.close}</button>
        </div>

        <div className="profile-who">
          <Avatar h={h} owner={me} size={56} />
          <span className="col grow min0">
            <span className="profile-name">{h.people[me]?.name}</span>
            {email && <span className="profile-mail ell">{email}</span>}
            <span className="profile-mail">{partner ? `Agenda partagé avec ${h.people[partner]?.name}` : 'Ta moitié n’a pas encore rejoint l’agenda'}</span>
          </span>
        </div>

        <section className="profile-block">
          <div className="row between center">
            <span className="col min0">
              <span className="profile-label">📍 Où habitez-vous ?</span>
              <span className="profile-value">{h.home ? `${h.home.name}${h.home.region ? `, ${h.home.region}` : ''}` : 'Pas encore choisi'}</span>
            </span>
            {h.home && !changing && <button className="link" onClick={() => setChanging(true)}>Changer</button>}
          </div>
          {!h.home && <p className="moment-dsub">Pour la météo, les idées de sorties près de chez vous et Coco. Commun à vous deux.</p>}

          {days.length > 0 && (
            <div className="week-weather" role="list" aria-label="Météo de la semaine">
              {days.map((k) => {
                const w = forecast![k];
                return (
                  <div key={k} className="ww-day" role="listitem">
                    <span className="ww-name">{k === keyOf(new Date()) ? 'Auj.' : cap(DAYS[fromKey(k).getDay()].slice(0, 3))}</span>
                    <span className="ww-icon" title={wmo(w.code).label}>{wmo(w.code).emoji}</span>
                    <span className="ww-max">{w.tmax}°</span>
                    <span className="ww-min">{w.tmin}°</span>
                    {w.rain >= 30 && <span className="ww-rain">💧{w.rain}%</span>}
                  </div>
                );
              })}
            </div>
          )}

          {changing && (
            <PlaceSearch
              onPick={async (p) => {
                await setHome(h.id, p);
                setSaved(p.name);
                setChanging(false);
              }}
            />
          )}
          {saved && <p className="info" role="status">C’est noté : vous êtes à {saved}. 🏡</p>}
        </section>

        <button className="profile-row" onClick={onShare}>
          <span className="profile-row-icon" aria-hidden="true">{Icon.share}</span>
          <span className="grow">{partner ? 'Partager l’app' : 'Inviter ta moitié · partager l’app'}</span>
          <span aria-hidden="true">{Icon.right}</span>
        </button>

        <button className="btn-outline danger" disabled={leaving} onClick={() => { setLeaving(true); signOut(auth); }}>
          Se déconnecter
        </button>
        <p className="muted small center-text">{__APP_VERSION__} · météo Open-Meteo (MétéoSuisse)</p>
      </div>
    </div>
  );
}
