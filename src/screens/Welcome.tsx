import { useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { createHousehold, joinHousehold, resetPassword, signIn, signInEmail, signUpEmail } from '../data';

const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
  'auth/user-not-found': 'Aucun compte avec cet e-mail. Crée-le d’abord.',
  'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail : connecte-toi.',
  'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).',
  'auth/invalid-email': 'Adresse e-mail invalide.',
  'auth/too-many-requests': 'Trop d’essais. Attends quelques minutes.',
  'auth/network-request-failed': 'Pas de connexion internet.',
  'auth/configuration-not-found': 'Cette méthode de connexion n’est pas activée sur le projet.',
  'auth/operation-not-allowed': 'Cette méthode de connexion n’est pas activée sur le projet.',
};

const authMessage = (e: unknown) => {
  const code = (e as { code?: string }).code ?? 'inconnue';
  return AUTH_ERRORS[code] ?? `La connexion a échoué (${code}). Réessaie.`;
};

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await fn();
    } catch (e) {
      setError(authMessage(e));
    }
    setBusy(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => (mode === 'up' ? signUpEmail(name, email, password) : signInEmail(email, password)));
  };

  const forgot = () => {
    if (!email.trim()) {
      setError('Écris ton e-mail ci-dessus, puis touche « Mot de passe oublié ».');
      return;
    }
    run(async () => {
      await resetPassword(email);
      setInfo('E-mail envoyé : suis le lien pour choisir un nouveau mot de passe.');
    });
  };

  return (
    <div className="welcome">
      <Brand />
      <p className="welcome-text">Votre agenda et vos listes, partagés à deux, synchronisés sur vos deux téléphones.</p>
      <button className="btn-dark" onClick={() => run(signIn)} disabled={busy}>Continuer avec Google</button>

      <div className="or" aria-hidden="true"><span>ou avec ton e-mail</span></div>

      <div className="segmented" role="group" aria-label="Compte">
        <button type="button" className={mode === 'in' ? 'on' : ''} aria-pressed={mode === 'in'} onClick={() => setMode('in')}>Se connecter</button>
        <button type="button" className={mode === 'up' ? 'on' : ''} aria-pressed={mode === 'up'} onClick={() => setMode('up')}>Créer un compte</button>
      </div>

      <form className="col gap10" onSubmit={submit}>
        {mode === 'up' && (
          <label className="col gap6">
            <span className="field-label">Prénom</span>
            <input className="big-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
          </label>
        )}
        <label className="col gap6">
          <span className="field-label">E-mail</span>
          <input className="big-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="col gap6">
          <span className="field-label">Mot de passe</span>
          <input
            className="big-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            minLength={6}
            required
          />
        </label>
        <button className="btn-outline" type="submit" disabled={busy}>{mode === 'up' ? 'Créer mon compte' : 'Se connecter'}</button>
        {mode === 'in' && <button type="button" className="link self-start" onClick={forgot} disabled={busy}>Mot de passe oublié</button>}
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      {info && <p className="info" role="status">{info}</p>}
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
