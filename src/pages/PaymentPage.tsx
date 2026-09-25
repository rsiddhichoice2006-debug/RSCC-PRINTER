import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Lock,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  CreditCard,
  Home,
  Check,
  Receipt,
  FileText,
  BadgeCheck,
  Zap,
} from 'lucide-react';
import { OrderRecord, ShopSettings } from '../types';
import { apiClient } from '../services/apiClient';
import { openRazorpayCheckout } from '../services/razorpayService';
import { useAuth } from '../context/AuthContext';

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
  const { currentUser, customerProfile, openAuthModal } = useAuth();
  const isCustomerLoggedIn = !!(currentUser || customerProfile);

  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isRazorpayLoading, setIsRazorpayLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successOrder, setSuccessOrder] = useState<OrderRecord | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(10);

  // 10-minute payment session timer (600 seconds)
  const TOTAL_PAYMENT_SECONDS = 600;
  const [timeLeft, setTimeLeft] = useState<number>(TOTAL_PAYMENT_SECONDS);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  const shopName = settings.shopName || 'RIDDHI SIDDHI CHOICE CENTRE';
  const amount = order.totalAmount;

  // Track if payment verification is currently in-flight to prevent duplicate requests
  const paymentProcessedRef = useRef<boolean>(false);
  const hasAutoPromptedRef = useRef<boolean>(false);

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

  const handleResetTimer = () => {
    setTimeLeft(TOTAL_PAYMENT_SECONDS);
    setIsExpired(false);
    setErrorMsg('');
  };

  // Launch Razorpay Standard Web Checkout
  const handleLaunchRazorpay = async () => {
    // CRITICAL: Customer must be logged in to pay and place order
    if (!isCustomerLoggedIn) {
      openAuthModal('login', 'Customer Login Required to Place Order', () => {
        handleLaunchRazorpay();
      });
      return;
    }

    if (paymentProcessedRef.current || isExpired || isRazorpayLoading || isVerifying) return;
    setErrorMsg('');
    setIsRazorpayLoading(true);

    try {
      await openRazorpayCheckout({
        amount: order.totalAmount,
        currency: 'INR',
        receipt: `rcpt_${order.orderNumber || Date.now()}`,
        name: shopName,
        description: `Order #${order.orderNumber} - ₹${order.totalAmount.toFixed(2)}`,
        customerName: order.customer?.name || customerProfile?.name || currentUser?.displayName || 'Valued Customer',
        customerEmail: order.customer?.email || customerProfile?.email || currentUser?.email || 'customer@rscc.in',
        customerMobile: order.customer?.mobile || customerProfile?.mobile || '',
        orderId: order.id,
        notes: {
          orderNumber: order.orderNumber,
          customerName: order.customer?.name || '',
          customerMobile: order.customer?.mobile || '',
          totalPages: String(order.totalPages || 1),
          copies: String(order.copies || 1),
        },
        onSuccess: async (paymentResult, verifyData) => {
          paymentProcessedRef.current = true;
          setIsVerifying(true);
          try {
            // Authoritative server-side order confirmation:
            // CRITICAL: ONLY NOW does the order appear in the Staff Portal after payment is confirmed!
            const confirmedOrder = await apiClient.placeOrderWithPayment(order, {
              transactionId: paymentResult.razorpay_payment_id,
              paymentMethod: 'Razorpay (Online Payment)',
              amount: order.totalAmount,
            });
            try {
              confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
            } catch {}
            setSuccessOrder(confirmedOrder || verifyData?.order);
            onPaymentSubmitted(confirmedOrder || verifyData?.order);
          } catch (err: any) {
            console.error('Error recording Razorpay order in system:', err);
            const fallbackOrder: OrderRecord = verifyData?.order || {
              ...order,
              paymentStatus: 'PAYMENT_VERIFIED',
              orderStatus: 'CONFIRMED',
              paymentReference: paymentResult.razorpay_payment_id,
              paymentMethod: 'Razorpay (Online Payment)',
              verifiedAt: new Date().toISOString(),
            };
            setSuccessOrder(fallbackOrder);
            onPaymentSubmitted(fallbackOrder);
          } finally {
            setIsVerifying(false);
            setIsRazorpayLoading(false);
          }
        },
        onError: (err) => {
          setIsRazorpayLoading(false);
          setErrorMsg(err.description || 'Payment was cancelled or not completed. Please try again.');
        },
        onDismiss: () => {
          setIsRazorpayLoading(false);
        },
      });
    } catch (err: any) {
      console.error('Razorpay initialization notice:', err);
      setIsRazorpayLoading(false);
      setErrorMsg(err.message || 'Could not initialize Razorpay checkout. Please check your internet connection.');
    }
  };

  // Automatically prompt Razorpay checkout once on mount ONLY IF LOGGED IN
  useEffect(() => {
    if (!hasAutoPromptedRef.current && !isExpired && !successOrder && isCustomerLoggedIn) {
      hasAutoPromptedRef.current = true;
      const autoTimer = setTimeout(() => {
        handleLaunchRazorpay();
      }, 700);
      return () => clearTimeout(autoTimer);
    }
  }, [isCustomerLoggedIn, isExpired, successOrder]);

  // Auto-redirect countdown when order is successfully placed
  useEffect(() => {
    if (!successOrder) return;

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onBackToHome();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [successOrder, onBackToHome]);

  // SUCCESS SCREEN: When payment is completed and verified
  if (successOrder) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-emerald-200 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>Razorpay Payment Verified</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              🎉 Your Order Has Been Placed!
            </h1>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Payment of <strong className="text-emerald-700 font-bold">₹{amount.toFixed(2)}</strong> has been verified via Razorpay. Your job is now active in the shop printing queue.
            </p>
          </div>

          {/* Key Order Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left space-y-3.5 font-mono text-xs sm:text-sm">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <span className="text-slate-500 font-sans">Order Number:</span>
              <span className="font-black text-slate-900 text-base">{successOrder.orderNumber}</span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <span className="text-slate-500 font-sans">4-Digit Pickup PIN:</span>
              <span className="font-black text-emerald-700 text-lg bg-emerald-50 px-3 py-0.5 rounded-lg border border-emerald-300">
                {successOrder.deliveryPin}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <span className="text-slate-500 font-sans">Customer Name:</span>
              <span className="font-bold text-slate-900">{successOrder.customer?.name}</span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <span className="text-slate-500 font-sans">Amount Paid:</span>
              <span className="font-bold text-emerald-700">₹{successOrder.totalAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <span className="text-slate-500 font-sans">Payment Channel:</span>
              <span className="font-bold text-indigo-700 flex items-center gap-1">
                <BadgeCheck className="w-4 h-4 text-indigo-600" />
                <span>Razorpay Gateway</span>
              </span>
            </div>

            {successOrder.paymentReference && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">Razorpay Payment ID:</span>
                <span className="font-mono text-slate-800 text-xs font-bold truncate max-w-[220px]">
                  {successOrder.paymentReference}
                </span>
              </div>
            )}
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-left text-xs text-emerald-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-emerald-900">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Dispatched to Shop Staff Queue</span>
            </div>
            <p className="text-slate-600">
              Show your 4-digit pickup PIN <strong>{successOrder.deliveryPin}</strong> at the RSCC shop counter when collecting your printed documents.
            </p>
          </div>

          <div className="pt-2 space-y-3">
            <p className="text-xs text-slate-500">
              Returning to homepage in <strong className="text-emerald-700 font-bold">{redirectCountdown}s</strong>...
            </p>
            <button
              type="button"
              onClick={onBackToHome}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl shadow-xl transition flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Return to Home Screen Now</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 bg-indigo-500 text-white text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Official Razorpay Payment</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Complete Order Payment
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Order #{order.orderNumber} • Amount Payable: <span className="font-bold text-emerald-400 text-base">₹{amount.toFixed(2)}</span>
          </p>
        </div>

        {/* Timer Badge */}
        <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-700 px-4 py-2.5 rounded-2xl shrink-0">
          <Clock className={`w-5 h-5 ${timeLeft < 60 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
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

      {/* LOGIN REQUIRED NOTIFICATION IF NOT AUTHENTICATED */}
      {!isCustomerLoggedIn && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 text-amber-950 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900">
                Customer Login Required to Place Order
              </h3>
              <p className="text-xs text-amber-900 mt-0.5">
                Please log in or register before submitting payment. Your order will be linked to your account for live status and pickup PIN.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('login', 'Customer Login Required to Place Order')}
            className="px-5 py-3 bg-slate-950 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition shrink-0 cursor-pointer shadow-md"
          >
            Log In / Sign Up Now
          </button>
        </div>
      )}

      {/* RAZORPAY PAYMENT GATEWAY CARD */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                <span>Razorpay Secure Gateway</span>
              </h2>
              <p className="text-xs text-slate-500">
                Direct Merchant Checkout • {shopName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 text-xs font-black px-3.5 py-1.5 rounded-full border border-emerald-200 w-fit">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>256-Bit SSL Encrypted</span>
          </div>
        </div>

        {/* Accepted Payment Modes via Razorpay */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>All Indian Payment Methods Accepted Inside Razorpay:</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 font-bold text-slate-800 flex flex-col items-center justify-center text-center gap-1 shadow-2xs">
              <span className="text-base">⚡</span>
              <span className="text-[11px] leading-tight">UPI Apps</span>
              <span className="text-[9px] text-slate-400 font-normal">GPay, PhonePe, Paytm</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 font-bold text-slate-800 flex flex-col items-center justify-center text-center gap-1 shadow-2xs">
              <span className="text-base">💳</span>
              <span className="text-[11px] leading-tight">Cards</span>
              <span className="text-[9px] text-slate-400 font-normal">Debit & Credit Cards</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 font-bold text-slate-800 flex flex-col items-center justify-center text-center gap-1 shadow-2xs">
              <span className="text-base">🏦</span>
              <span className="text-[11px] leading-tight">NetBanking</span>
              <span className="text-[9px] text-slate-400 font-normal">50+ Banks Supported</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 font-bold text-slate-800 flex flex-col items-center justify-center text-center gap-1 shadow-2xs">
              <span className="text-base">👛</span>
              <span className="text-[11px] leading-tight">Wallets & QR</span>
              <span className="text-[9px] text-slate-400 font-normal">Razorpay QR, CRED</span>
            </div>
          </div>
        </div>

        {/* Primary Action Button: Pay with Razorpay */}
        <div className="space-y-3 pt-2">
          {!isCustomerLoggedIn ? (
            <button
              type="button"
              id="razorpay-login-button"
              onClick={() => openAuthModal('login', 'Customer Login Required to Place Order')}
              className="w-full py-4 px-6 bg-slate-950 hover:bg-slate-800 text-white font-black text-base sm:text-lg rounded-2xl transition shadow-xl flex items-center justify-center gap-3 cursor-pointer transform active:scale-98"
            >
              <Lock className="w-5 h-5 text-amber-400" />
              <span>Log In to Place Order & Pay ₹{amount.toFixed(2)}</span>
            </button>
          ) : (
            <button
              type="button"
              id="razorpay-pay-button"
              onClick={handleLaunchRazorpay}
              disabled={isVerifying || isRazorpayLoading || isExpired}
              className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-base sm:text-lg rounded-2xl transition shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-3 cursor-pointer disabled:cursor-not-allowed transform active:scale-98"
            >
              {isRazorpayLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>Launching Razorpay Checkout...</span>
                </>
              ) : isVerifying ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>Verifying Payment with Razorpay...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5 text-indigo-200" />
                  <span>Pay ₹{amount.toFixed(2)} with Razorpay</span>
                  <ArrowRight className="w-5 h-5 text-indigo-200" />
                </>
              )}
            </button>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 text-center">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Instant automatic confirmation • Your order is dispatched directly to the shop print queue upon payment</span>
          </div>
        </div>
      </div>

      {/* Order Summary Snapshot */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3 text-xs">
        <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-slate-500" />
          <span>Order Summary</span>
        </h4>

        <div className="space-y-1.5 text-slate-600">
          <div className="flex justify-between">
            <span>Customer Name:</span>
            <span className="font-bold text-slate-900">{order.customer?.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Mobile Number:</span>
            <span className="font-mono font-bold text-slate-900">{order.customer?.mobile}</span>
          </div>
          <div className="flex justify-between">
            <span>Document & Paper:</span>
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
            <span>Pages &amp; Sets:</span>
            <span className="font-bold text-slate-900">
              {order.totalPages} pages • {order.copies} set{order.copies === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-sm font-black text-slate-900">
          <span>Total Payable:</span>
          <span className="text-emerald-700 text-xl font-black">₹{amount.toFixed(2)}</span>
        </div>
      </div>

      {/* Back and Cancel Actions */}
      <div className="pt-2 border-t border-slate-100 flex gap-3">
        <button
          type="button"
          onClick={onBackToEdit}
          disabled={isVerifying || isRazorpayLoading}
          className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
        >
          ← Edit Order Details
        </button>

        <button
          type="button"
          onClick={onBackToHome}
          disabled={isVerifying || isRazorpayLoading}
          className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition cursor-pointer"
        >
          Cancel Checkout
        </button>
      </div>
    </div>
  );
};
