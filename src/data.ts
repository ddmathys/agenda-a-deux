import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, type User } from 'firebase/auth';
import {
  addDoc, arrayUnion, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { todayKey } from './dates';
import { DEFAULT_LISTS, type EventItem, type Household, type Task } from './types';

export function useAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

export async function signIn() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
    } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      throw e;
    }
  }
}

/** undefined = chargement, null = pas encore de foyer. */
export function useHousehold(uid: string | undefined) {
  const [hid, setHid] = useState<string | null | undefined>(undefined);
  const [house, setHouse] = useState<Household | null | undefined>(undefined);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid), (snap) => setHid((snap.data()?.hid as string | undefined) ?? null));
  }, [uid]);

  useEffect(() => {
    if (hid === undefined) return;
    if (hid === null) {
      setHouse(null);
      return;
    }
    return onSnapshot(
      doc(db, 'households', hid),
      (snap) => {
        const d = snap.data();
        setHouse(d ? { id: snap.id, members: d.members, people: d.people, lists: d.lists ?? DEFAULT_LISTS } : null);
      },
      () => setHouse(null),
    );
  }, [hid]);

  return house;
}

function useCollection<T>(hid: string, name: string): T[] {
  const [items, setItems] = useState<T[]>([]);
  useEffect(
    () => onSnapshot(collection(db, 'households', hid, name), (snap) =>
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T))),
    [hid, name],
  );
  return items;
}

export const useEvents = (hid: string) => useCollection<EventItem>(hid, 'events');
export const useTasks = (hid: string) => useCollection<Task>(hid, 'tasks');

// --- Foyer ---

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function createHousehold(uid: string, name: string) {
  const code = Array.from(crypto.getRandomValues(new Uint32Array(8)), (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('');
  await setDoc(doc(db, 'households', code), {
    members: [uid],
    people: { [uid]: { name, slot: 0 } },
    lists: DEFAULT_LISTS,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'users', uid), { hid: code });
}

export async function joinHousehold(uid: string, name: string, rawCode: string) {
  const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  await updateDoc(doc(db, 'households', code), {
    members: arrayUnion(uid),
    [`people.${uid}`]: { name, slot: 1 },
  });
  await setDoc(doc(db, 'users', uid), { hid: code });
}

// --- Événements et tâches ---

type EventInput = Omit<EventItem, 'id'>;
type TaskInput = Omit<Task, 'id' | 'done' | 'doneOn'>;

export const addEvent = (hid: string, uid: string, e: EventInput) =>
  addDoc(collection(db, 'households', hid, 'events'), { ...e, createdBy: uid, createdAt: serverTimestamp() });

export const updateEvent = (hid: string, id: string, e: Partial<EventInput>) =>
  updateDoc(doc(db, 'households', hid, 'events', id), e);

export const deleteEvent = (hid: string, id: string) => deleteDoc(doc(db, 'households', hid, 'events', id));

export const addTask = (hid: string, uid: string, t: TaskInput) =>
  addDoc(collection(db, 'households', hid, 'tasks'), { ...t, done: false, doneOn: null, createdBy: uid, createdAt: serverTimestamp() });

export const updateTask = (hid: string, id: string, t: Partial<TaskInput>) =>
  updateDoc(doc(db, 'households', hid, 'tasks', id), t);

export const toggleTask = (hid: string, t: Task) =>
  updateDoc(doc(db, 'households', hid, 'tasks', t.id), { done: !t.done, doneOn: t.done ? null : todayKey() });

export const deleteTask = (hid: string, id: string) => deleteDoc(doc(db, 'households', hid, 'tasks', id));
