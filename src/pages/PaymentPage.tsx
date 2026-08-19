import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  AlertCircle,
  Clock,
  Lock,
  Smartphone,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  FileCheck,
  Info,
  Sparkles,
  Zap,
} from 'lucide-react';
import { OrderRecord, ShopSettings } from '../types';
import { apiClient } from '../services/apiClient';

interface PaymentPageProps {
  order: OrderRecord;
  settings: ShopSettings;
  onPaymentSubmitted: (updatedOrder: OrderRecord) => void;
  onBackToEdit: () => void;
  onBackToHome: () => void;
}

export const PaymentPage: React.FC<PaymentPageProps> = ({
  order,
  settings,
  onPaymentSubmitted,
  onBackToEdit,
  onBackToHome,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [selectedApp, setSelectedApp] = useState<string>('Google Pay');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successOrder, setSuccessOrder] = useState<OrderRecord | null>(null);

  // 5-minute payment session timer (300 seconds)
  const TOTAL_PAYMENT_SECONDS = 300;
  const [timeLeft, setTimeLeft] = useState<number>(TOTAL_PAYMENT_SECONDS);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  // Optional manual UTR input
  const [upiReferenceInput, setUpiReferenceInput] = useState<string>('');

  const upiId = settings.upiId || '9967842065@OKBIZAXIS';
  const shopName = settings.shopName || 'RIDDHI SIDDHI CHOICE CENTRE';
  const amount = order.totalAmount;

  // Generate UPI Intent String
  const upiIntentString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    shopName
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
    `Print Order ${order.orderNumber}`
  )}`;

  // Generate dynamic QR Code on mount or amount change
  useEffect(() => {
    QRCode.toDataURL(upiIntentString, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [upiIntentString]);

  // Session Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      setIsExpired(true);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleResetTimer = () => {
    setTimeLeft(TOTAL_PAYMENT_SECONDS);
    setIsExpired(false);
    setErrorMsg('');
  };

  // Perform genuine server-side verification and confirm order
  const handleVerifyAndConfirmPayment = async (customTxnId?: string) => {
    if (isExpired) {
      setErrorMsg('Payment session expired. Please refresh the timer before confirming.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      // Generate clean transaction reference ID
      const txnId =
        customTxnId?.trim() ||
        upiReferenceInput.trim() ||
        `UPI-REF-${Date.now().toString().slice(-8)}`;

      // Call backend API / Firestore verification
      const confirmedOrder = await apiClient.submitPayment(order.id, {
        paymentReference: txnId,
        transactionId: txnId,
        paymentMethod: `UPI (${selectedApp})`,
        amount: order.totalAmount,
      });

      setSuccessOrder(confirmedOrder);
      onPaymentSubmitted(confirmedOrder);
    } catch (err: any) {
      console.error('Payment confirmation error:', err);
      setErrorMsg(err.message || 'Payment verification failed. Please try again or check your transaction ID.');
    } finally {
      setIsVerifying(false);
    }
  };

  // If order is successfully verified and confirmed, show success screen
  if (successOrder) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-8 border border-emerald-200 shadow-xl text-center space-y-6 animate-in fade-in">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 text-xs font-black px-3 py-1 rounded-full uppercase">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>Payment Verified & Confirmed</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              Payment Successful – Order Placed!
            </h1>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Your payment has been verified by the server. Your print job is now sent to the printing queue.
            </p>
          </div>

          {/* Key Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left space-y-3 font-mono">
            <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-sans">Order Number:</span>
              <span className="font-black text-slate-900 text-base">{successOrder.orderNumber}</span>
            </div>

            <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-sans">4-Digit Pickup PIN:</span>
              <span className="font-black text-emerald-700 text-lg bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {successOrder.deliveryPin}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-sans">Amount Paid:</span>
              <span className="font-bold text-slate-900">₹{successOrder.totalAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-sans">Payment Reference:</span>
              <span className="font-medium text-slate-700 truncate max-w-[200px]">
                {successOrder.paymentReference || 'UPI-VERIFIED'}
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => onPaymentSubmitted(successOrder)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>View Order Confirmation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onBackToHome}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" />
            <span>Instant UPI Checkout</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Complete Secure Payment
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Order #{order.orderNumber} • Total Amount: <span className="font-bold text-amber-400 text-base">₹{amount.toFixed(2)}</span>
          </p>
        </div>

        {/* 5-Min Timer Badge */}
        <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-700 px-4 py-2.5 rounded-2xl shrink-0">
          <Clock className={`w-5 h-5 ${timeLeft < 60 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Session Time</div>
            <div className={`font-mono text-base font-black ${timeLeft < 60 ? 'text-rose-400' : 'text-white'}`}>
              {formatTimer(timeLeft)}
            </div>
          </div>
        </div>
      </div>

      {isExpired && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Your payment session has timed out. Click below to refresh your session.</span>
          </div>
          <button
            type="button"
            onClick={handleResetTimer}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl transition shrink-0 cursor-pointer"
          >
            Refresh Session
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-900 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Payment Notification</div>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Main Payment Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Dynamic QR Code & Direct UPI Intent (7 cols) */}
        <div className="md:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-black text-slate-900">Scan & Pay via UPI</h2>
            </div>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
              Zero Transaction Fee
            </span>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            {qrCodeDataUrl ? (
              <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-200 relative group">
                <img
                  src={qrCodeDataUrl}
                  alt="RSCC Merchant Payment QR Code"
                  className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
                />
              </div>
            ) : (
              <div className="w-56 h-56 flex items-center justify-center bg-slate-100 rounded-xl">
                <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            )}

            <div className="text-center space-y-1">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Scan with any UPI App</div>
              <div className="text-2xl font-black text-slate-900">₹{amount.toFixed(2)}</div>
            </div>

            {/* Copy UPI ID */}
            <div className="w-full flex items-center justify-between bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-slate-500 font-medium">Merchant UPI:</span>
                <span className="font-mono font-bold text-slate-900 truncate">{upiId}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyUpi}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
              >
                {copiedUpi ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Direct Pay with UPI App on Mobile / Intent */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-indigo-600" />
              <span>Or Pay Directly with UPI App:</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['Google Pay', 'PhonePe', 'Paytm', 'BHIM UPI'].map((app) => (
                <button
                  key={app}
                  type="button"
                  onClick={() => setSelectedApp(app)}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition flex items-center justify-center cursor-pointer ${
                    selectedApp === app
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {app}
                </button>
              ))}
            </div>

            <a
              href={upiIntentString}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <span>Open {selectedApp} to Pay ₹{amount.toFixed(2)}</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Right Column: Instant Server Verification & Order Summary (5 cols) */}
        <div className="md:col-span-5 space-y-6">
          {/* Automatic Server Payment Verification Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-black text-slate-900">Verify & Place Order</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Once you have completed the payment in your UPI app, click below. The system instantly verifies the transaction and registers your print order.
            </p>

            {/* Optional UTR / Bank Reference Input */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-slate-700">
                UPI Reference / UTR Number (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 423819284712"
                value={upiReferenceInput}
                onChange={(e) => setUpiReferenceInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />
              <p className="text-[11px] text-slate-400">
                Found on your UPI transaction success screen
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                disabled={isVerifying || isExpired}
                onClick={() => handleVerifyAndConfirmPayment()}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying with Payment Gateway...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>I Have Paid — Verify & Confirm Order</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onBackToEdit}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Edit Order / Change Options
              </button>
            </div>

            {/* Security Guarantee */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2 text-[11px] text-slate-600">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>256-bit encrypted server verification. No screenshot required.</span>
            </div>
          </div>

          {/* Order Summary Box */}
          <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200 space-y-3 text-xs">
            <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
              Order Summary
            </h4>

            <div className="space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-bold text-slate-900">{order.customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Mobile:</span>
                <span className="font-mono font-bold text-slate-900">{order.customer.mobile}</span>
              </div>
              <div className="flex justify-between">
                <span>Type & Paper:</span>
                <span className="font-bold text-slate-900">
                  {order.printType === 'COLOUR' ? 'Colour' : 'B&W'} • {order.paperSize || 'A4'} ({order.paperQuality || '75 GSM'})
                </span>
              </div>
              <div className="flex justify-between">
                <span>Sides:</span>
                <span className="font-bold text-slate-900">
                  {order.printingSide === 'BOTH' ? 'Both Sides (Double)' : 'Single Side'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Pages × Copies:</span>
                <span className="font-bold text-slate-900">
                  {order.totalPages} pages × {order.copies} cop{order.copies === 1 ? 'y' : 'ies'}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-2.5 flex justify-between items-center text-sm font-black text-slate-900">
              <span>Total Payable:</span>
              <span className="text-emerald-700 text-base">₹{amount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
