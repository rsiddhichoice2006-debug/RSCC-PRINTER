import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyC4uFoFvbKDC0rpzVArENp9psNZYrd4ghU",
  authDomain: "rscc-printer.firebaseapp.com",
  projectId: "rscc-printer",
  storageBucket: "rscc-printer.firebasestorage.app",
  messagingSenderId: "63332254036",
  appId: "1:63332254036:web:1c5ab5a00bcca2aae5c8c1"
};

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth using browserLocalPersistence (localStorage)
// This avoids using IndexedDB for auth, eliminating "Database is closing/hidden" errors
// when tabs are backgrounded, hidden, or transitioning.
let authInstance: ReturnType<typeof getAuth>;
try {
  authInstance = initializeAuth(app, {
    persistence: [browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch {
  authInstance = getAuth(app);
}
export const auth = authInstance;

// Resilient Firestore initialization with long-polling autodetect & multi-tab persistence
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  try {
    firestoreInstance = getFirestore(app);
  } catch (err) {
    console.warn('Firestore fallback initialization notice:', err);
    firestoreInstance = getFirestore(app);
  }
}

export const db = firestoreInstance;
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errStr = error instanceof Error ? error.message : String(error);
  const isOfflineOrUnavailable =
    errStr.includes('unavailable') ||
    errStr.includes('offline') ||
    errStr.includes('Could not reach Cloud Firestore backend');

  const errInfo: FirestoreErrorInfo = {
    error: errStr,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };

  if (isOfflineOrUnavailable) {
    console.info('Firestore operating in offline / local cached mode:', path);
  } else {
    console.warn('Firestore Operation Info:', errInfo);
  }
}

