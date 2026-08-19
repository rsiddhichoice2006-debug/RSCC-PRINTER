import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  LogIn,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RsccLogo } from './RsccLogo';

export interface AuthModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialMode?: 'login' | 'signup';
  title?: string;
  onAuthenticated?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen: propsIsOpen,
  onClose: propsOnClose,
  initialMode: propsInitialMode,
  title: propsTitle,
  onAuthenticated: propsOnAuthenticated,
}) => {
  const {
    isAuthModalOpen: contextIsOpen,
    closeAuthModal: contextCloseModal,
    authModalMode: contextMode,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
  } = useAuth();

  // Combine props with context
  const isVisible = propsIsOpen !== undefined ? propsIsOpen : contextIsOpen;
  const initialMode = propsInitialMode || contextMode || 'login';

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync mode when modal opens or initialMode changes
  useEffect(() => {
    if (isVisible) {
      setMode(propsInitialMode || contextMode || 'login');
      setErrorMsg('');
    }
  }, [isVisible, propsInitialMode, contextMode]);

  if (!isVisible) return null;

  const handleClose = () => {
    setErrorMsg('');
    if (propsOnClose) {
      propsOnClose();
    }
    contextCloseModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Please enter your full name');
        const cleanMobile = mobile.replace(/\D/g, '');
        if (cleanMobile.length < 10) throw new Error('Please enter a valid 10-digit mobile number');
        if (!email.trim() || !email.includes('@')) throw new Error('Please enter a valid email address');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');

        await signUpWithEmail(name, cleanMobile, email, password);
      } else {
        if (!email.trim() || !email.includes('@')) throw new Error('Please enter your valid email address');
        if (!password) throw new Error('Please enter your password');

        await signInWithEmail(email, password);
      }

      if (propsOnAuthenticated) {
        propsOnAuthenticated();
      }
      handleClose();
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = err.message || 'Authentication failed. Please check your credentials.';
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/invalid-login-credentials'
      ) {
        msg = 'Invalid email or password. Please verify your credentials or create a new account.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please click "Sign In" above to sign in.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address format.';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await signInWithGoogle();
      if (propsOnAuthenticated) {
        propsOnAuthenticated();
      }
      handleClose();
    } catch (err: any) {
      console.error('Google auth error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        setErrorMsg(
          `Google Sign-In is not allowed from "${currentDomain}". To enable Google Login, add "${currentDomain}" in your Firebase Console > Authentication > Settings > Authorized Domains. Meanwhile, please use the Email & Password sign-in/registration form below!`
        );
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMsg(err.message || 'Google sign in failed. Please use email & password sign in below.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 relative flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative">
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <RsccLogo size="sm" />
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                Riddhi Siddhi Choice Centre
              </div>
              <h2 className="text-xl font-black text-white">
                {propsTitle || (mode === 'login' ? 'Customer Sign In' : 'Create Customer Account')}
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-300 mt-2">
            {mode === 'login'
              ? 'Sign in with your email and password to view your bookings and place orders.'
              : 'Register your email account to place print bookings and access your orders.'}
          </p>

          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 gap-2 mt-4 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              className={`py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg('');
              }}
              className={`py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'signup'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>New Account</span>
            </button>
          </div>
        </div>

        {/* Body Form */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WhatsApp / Mobile Number (10 Digits)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition"
                />
              </div>
              {mode === 'signup' && (
                <p className="text-[11px] text-slate-500 mt-1">Minimum 6 characters</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : mode === 'login' ? (
                <>
                  <span>Sign In with Email</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Create Account & Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              OR
            </span>
          </div>

          {/* Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold rounded-xl transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 text-xs"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secure Firebase Authentication • RSCC Portal</span>
          </div>
        </div>
      </div>
    </div>
  );
};
