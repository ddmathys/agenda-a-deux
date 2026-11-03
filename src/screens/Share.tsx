import { useState } from 'react';
import { apkLink, appLink, inviteLink, shareText } from '../invite';
import { partnerUid } from '../tones';
import type { Household } from '../types';
import { Icon } from '../ui';

/**
 * Feuille « Partager » : inviter sa moitié dans CET agenda (tant qu'il reste une place),
 * envoyer l'APK Android (toujours la dernière version), ou envoyer l'app à d'autres,
 * qui créeront leur propre agenda.
 */
export function ShareSheet({ h, me, onClose }: { h: Household; me: string; onClose: () => void }) {
  const [note, setNote] = useState('');
  const partner = partnerUid(h, me);
  const name = h.people[me]?.name ?? '';

  const send = async (kind: 'invite' | 'app' | 'apk') => {
    setNote('');
    const res = kind === 'invite'
      ? await shareText('Agenda à deux', `${name} t’invite dans votre agenda à deux. Ouvre ce lien et connecte-toi :`, inviteLink(h.id))
      : kind === 'apk'
      ? await shareText('Agenda à deux pour Android', 'L’app Agenda à deux pour Android : ouvre ce lien sur ton téléphone, installe le fichier, puis connecte-toi avec Google.', apkLink())
      : await shareText('Agenda à deux', 'Je te fais découvrir Agenda à deux : un agenda et des listes à partager à deux, synchronisés sur vos deux téléphones.', appLink());
    if (res === 'copied') setNote('Lien copié : colle-le dans un message.');
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setNote('Lien copié.');
  };

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Partager">
      <div className="scrim" onClick={onClose} />
      <div className="sheet">
        <span className="grabber" aria-hidden="true" />
        <div className="row between center">
          <h2 className="sheet-title">Partager</h2>
          <button className="round-btn" onClick={onClose} aria-label="Fermer">{Icon.close}</button>
        </div>

        {!partner && (
          <div className="share-card partner">
            <span className="share-emoji" aria-hidden="true">💌</span>
            <span className="share-title">Inviter ta moitié</span>
            <span className="share-sub">Ta moitié ouvre le lien, se connecte et arrive directement dans cet agenda.</span>
            <div className="row gap8">
              <button className="btn-dark sm grow" onClick={() => send('invite')}>{Icon.share}Envoyer l’invitation</button>
              <button className="share-copy" onClick={() => copy(inviteLink(h.id))}>Copier</button>
            </div>
            <span className="share-code">Code : <b>{h.id}</b></span>
          </div>
        )}

        <div className="share-card android">
          <span className="share-emoji" aria-hidden="true">📲</span>
          <span className="share-title">L’app Android</span>
          <span className="share-sub">Le lien télécharge toujours la dernière version. Sur le téléphone : ouvrir le fichier, autoriser l’installation, se connecter avec Google.</span>
          <div className="row gap8">
            <button className="btn-dark sm grow" onClick={() => send('apk')}>{Icon.share}Envoyer l’app</button>
            <button className="share-copy" onClick={() => copy(apkLink())}>Copier</button>
          </div>
          <a className="share-code" href={apkLink()} download>Télécharger ici</a>
        </div>

        <div className="share-card discover">
          <span className="share-emoji" aria-hidden="true">✨</span>
          <span className="share-title">Faire découvrir l’app</span>
          <span className="share-sub">Pour des amis ou la famille : ils créent leur propre agenda à deux. Ils ne voient rien du vôtre.</span>
          <div className="row gap8">
            <button className="btn-dark sm grow" onClick={() => send('app')}>{Icon.share}Partager le lien</button>
            <button className="share-copy" onClick={() => copy(appLink())}>Copier</button>
          </div>
          <span className="share-code">{appLink().replace('https://', '')}</span>
        </div>

        {note && <p className="info" role="status">{note}</p>}
      </div>
    </div>
  );
}
