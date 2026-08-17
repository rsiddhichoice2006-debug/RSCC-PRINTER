import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  PackageCheck,
  ShieldCheck,
  Phone,
  Mail,
  Copy,
  Check,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Calendar,
  KeyRound,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { OrderRecord, ShopSettings } from '../types';
import { apiClient } from '../services/apiClient';

interface MyOrdersPageProps {
  settings: ShopSettings;
  onNavigate: (page: string, params?: any) => void;
}

export const MyOrdersPage: React.FC<MyOrdersPageProps> = ({ settings, onNavigate }) => {
  // Verification State
  const [verifiedIdentifier, setVerifiedIdentifier] = useState<string>(() => {
    try {
      return sessionStorage.getItem('rscc_verified_customer') || '';
    } catch {
      return '';
    }
  });

  // Input form state
  const [identifierInput, setIdentifierInput] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCodeInput, setOtpCodeInput] = useState<string>('');
  const [sentCodeHint, setSentCodeHint] = useState<string>('');
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);

  // Orders State (isolated strictly to verified customer)
  const [customerOrders, setCustomerOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [copiedPin, setCopiedPin] = useState<string | null>(null);
  const [copiedOrder, setCopiedOrder] = useState<string | null>(null);

  // Load orders strictly for the verified customer
  const loadOrdersForCustomer = async (identifier: string) => {
    if (!identifier) return;
    setLoadingOrders(true);
    setErrorMsg('');
    try {
      const orders = await apiClient.getCustomerOrders(identifier);
      setCustomerOrders(orders);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not fetch your order history.');
      setCustomerOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (verifiedIdentifier) {
      loadOrdersForCustomer(verifiedIdentifier);
    }
  }, [verifiedIdentifier]);

  // Request OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const clean = identifierInput.trim();
    if (!clean) {
      setErrorMsg('Please enter your 10-digit mobile number or email ID');
      return;
    }

    const isEmail = clean.includes('@');
    if (!isEmail) {
      const digits = clean.replace(/\D/g, '');
      if (digits.length < 10) {
        setErrorMsg('Please enter a valid 10-digit mobile number (e.g. 9876543210) or email ID');
        return;
      }
    } else {
      if (!clean.includes('.')) {
        setErrorMsg('Please enter a valid email address');
        return;
      }
    }

    setIsSendingOtp(true);
    try {
      const res = await apiClient.sendCustomerOtp(clean);
      setOtpSent(true);
      if (res.code) {
        setSentCodeHint(res.code);
      }
      setSuccessMsg(`Verification code sent to ${clean}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanId = identifierInput.trim();
    const cleanOtp = otpCodeInput.trim();

    if (!cleanOtp) {
      setErrorMsg('Please enter the 4-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await apiClient.verifyCustomerOtp(cleanId, cleanOtp);
      setVerifiedIdentifier(cleanId);
      try {
        sessionStorage.setItem('rscc_verified_customer', cleanId);
      } catch (e) {
        // ignore
      }
      setSuccessMsg('Verification successful! Accessing your orders...');
      setOtpSent(false);
      setOtpCodeInput('');
      setSentCodeHint('');
      await loadOrdersForCustomer(cleanId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid or expired verification code. Please check and retry.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Logout / Switch Account
  const handleLogout = () => {
    setVerifiedIdentifier('');
    setCustomerOrders([]);
    setOtpSent(false);
    setIdentifierInput('');
    setOtpCodeInput('');
    setSentCodeHint('');
    setErrorMsg('');
    setSuccessMsg('');
    try {
      sessionStorage.removeItem('rscc_verified_customer');
    } catch (e) {
      // ignore
    }
  };

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(pin);
    setTimeout(() => setCopiedPin(null), 2000);
  };

  const handleCopyOrder = (orderNum: string) => {
    navigator.clipboard.writeText(orderNum);
    setCopiedOrder(orderNum);
    setTimeout(() => setCopiedOrder(null), 2000);
  };

  const getStatusBadge = (order: OrderRecord) => {
    if (order.orderStatus === 'COMPLETED') {
      return (
        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Completed</span>
        </span>
      );
    }
    if (order.orderStatus === 'READY_FOR_PICKUP') {
      return (
        <span className="bg-cyan-100 text-cyan-900 border border-cyan-300 text-[11px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 animate-pulse">
          <PackageCheck className="w-3 h-3 text-cyan-700" />
          <span>Ready for Pickup</span>
        </span>
      );
    }
    if (order.orderStatus === 'PRINTING') {
      return (
        <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 text-[11px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
          <Printer className="w-3 h-3 text-indigo-700" />
          <span>Printing in Progress</span>
        </span>
      );
    }
    if (order.paymentStatus === 'PAYMENT_VERIFIED' || order.orderStatus === 'CONFIRMED') {
      return (
        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
          <span>Payment Verified</span>
        </span>
      );
    }
    return (
      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
        <Clock className="w-3 h-3 text-amber-700" />
        <span>Payment Verification Required</span>
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              <span>Customer Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              My Past Orders & Delivery PINs
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Access your personal print orders, live status updates, and 4-digit pickup Delivery PINs.
            </p>
          </div>

          <button
            onClick={() => onNavigate('upload')}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-5 py-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow shrink-0 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>+ NEW PRINT ORDER</span>
          </button>
        </div>

        {/* Verified User Account Header */}
        {verifiedIdentifier && (
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs text-slate-300">
                Verified Identity: <strong className="text-amber-400 font-mono">{verifiedIdentifier}</strong>
              </span>
              <span className="bg-emerald-950 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-800">
                ✓ Privacy Protected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadOrdersForCustomer(verifiedIdentifier)}
                disabled={loadingOrders}
                className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
                <span>Refresh Orders</span>
              </button>

              <button
                onClick={handleLogout}
                className="text-xs text-rose-300 hover:text-rose-200 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch Account / Exit</span>
              </button>
            </div>
          </div>
        )}
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

      {/* STEP 1: VERIFICATION SCREEN (If not verified yet) */}
      {!verifiedIdentifier && (
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-md space-y-6">
          <div className="text-center max-w-md mx-auto space-y-2">
            <div className="w-14 h-14 bg-amber-100 text-amber-900 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <ShieldCheck className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              Verify Your Mobile Number or Email
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              To protect your document privacy and Delivery PINs, each customer can only access their own order history.
            </p>
          </div>

          {/* Mobile / Email Form */}
          <div className="max-w-md mx-auto">
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number or Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9876543210 or yourname@gmail.com"
                      value={identifierInput}
                      onChange={(e) => setIdentifierInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    We will send a 4-digit verification security code to confirm your identity.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSendingOtp}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs py-3.5 rounded-xl shadow transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSendingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending Verification Code...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>SEND VERIFICATION CODE</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in">
                {/* Instant Verification Code Banner for testing/ease of use */}
                {sentCodeHint && (
                  <div className="bg-amber-50 border-2 border-amber-300 text-amber-950 p-4 rounded-2xl text-xs space-y-1">
                    <div className="font-extrabold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Security Verification Code:</span>
                    </div>
                    <div className="font-mono text-2xl font-black text-slate-950 tracking-widest bg-white p-2 rounded-xl border border-amber-200 text-center">
                      {sentCodeHint}
                    </div>
                    <p className="text-[10px] text-amber-800 text-center">
                      (Enter this 4-digit code below to view your personal orders)
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Enter 4-Digit Verification Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="e.g. 1234"
                    value={otpCodeInput}
                    onChange={(e) => setOtpCodeInput(e.target.value)}
                    className="w-full text-center tracking-widest font-mono text-lg font-bold py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
                    <span>Sent to: <strong>{identifierInput}</strong></span>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                    >
                      Change Number/Email
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isVerifyingOtp}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3.5 rounded-xl shadow transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isVerifyingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>VERIFY & VIEW MY ORDERS</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSendingOtp}
                    className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Resend Verification Code
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: VERIFIED CUSTOMER ORDERS DISPLAY */}
      {verifiedIdentifier && (
        <div className="space-y-4">
          {loadingOrders ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-700">Loading your verified orders...</p>
            </div>
          ) : customerOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">No Past Orders Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No orders were found for verified account <strong>{verifiedIdentifier}</strong>. Upload your files now to print!
                </p>
              </div>
              <button
                onClick={() => onNavigate('upload')}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-6 py-3 rounded-xl transition shadow cursor-pointer inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>START PRINTING NOW</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-semibold">
                <span>
                  Showing {customerOrders.length} Verified Order{customerOrders.length > 1 ? 's' : ''} for {verifiedIdentifier}
                </span>
                <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Delivery PIN required at shop pickup
                </span>
              </div>

              <div className="space-y-4">
                {customerOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm hover:shadow-md transition space-y-4"
                  >
                    {/* Order Top Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-black shrink-0">
                          <Printer className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-base">
                              {ord.orderNumber}
                            </span>
                            <button
                              onClick={() => handleCopyOrder(ord.orderNumber)}
                              className="text-slate-400 hover:text-slate-700 transition cursor-pointer"
                              title="Copy order number"
                            >
                              {copiedOrder === ord.orderNumber ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span>•</span>
                            <span>{ord.mode === 'PHOTO' ? 'Photo Printing' : 'Document Printing'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {getStatusBadge(ord)}
                        <div className="text-right">
                          <div className="text-lg font-black text-slate-900">
                            ₹{ord.totalAmount}
                          </div>
                          <div className="text-[10px] text-slate-400">Total Paid</div>
                        </div>
                      </div>
                    </div>

                    {/* Delivery PIN & Specs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      {/* Highlighted Delivery PIN Box (5 cols) */}
                      <div className="sm:col-span-5 bg-amber-400/15 border-2 border-amber-400/70 rounded-2xl p-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase font-black tracking-wider text-amber-900 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                            <span>Pickup Delivery PIN</span>
                          </div>
                          <div className="font-mono text-2xl font-black text-slate-950 tracking-widest mt-0.5">
                            {ord.deliveryPin || '4921'}
                          </div>
                        </div>

                        <button
                          onClick={() => handleCopyPin(ord.deliveryPin || '4921')}
                          className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition flex items-center gap-1 cursor-pointer shadow-xs"
                          title="Copy Delivery PIN"
                        >
                          {copiedPin === (ord.deliveryPin || '4921') ? (
                            <>
                              <Check className="w-3 h-3 text-slate-950" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Print Specs Summary (7 cols) */}
                      <div className="sm:col-span-7 grid grid-cols-3 gap-2 text-xs text-slate-700 text-center sm:text-left">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                          <div className="text-[10px] text-slate-400 font-medium">Pages / Sheets</div>
                          <div className="font-bold text-slate-900">
                            {ord.mode === 'PHOTO' ? `${ord.totalSheets || 1} Sheets` : `${ord.totalPages} Pages`}
                          </div>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                          <div className="text-[10px] text-slate-400 font-medium">Type & Side</div>
                          <div className="font-bold text-slate-900 truncate">
                            {ord.printType === 'BW' ? 'B&W' : 'Colour'} • {ord.printingSide === 'BOTH' ? '2-Side' : '1-Side'}
                          </div>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                          <div className="text-[10px] text-slate-400 font-medium">Copies</div>
                          <div className="font-bold text-slate-900">
                            {ord.copies} {ord.copies > 1 ? 'Sets' : 'Set'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">
                        Customer: <strong className="text-slate-800">{ord.customer.name}</strong> ({ord.customer.mobile})
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onNavigate('track', { orderNumber: ord.orderNumber, mobile: ord.customer.mobile })}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Search className="w-3.5 h-3.5 text-amber-400" />
                          <span>Track Live Status</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
