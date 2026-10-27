/**
 * Liens de partage.
 * - Invitation de sa moitié : https://…/?rejoindre=CODE. Le code est gardé dans le
 *   téléphone le temps de se connecter (la connexion Google peut recharger la page),
 *   puis l'écran de départ propose directement « Rejoindre ».
 * - Faire découvrir l'app : le lien simple, chacun crée ensuite son propre agenda.
 */

const KEY = 'invite-code';
const PARAM = 'rejoindre';

export const appLink = () => location.origin;
export const inviteLink = (code: string) => `${location.origin}/?${PARAM}=${code}`;

/** À appeler au démarrage : range le code du lien et nettoie l'adresse. */
export function captureInvite() {
  const url = new URL(location.href);
  const code = url.searchParams.get(PARAM);
  if (!code) return;
  try {
    localStorage.setItem(KEY, code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
  } catch {
    /* stockage indisponible : on entrera le code à la main */
  }
  url.searchParams.delete(PARAM);
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}

export function pendingInvite(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function clearInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
}

/** Partage natif du téléphone, sinon copie dans le presse-papiers. Renvoie 'copied' si copié. */
export async function shareText(title: string, text: string, url: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(`${text} ${url}`);
  return 'copied';
}
