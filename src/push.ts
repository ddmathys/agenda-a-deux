import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Notifications : chaque téléphone s'abonne au Web Push et dépose son abonnement
 * dans users/{uid}/push/{id}. Les rappels partent ensuite du serveur (functions/index.js).
 */
const VAPID_PUBLIC = 'BAkAXw-fsDuFDcihim4eyHxwWtkxTxRTEAF4rVheo15Sl3QVZWjR61DMhxX0SzCtQCVwV4j8NJ0wWE0e1Y_ScCU';

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Identifiant stable d'un abonnement, tiré de son adresse. */
async function subId(endpoint: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** À appeler sur un toucher : demande l'autorisation puis enregistre l'abonnement. */
export async function enablePush(uid: string): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
  const json = sub.toJSON();
  await setDoc(doc(db, 'users', uid, 'push', await subId(sub.endpoint)), {
    endpoint: json.endpoint,
    keys: json.keys,
    device: navigator.userAgent.slice(0, 200),
    createdAt: serverTimestamp(),
  });
  return 'on';
}

export async function disablePush(uid: string): Promise<PushState> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await deleteDoc(doc(db, 'users', uid, 'push', await subId(sub.endpoint))).catch(() => undefined);
    await sub.unsubscribe();
  }
  return 'off';
}
