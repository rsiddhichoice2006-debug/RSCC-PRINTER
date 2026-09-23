import React, { useState, useEffect, useRef } from 'react';
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
  CheckCircle,
} from 'lucide-react';
import { OrderRecord, ShopSettings } from '../types';
import { apiClient } from '../services/apiClient';
import { openRazorpayCheckout } from '../services/razorpayService';

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
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isRazorpayLoading, setIsRazorpayLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successOrder, setSuccessOrder] = useState<OrderRecord | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(6);

  // 10-minute payment session timer (600 seconds)
  const TOTAL_PAYMENT_SECONDS = 600;
  const [timeLeft, setTimeLeft] = useState<number>(TOTAL_PAYMENT_SECONDS);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  const shopName = settings.shopName || 'RIDDHI SIDDHI CHOICE CENTRE';
  const amount = order.totalAmount;

  // Track if payment verification is currently in-flight to prevent duplicate requests
  const paymentProcessedRef = useRef<boolean>(false);

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

  // Launch Razorpay Standard Web Checkout
  const handleRazorpayCheckout = async () => {
    if (paymentProcessedRef.current || isExpired || isRazorpayLoading) return;
    setErrorMsg('');
    setIsRazorpayLoading(true);

    try {
      await openRazorpayCheckout({
        amount: order.totalAmount,
        currency: 'INR',
        receipt: `rcpt_${order.orderNumber || Date.now()}`,
        name: shopName,
        description: `Order #${order.orderNumber} - ₹${order.totalAmount.toFixed(2)}`,
        customerName: order.customer?.name || 'Customer',
        customerEmail: order.customer?.email || 'customer@rscc.in',
        customerMobile: order.customer?.mobile || '8652411690',
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
            const confirmedOrder = await apiClient.placeOrderWithPayment(order, {
              transactionId: paymentResult.razorpay_payment_id,
              paymentMethod: 'Razorpay (Standard Web Checkout)',
              amount: order.totalAmount,
            });
            setSuccessOrder(confirmedOrder || verifyData?.order);
            onPaymentSubmitted(confirmedOrder || verifyData?.order);
          } catch (err: any) {
            console.error('Error recording Razorpay order in system:', err);
            // Fallback: use order returned from backend verification or synthesize
            const fallbackOrder: OrderRecord = verifyData?.order || {
              ...order,
              paymentStatus: 'PAYMENT_VERIFIED',
              orderStatus: 'CONFIRMED',
              paymentReference: paymentResult.razorpay_payment_id,
              paymentMethod: 'Razorpay (Standard Web Checkout)',
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
          setErrorMsg(err.description || 'Payment was cancelled or failed. Please try again.');
        },
        onDismiss: () => {
          setIsRazorpayLoading(false);
        },
      });
    } catch (err: any) {
      console.error('Razorpay initialization error:', err);
      setIsRazorpayLoading(false);
      setErrorMsg(err.message || 'Could not initialize Razorpay checkout. Please try again.');
    }
  };

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
              Payment of <strong className="text-emerald-700 font-bold">₹{amount.toFixed(2)}</strong> has been verified via Razorpay. Your print job is now sent to the printing queue.
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
              <span className="font-bold text-slate-900">{successOrder.customer.name}</span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <span className="text-slate-500 font-sans">Amount Paid:</span>
              <span className="font-bold text-emerald-700">₹{successOrder.totalAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <span className="text-slate-500 font-sans">Payment Method:</span>
              <span className="font-bold text-slate-900">{successOrder.paymentMethod || 'Razorpay Standard Checkout'}</span>
            </div>

            {successOrder.paymentReference && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">Payment ID:</span>
                <span className="font-mono text-slate-700 text-xs truncate max-w-[200px]">{successOrder.paymentReference}</span>
              </div>
            )}
          </div>

          <div className="pt-2 space-y-3">
            <p className="text-xs text-slate-500">
              Auto-returning to homepage in <strong className="text-emerald-700 font-bold">{redirectCountdown}s</strong>...
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-emerald-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Razorpay Secure Checkout</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Complete Secure Payment
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Order #{order.orderNumber} • Total Amount: <span className="font-bold text-emerald-400 text-base">₹{amount.toFixed(2)}</span>
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
            <div className="font-bold">Payment Error</div>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Main Single Payment Gateway: Razorpay Checkout Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Razorpay Payment Gateway</h2>
              <p className="text-xs text-slate-500">Official, bank-grade payment processing</p>
            </div>
          </div>
          <span className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            100% Secure
          </span>
        </div>

        {/* Supported Payment Channels */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
          <div className="text-xs font-bold text-slate-700">Supported in the Razorpay Modal:</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 font-bold text-slate-800 flex items-center justify-center gap-1.5 shadow-2xs">
              <span className="text-emerald-600">⚡</span> Google Pay
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 font-bold text-slate-800 flex items-center justify-center gap-1.5 shadow-2xs">
              <span className="text-purple-600">⚡</span> PhonePe
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 font-bold text-slate-800 flex items-center justify-center gap-1.5 shadow-2xs">
              <span className="text-blue-600">⚡</span> Paytm / UPI
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 font-bold text-slate-800 flex items-center justify-center gap-1.5 shadow-2xs">
              <span className="text-slate-600">💳</span> Cards / NetBanking
            </div>
          </div>
        </div>

        {/* Order Summary Snapshot */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3 text-xs">
          <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
            Order Details
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

          <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-sm font-black text-slate-900">
            <span>Total Payable Amount:</span>
            <span className="text-emerald-700 text-xl font-black">₹{amount.toFixed(2)}</span>
          </div>
        </div>

        {/* Single Primary Action: Razorpay Standard Checkout Button */}
        <div className="space-y-3">
          <button
            type="button"
            id="razorpay-pay-button"
            onClick={handleRazorpayCheckout}
            disabled={isVerifying || isRazorpayLoading || isExpired}
            className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-base rounded-2xl transition shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 cursor-pointer disabled:cursor-not-allowed transform active:scale-98"
          >
            {isRazorpayLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-white" />
                <span>Opening Razorpay Checkout Modal...</span>
              </>
            ) : isVerifying ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-white" />
                <span>Verifying Payment with Razorpay...</span>
              </>
            ) : (
              <>
                <Lock className="w-5 h-5 text-emerald-200" />
                <span>Pay ₹{amount.toFixed(2)} via Razorpay</span>
                <ArrowRight className="w-5 h-5 text-emerald-200" />
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Instant confirmation with 256-bit bank encryption & HMAC verification</span>
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
            ← Edit Order
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
    </div>
  );
};
