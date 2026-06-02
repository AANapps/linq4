import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

enableIndexedDbPersistence(db).catch(() => {});
