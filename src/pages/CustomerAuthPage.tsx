import React, { useState } from 'react';
import {
  User,
  Phone,
  Lock,
  Mail,
  MapPin,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { CustomerUser, ShopSettings } from '../types';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

interface CustomerAuthPageProps {
  settings: ShopSettings;
  onLoginSuccess: (customer: CustomerUser) => void;
  onNavigate: (page: string, params?: any) => void;
}

export const CustomerAuthPage: React.FC<CustomerAuthPageProps> = ({
  settings,
  onLoginSuccess,
  onNavigate,
}) => {
  const { loginCustomerDirect } = useAuth();
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Login Form State
  const [loginMobile, setLoginMobile] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Register Form State
  const [regName, setRegName] = useState<string>('');
  const [regMobile, setRegMobile] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regAddress, setRegAddress] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawInput = loginMobile.trim();
    if (!rawInput) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    // Customer shall NOT login through mobile number
    const isPureNumber = /^\d{10,}$/.test(rawInput.replace(/\D/g, '')) && !rawInput.includes('@');
    if (isPureNumber) {
      setErrorMsg('Customer login via mobile number is not allowed. Please enter your registered email address to sign in.');
      return;
    }

    if (!rawInput.includes('@')) {
      setErrorMsg('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await apiClient.loginCustomer({
        identifier: rawInput.toLowerCase(),
        email: rawInput.toLowerCase(),
        password: loginPassword,
      });

      setSuccessMsg(`Welcome back, ${res.customer.name}!`);
      loginCustomerDirect(res.customer);
      onLoginSuccess(res.customer);
      setTimeout(() => {
        onNavigate('my-orders');
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please verify credentials or create a new account.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    const cleanMobile = regMobile.replace(/\D/g, '').slice(-10);
    if (!cleanMobile || cleanMobile.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await apiClient.registerCustomer({
        name: regName.trim(),
        mobile: cleanMobile,
        email: regEmail.trim() || undefined,
        address: regAddress.trim() || undefined,
        password: regPassword.trim() || 'pass123',
      });

      setSuccessMsg(`Account created successfully! Welcome, ${res.customer.name}!`);
      loginCustomerDirect(res.customer);
      onLoginSuccess(res.customer);
      setTimeout(() => {
        onNavigate('my-orders');
      }, 900);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Brand Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-amber-400 text-slate-950 text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-xs">
          <ShieldCheck className="w-4 h-4 text-slate-950" />
          <span>Customer Account Portal</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          {activeTab === 'LOGIN' ? 'Welcome Back!' : 'Create Customer Account'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          Sign in or create an account to view your past printing orders, track live status, get pickup Delivery PINs, and place orders in 1 click.
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-slate-200/80 p-1.5 rounded-2xl flex items-center gap-1 shadow-inner">
        <button
          type="button"
          onClick={() => {
            setActiveTab('LOGIN');
            setErrorMsg('');
            setSuccessMsg('');
          }}
          className={`flex-1 py-3 rounded-xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'LOGIN'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          <User className="w-4 h-4" />
          <span>SIGN IN</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('REGISTER');
            setErrorMsg('');
            setSuccessMsg('');
          }}
          className={`flex-1 py-3 rounded-xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'REGISTER'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>CREATE ACCOUNT</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Login Tab */}
      {activeTab === 'LOGIN' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="e.g. yourname@gmail.com"
                  value={loginMobile}
                  onChange={(e) => setLoginMobile(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500">Mobile number login is not allowed. Please enter your email.</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Password <span className="text-slate-400 font-normal lowercase">(default: pass123)</span>
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs py-3.5 px-6 rounded-xl transition flex items-center justify-center gap-2 shadow cursor-pointer uppercase tracking-wider"
            >
              <span>{loading ? 'Signing in...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </button>
          </form>
        </div>
      )}

      {/* Register Tab */}
      {activeTab === 'REGISTER' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. Amit Sharma"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                10-Digit Mobile Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value)}
                  maxLength={10}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Email Address <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    placeholder="name@gmail.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Address / College / Department <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="e.g. Modern College / Sector 4"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs py-3.5 px-6 rounded-xl transition flex items-center justify-center gap-2 shadow cursor-pointer uppercase tracking-wider"
            >
              <span>{loading ? 'Creating Account...' : 'Register & Start Printing'}</span>
              <ArrowRight className="w-4 h-4 text-amber-300" />
            </button>
          </form>
        </div>
      )}

      {/* Features preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs text-slate-600">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1 shadow-xs">
          <div className="font-black text-slate-900">Instant History</div>
          <p className="text-[11px] text-slate-500">Auto-saves all document and photo print orders.</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1 shadow-xs">
          <div className="font-black text-slate-900">Delivery PINs</div>
          <p className="text-[11px] text-slate-500">Fast 4-digit pickup PINs for counter clearance.</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1 shadow-xs">
          <div className="font-black text-slate-900">1-Click Checkout</div>
          <p className="text-[11px] text-slate-500">Pre-fills your name and mobile on every print.</p>
        </div>
      </div>
    </div>
  );
};
