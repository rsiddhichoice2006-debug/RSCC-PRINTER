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
import { apiClient } from '../services/apiClient';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  customerProfile: CustomerUser | null;
  loading: boolean;
  signInWithEmail: (identifier: string, pass: string) => Promise<void>;
  signIn: (identifier: string, pass: string) => Promise<void>;
  signUpWithEmail: (name: string, mobile: string, email?: string, pass?: string) => Promise<void>;
  signUp: (name: string, mobile: string, email?: string, pass?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  loginCustomerDirect: (customer: CustomerUser) => void;
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

  // Sync Firebase Auth state & restore local sessions
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const saved = localStorage.getItem('rscc_customer_user');
        let baseProfile: CustomerUser | null = null;
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && (parsed.id === user.uid || parsed.email === user.email)) {
              baseProfile = parsed;
            }
          } catch (e) {
            console.warn(e);
          }
        }
        if (!baseProfile) {
          baseProfile = {
            id: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'Customer',
            mobile: '',
            email: user.email || '',
            createdAt: new Date().toISOString(),
          };
        }
        setCustomerProfile(baseProfile);
        localStorage.setItem('rscc_customer_user', JSON.stringify(baseProfile));

        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data();
            const profile: CustomerUser = {
              id: user.uid,
              name: data.name || user.displayName || baseProfile.name,
              mobile: data.mobile || baseProfile.mobile,
              email: user.email || data.email || baseProfile.email,
              createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()) : new Date().toISOString(),
            };
            setCustomerProfile(profile);
            localStorage.setItem('rscc_customer_user', JSON.stringify(profile));
          } else {
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
          console.warn('Firestore user profile sync warning (non-fatal):', err);
        }
      } else {
        // Firebase user is null, check if customer is authenticated via local / phone storage
        const saved = localStorage.getItem('rscc_customer_user');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.id && (parsed.mobile || parsed.email)) {
              setCustomerProfile(parsed);
              setCurrentUser({
                uid: parsed.id,
                email: parsed.email || `${parsed.mobile}@customer.rscc.in`,
                displayName: parsed.name,
                phoneNumber: parsed.mobile,
              } as any);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn(e);
          }
        }
        setCurrentUser(null);
        setCustomerProfile(null);
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

  const loginCustomerDirect = (customer: CustomerUser) => {
    setCustomerProfile(customer);
    localStorage.setItem('rscc_customer_user', JSON.stringify(customer));
    setCurrentUser({
      uid: customer.id,
      email: customer.email || `${customer.mobile}@customer.rscc.in`,
      displayName: customer.name,
      phoneNumber: customer.mobile,
    } as any);
    closeAuthModal();
    triggerAuthCallback();
  };

  // Unified Sign In: Supports Mobile Number (10 digits) OR Email Address
  const signIn = async (identifier: string, pass: string) => {
    const raw = identifier.trim();
    if (!raw) throw new Error('Please enter your mobile number or email address');
    const isEmail = raw.includes('@');
    const cleanMobile = raw.replace(/\D/g, '').slice(-10);

    let customerResult: CustomerUser | null = null;

    if (!isEmail && cleanMobile.length >= 10) {
      // 1. Phone number login: Check backend / local database first
      try {
        const res = await apiClient.loginCustomer({
          mobile: cleanMobile,
          password: pass,
        });
        if (res?.customer) {
          customerResult = res.customer;
        }
      } catch (err: any) {
        console.warn('Backend phone login notice:', err.message);
      }

      // Try Firebase with the resolved email or synthesized email
      const targetEmail = customerResult?.email || `${cleanMobile}@customer.rscc.in`;
      try {
        const cred = await signInWithEmailAndPassword(auth, targetEmail, pass);
        if (cred.user) {
          setCurrentUser(cred.user);
          if (!customerResult) {
            customerResult = {
              id: cred.user.uid,
              name: cred.user.displayName || `Customer ${cleanMobile.slice(-4)}`,
              mobile: cleanMobile,
              email: cred.user.email || targetEmail,
              createdAt: new Date().toISOString(),
            };
          }
        }
      } catch (fbErr: any) {
        // If customer was verified in backend, don't fail just because Firebase auth is separate
        if (!customerResult) {
          throw fbErr;
        }
      }

      if (customerResult) {
        setCustomerProfile(customerResult);
        localStorage.setItem('rscc_customer_user', JSON.stringify(customerResult));
        if (!auth.currentUser) {
          setCurrentUser({
            uid: customerResult.id,
            email: customerResult.email || `${customerResult.mobile}@customer.rscc.in`,
            displayName: customerResult.name,
            phoneNumber: customerResult.mobile,
          } as any);
        }
        closeAuthModal();
        triggerAuthCallback();
        return;
      }

      throw new Error('No registered account found with this mobile number. Please click New Account to register.');
    } else {
      // 2. Email Address login
      const cleanEmail = raw.toLowerCase();
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        if (cred.user) {
          setCurrentUser(cred.user);
          const base: CustomerUser = {
            id: cred.user.uid,
            name: cred.user.displayName || cleanEmail.split('@')[0],
            mobile: '',
            email: cleanEmail,
            createdAt: new Date().toISOString(),
          };
          setCustomerProfile(base);
          localStorage.setItem('rscc_customer_user', JSON.stringify(base));

          // Also sync to backend
          try {
            await apiClient.loginCustomer({ email: cleanEmail, password: pass });
          } catch (e) {
            // ignore
          }

          closeAuthModal();
          triggerAuthCallback();
          return;
        }
      } catch (fbErr: any) {
        // Check backend fallback
        try {
          const res = await apiClient.loginCustomer({ email: cleanEmail, password: pass });
          if (res?.customer) {
            loginCustomerDirect(res.customer);
            return;
          }
        } catch (apiErr) {
          // keep original Firebase error
        }
        throw fbErr;
      }
    }
  };

  // Unified Sign Up: Supports Name, 10-digit Mobile, optional Email, Password
  const signUp = async (name: string, mobile: string, email?: string, pass?: string) => {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Please enter your full name');

    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length < 10) throw new Error('Please enter a valid 10-digit mobile number');

    const cleanPass = pass?.trim() || 'pass123';
    if (cleanPass.length < 6) throw new Error('Password must be at least 6 characters');

    const cleanEmail = email?.trim() ? email.trim().toLowerCase() : `${cleanMobile}@customer.rscc.in`;

    // 1. Register with backend
    let registeredCustomer: CustomerUser | null = null;
    try {
      const res = await apiClient.registerCustomer({
        name: cleanName,
        mobile: cleanMobile,
        email: cleanEmail,
        password: cleanPass,
      });
      if (res?.customer) {
        registeredCustomer = res.customer;
      }
    } catch (apiErr: any) {
      console.warn('Backend register notice:', apiErr.message);
      if (apiErr.message?.includes('already exists')) {
        // Try logging in with backend
        try {
          const loginRes = await apiClient.loginCustomer({ mobile: cleanMobile, password: cleanPass });
          if (loginRes?.customer) {
            registeredCustomer = loginRes.customer;
          }
        } catch (e) {
          throw new Error('An account with this mobile number already exists. Please click Sign In.');
        }
      }
    }

    // 2. Register with Firebase Auth
    let fbUser: FirebaseUser | null = null;
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
      if (cred.user) {
        fbUser = cred.user;
        await updateProfile(cred.user, { displayName: cleanName });
        try {
          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            name: cleanName,
            mobile: cleanMobile,
            email: cleanEmail,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (docErr) {
          handleFirestoreError(docErr, OperationType.WRITE, `users/${cred.user.uid}`);
        }
      }
    } catch (fbErr: any) {
      if (fbErr.code === 'auth/email-already-in-use') {
        // Try signing in
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
          if (cred.user) {
            fbUser = cred.user;
          }
        } catch (e) {
          if (!registeredCustomer) {
            throw new Error('This account is already registered. Please sign in with your password.');
          }
        }
      } else if (!registeredCustomer) {
        throw fbErr;
      }
    }

    const finalCustomer: CustomerUser = registeredCustomer || {
      id: fbUser?.uid || 'cust-' + Date.now(),
      name: cleanName,
      mobile: cleanMobile,
      email: cleanEmail,
      createdAt: new Date().toISOString(),
    };

    setCustomerProfile(finalCustomer);
    localStorage.setItem('rscc_customer_user', JSON.stringify(finalCustomer));

    if (fbUser) {
      setCurrentUser(fbUser);
    } else {
      setCurrentUser({
        uid: finalCustomer.id,
        email: finalCustomer.email || `${finalCustomer.mobile}@customer.rscc.in`,
        displayName: finalCustomer.name,
        phoneNumber: finalCustomer.mobile,
      } as any);
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
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase signout non-fatal:', e);
    }
    setCurrentUser(null);
    setCustomerProfile(null);
    localStorage.removeItem('rscc_customer_user');
  };

  const updateCustomerProfile = async (data: Partial<CustomerUser>) => {
    const activeUid = currentUser?.uid || customerProfile?.id;
    if (activeUid) {
      try {
        await setDoc(
          doc(db, 'users', activeUid),
          {
            ...data,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${activeUid}`);
      }
    }
    if (customerProfile) {
      const updated = { ...customerProfile, ...data };
      setCustomerProfile(updated);
      localStorage.setItem('rscc_customer_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        customerProfile,
        loading,
        signIn,
        signInWithEmail: signIn,
        signUp,
        signUpWithEmail: signUp,
        signInWithGoogle,
        loginCustomerDirect,
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
