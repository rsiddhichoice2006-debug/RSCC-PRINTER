import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { CustomerUser } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  customerProfile: CustomerUser | null;
  loading: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (name: string, mobile: string, email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateCustomerProfile: (data: Partial<CustomerUser>) => Promise<void>;
  isAuthModalOpen: boolean;
  openAuthModal: (mode?: 'login' | 'signup', onComplete?: () => void) => void;
  closeAuthModal: () => void;
  authModalMode: 'login' | 'signup';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [onAuthSuccessCallback, setOnAuthSuccessCallback] = useState<(() => void) | null>(null);

  // Sync Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Construct immediate resilient profile
        const baseProfile: CustomerUser = {
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Customer',
          mobile: '',
          email: user.email || '',
          createdAt: new Date().toISOString(),
        };
        setCustomerProfile(baseProfile);
        localStorage.setItem('rscc_customer_user', JSON.stringify(baseProfile));

        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data();
            const profile: CustomerUser = {
              id: user.uid,
              name: data.name || user.displayName || 'Customer',
              mobile: data.mobile || '',
              email: user.email || data.email || '',
              createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()) : new Date().toISOString(),
            };
            setCustomerProfile(profile);
            localStorage.setItem('rscc_customer_user', JSON.stringify(profile));
          } else {
            // Create user profile in Firestore
            await setDoc(userDocRef, {
              uid: user.uid,
              name: baseProfile.name,
              email: baseProfile.email,
              mobile: baseProfile.mobile,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          console.warn('Firestore user profile sync error (non-fatal):', err);
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setCustomerProfile(null);
        localStorage.removeItem('rscc_customer_user');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openAuthModal = (mode: 'login' | 'signup' = 'login', onComplete?: () => void) => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
    if (onComplete) {
      setOnAuthSuccessCallback(() => onComplete);
    } else {
      setOnAuthSuccessCallback(null);
    }
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setOnAuthSuccessCallback(null);
  };

  const triggerAuthCallback = () => {
    if (onAuthSuccessCallback) {
      onAuthSuccessCallback();
      setOnAuthSuccessCallback(null);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    closeAuthModal();
    triggerAuthCallback();
  };

  const signUpWithEmail = async (name: string, mobile: string, email: string, pass: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (cred.user) {
      await updateProfile(cred.user, { displayName: name });
      const newProfile: CustomerUser = {
        id: cred.user.uid,
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        createdAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          name: name.trim(),
          mobile: mobile.trim(),
          email: email.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${cred.user.uid}`);
      }
      setCustomerProfile(newProfile);
      localStorage.setItem('rscc_customer_user', JSON.stringify(newProfile));
    }
    closeAuthModal();
    triggerAuthCallback();
  };

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    if (cred.user) {
      const basicProfile: CustomerUser = {
        id: cred.user.uid,
        name: cred.user.displayName || 'Customer',
        mobile: '',
        email: cred.user.email || '',
        createdAt: new Date().toISOString(),
      };
      setCustomerProfile(basicProfile);
      localStorage.setItem('rscc_customer_user', JSON.stringify(basicProfile));

      try {
        const userDocRef = doc(db, 'users', cred.user.uid);
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          await setDoc(userDocRef, {
            uid: cred.user.uid,
            name: basicProfile.name,
            email: basicProfile.email,
            mobile: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const data = snap.data();
          const merged: CustomerUser = {
            id: cred.user.uid,
            name: data.name || cred.user.displayName || 'Customer',
            mobile: data.mobile || '',
            email: cred.user.email || data.email || '',
            createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()) : new Date().toISOString(),
          };
          setCustomerProfile(merged);
          localStorage.setItem('rscc_customer_user', JSON.stringify(merged));
        }
      } catch (err) {
        console.warn('Firestore doc read/write during Google login (non-fatal):', err);
        handleFirestoreError(err, OperationType.WRITE, `users/${cred.user.uid}`);
      }
    }
    closeAuthModal();
    triggerAuthCallback();
  };

  const logout = async () => {
    await signOut(auth);
    setCustomerProfile(null);
    localStorage.removeItem('rscc_customer_user');
  };

  const updateCustomerProfile = async (data: Partial<CustomerUser>) => {
    if (!currentUser) return;
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          ...data,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (customerProfile) {
        const updated = { ...customerProfile, ...data };
        setCustomerProfile(updated);
        localStorage.setItem('rscc_customer_user', JSON.stringify(updated));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        customerProfile,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        logout,
        updateCustomerProfile,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        authModalMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
