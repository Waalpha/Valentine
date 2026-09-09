import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
  measurementId: firebaseConfigData.measurementId,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use custom Firestore database ID if specified in config
const dbId = (firebaseConfigData as any).firestoreDatabaseId || '(default)';

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, dbId);
} catch (e) {
  // If already initialized or unsupported in current container, fallback to getFirestore
  firestoreInstance = getFirestore(app, dbId);
}
export const db = firestoreInstance;

export const DEFAULT_BUSINESS_ID = 'main-bar-01';
