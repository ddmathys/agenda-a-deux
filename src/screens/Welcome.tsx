import { useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { createHousehold, joinHousehold, signIn } from '../data';

export function Login() {
  const [error, setError] = useState('');
  const go = async () => {
    setError('');
    try {
      await signIn();
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'inconnue';
      setError(code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed'
        ? 'La connexion Google n’est pas encore activée sur le projet.'
        : `La connexion a échoué (${code}). Réessaie.`);
    }
  };
  return (
    <div className="welcome">
      <Brand />
      <p className="welcome-text">Votre agenda et vos listes, partagés à deux, synchronisés sur vos deux téléphones.</p>
      <button className="btn-dark" onClick={go}>Continuer avec Google</button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export function Setup({ user }: { user: User }) {
  const [name, setName] = useState(user.displayName?.split(' ')[0] ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>, fail: string) => {
    if (!name.trim()) {
      setError('Indique ton prénom.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch {
      setError(fail);
      setBusy(false);
    }
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    run(() => joinHousehold(user.uid, name.trim(), user.email ?? '', code), 'Code introuvable ou agenda déjà complet.');
  };

  return (
    <div className="welcome">
      <Brand />
      <label className="col gap6">
        <span className="field-label">Ton prénom</span>
        <input className="big-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
      </label>

      <div className="white-card col gap10">
        <h2 className="h18">Tu commences ?</h2>
        <p className="muted">Crée votre agenda, puis envoie le code à ta moitié.</p>
        <button className="btn-dark" disabled={busy} onClick={() => run(() => createHousehold(user.uid, name.trim(), user.email ?? ''), 'Création impossible. Réessaie.')}>
          Créer notre agenda
        </button>
      </div>

      <form className="white-card col gap10" onSubmit={join}>
        <h2 className="h18">Tu as reçu un code ?</h2>
        <label className="sr-only" htmlFor="code">Code d’invitation</label>
        <input id="code" className="big-input code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD2345" autoCapitalize="characters" />
        <button className="btn-outline" type="submit" disabled={busy || code.replace(/\W/g, '').length < 8}>Rejoindre</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-art" aria-hidden="true">
        <span className="b-sun" />
        <span className="b-a" />
        <span className="b-b" />
      </div>
      <h1>Agenda à deux</h1>
    </div>
  );
}
