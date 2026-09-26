import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Configuration web Firebase : ces valeurs sont publiques par nature,
// l'accès aux données est protégé par firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyAmCaRI1nn1T8lES15mn8pZ1VDn807SSEM',
  authDomain: 'agenda-a-deux-dm.web.app',
  projectId: 'agenda-a-deux-dm',
  storageBucket: 'agenda-a-deux-dm.firebasestorage.app',
  messagingSenderId: '25025576617',
  appId: '1:25025576617:web:3abe1468a895a61e4b73b8',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Cache local : l'app s'ouvre instantanément et fonctionne hors ligne.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
