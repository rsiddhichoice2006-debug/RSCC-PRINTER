import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Search,
  CheckCircle2,
  Clock,
  Printer,
  PackageCheck,
  AlertCircle,
  MapPin,
  Phone,
  RefreshCw,
  FileText,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { OrderRecord, ShopSettings } from '../types';
import { apiClient } from '../services/apiClient';

interface TrackOrderPageProps {
  settings: ShopSettings;
  initialOrderNumber?: string;
  initialMobile?: string;
}

// Gentle dual-tone counter pickup chime
function playReadyChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15); // A5
    gain2.gain.setValueAtTime(0.18, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch {
    // Ignore audio permission restrictions
  }
}

export const TrackOrderPage: React.FC<TrackOrderPageProps> = ({
  settings,
  initialOrderNumber = '',
  initialMobile = '',
}) => {
  const [orderNumber, setOrderNumber] = useState<string>(initialOrderNumber);
  const [mobile, setMobile] = useState<string>(initialMobile);
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLiveSyncing, setIsLiveSyncing] = useState<boolean>(false);

  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialOrderNumber && initialMobile) {
      handleSearch(initialOrderNumber, initialMobile);
    }
  }, [initialOrderNumber, initialMobile]);

  // Real-time synchronization: polling & event listeners
  useEffect(() => {
    if (!order) return;

    // Check if status changed to READY_FOR_PICKUP
    if (order.orderStatus === 'READY_FOR_PICKUP' && prevStatusRef.current && prevStatusRef.current !== 'READY_FOR_PICKUP') {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
        });
      } catch {}
      playReadyChime();
    }
    prevStatusRef.current = order.orderStatus;

    // Stop polling if order is completed or cancelled
    if (order.orderStatus === 'COMPLETED' || order.orderStatus === 'CANCELLED') {
      return;
    }

    const syncOrderSilently = async () => {
      try {
        setIsLiveSyncing(true);
        const searchOrd = order.orderNumber;
        const searchMob = order.customer?.mobile || order.customer?.email || mobile;
        if (searchOrd && searchMob) {
          const fresh = await apiClient.trackOrder(searchOrd, searchMob);
          if (fresh) {
            setOrder((prev) => {
              if (prev && (prev.orderStatus !== fresh.orderStatus || prev.paymentStatus !== fresh.paymentStatus)) {
                if (fresh.orderStatus === 'READY_FOR_PICKUP' && prev.orderStatus !== 'READY_FOR_PICKUP') {
                  try {
                    confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
                  } catch {}
                  playReadyChime();
                }
                return fresh;
              }
              return fresh;
            });
          }
        }
      } catch {
        // Silent background sync
      } finally {
        setTimeout(() => setIsLiveSyncing(false), 600);
      }
    };

    // 1. Polling interval every 2.5 seconds
    const interval = setInterval(syncOrderSilently, 2500);

    // 2. Immediate window event listener (dispatched in apiClient on status update)
    const handleOrderEvent = (e: any) => {
      const updatedOrder = e.detail as OrderRecord;
      if (updatedOrder && (updatedOrder.id === order.id || updatedOrder.orderNumber === order.orderNumber)) {
        setOrder(updatedOrder);
        if (updatedOrder.orderStatus === 'READY_FOR_PICKUP' && prevStatusRef.current !== 'READY_FOR_PICKUP') {
          try {
            confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
          } catch {}
          playReadyChime();
        }
        prevStatusRef.current = updatedOrder.orderStatus;
      }
    };

    // 3. LocalStorage cross-tab storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'rscc_orders_v2' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const found = parsed.find((o: OrderRecord) => o.id === order.id || o.orderNumber === order.orderNumber);
          if (found) {
            setOrder(found);
            if (found.orderStatus === 'READY_FOR_PICKUP' && prevStatusRef.current !== 'READY_FOR_PICKUP') {
              try {
                confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
              } catch {}
              playReadyChime();
            }
            prevStatusRef.current = found.orderStatus;
          }
        } catch {}
      }
    };

    window.addEventListener('rscc_order_updated', handleOrderEvent);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('rscc_order_updated', handleOrderEvent);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [order?.id, order?.orderNumber, mobile]);

  const handleSearch = async (ordNum?: string, mobNum?: string) => {
    const searchOrd = ordNum || orderNumber;
    const searchMob = mobNum || mobile;

    if (!searchOrd.trim() || !searchMob.trim()) {
      setErrorMsg('Please enter both Order Number and your Mobile Number or Email ID.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const result = await apiClient.trackOrder(searchOrd, searchMob);
      setOrder(result);
      prevStatusRef.current = result.orderStatus;
    } catch (err: any) {
      setErrorMsg(err.message || 'No matching order found. Please verify your order number and mobile/email.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { key: 'PLACED', label: 'Order Placed', desc: 'Received online' },
    { key: 'VERIFICATION', label: 'Payment Verification', desc: 'Shop verifying UTR' },
    { key: 'PRINTING', label: 'Getting Prepared', desc: 'Staff preparing and printing' },
    { key: 'READY', label: 'Ready to Pick Up', desc: 'Packed & ready at counter' },
    { key: 'COMPLETED', label: 'Collected / Completed', desc: 'Handed over to customer' },
  ];

  const getStepIndex = (order: OrderRecord): number => {
    if (order.orderStatus === 'COMPLETED') return 4;
    if (order.orderStatus === 'READY_FOR_PICKUP') return 3;
    if (order.orderStatus === 'PRINTING') return 2;
    if (order.paymentStatus === 'VERIFIED') return 2; // ready to print or printing
    if (order.paymentStatus === 'PAYMENT_VERIFICATION_REQUIRED') return 1;
    return 0;
  };

  const currentStep = order ? getStepIndex(order) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-800 text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
          <Search className="w-3.5 h-3.5" />
          <span>Real-Time Order Tracking</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
          Track Your Print Order
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
          Enter your RSCC Order Number and the Mobile Number provided during checkout to check real-time status.
        </p>

        {/* Search Bar Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="pt-4 max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-12 gap-3"
        >
          <div className="sm:col-span-6">
            <input
              type="text"
              placeholder="Order Number (e.g. RSCC-XXXX)"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="sm:col-span-4">
            <input
              type="text"
              placeholder="Mobile Number or Email ID"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-full min-h-[46px] bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs uppercase px-4 py-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>TRACK</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Order Tracking Timeline & Details */}
      {order && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6 animate-in fade-in">
          {/* Live Sync Badge & Timestamp */}
          <div className="flex items-center justify-between bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isLiveSyncing ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isLiveSyncing ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              </span>
              <span className="font-bold text-slate-800">
                {isLiveSyncing ? 'Syncing status with staff portal...' : 'Live Connected with Shop Counter'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Updates simultaneously when staff prepares or marks ready
            </span>
          </div>

          {/* Celebratory Ready to Pick Up Banner when status is READY_FOR_PICKUP */}
          {order.orderStatus === 'READY_FOR_PICKUP' && (
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-5 rounded-2xl shadow-lg border border-emerald-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in zoom-in-95">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
                  <PackageCheck className="w-7 h-7" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-amber-300 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1">
                    <Sparkles className="w-3 h-3" />
                    <span>PRINT JOB COMPLETE</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                    Your Order is READY TO PICK UP!
                  </h3>
                  <p className="text-xs text-emerald-100 mt-0.5 max-w-xl leading-relaxed">
                    Your documents have been printed and packed. Please visit our shop counter at <strong>{settings.address}</strong> and show your 4-digit Delivery PIN: <strong className="font-mono bg-white/20 px-1.5 py-0.5 rounded text-white">{order.deliveryPin || '4921'}</strong> to collect.
                  </p>
                </div>
              </div>
              <div className="bg-white text-slate-900 px-4 py-2.5 rounded-xl font-black text-center text-xs shrink-0 shadow">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Counter PIN</div>
                <div className="font-mono text-xl text-emerald-700 font-black tracking-widest">{order.deliveryPin || '4921'}</div>
              </div>
            </div>
          )}

          {/* Preparing In Progress Banner */}
          {order.orderStatus === 'PRINTING' && (
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-950 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in">
              <Printer className="w-6 h-6 text-indigo-600 animate-pulse shrink-0" />
              <div className="text-xs">
                <span className="font-black text-indigo-900 block text-sm">Getting Prepared (Printing on Press)</span>
                <span>Our staff has downloaded your files and is preparing your physical print job now.</span>
              </div>
            </div>
          )}

          {/* Notice: Self-Pickup Only (Delivery Starting Soon) */}
          <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 text-xs text-amber-950 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-black text-amber-900 text-sm block">
                ⚠️ Store Counter Pickup Only (Home Delivery Starting Soon!)
              </span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Please note that we have not currently started doorstep delivery services. Home delivery will be started soon! All print orders must be collected directly from the RSCC store counter ({settings.address}).
              </p>
            </div>
          </div>

          {/* Order Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xl font-black text-slate-900">
                  {order.orderNumber}
                </span>
                <span className="bg-slate-100 text-slate-800 text-xs font-bold px-2 py-0.5 rounded">
                  {order.mode === 'PHOTO' ? 'Photo Printing' : 'Document Printing'}
                </span>
                <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                  order.orderStatus === 'PRINTING'
                    ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                    : order.orderStatus === 'READY_FOR_PICKUP'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200 animate-pulse'
                    : order.orderStatus === 'COMPLETED'
                    ? 'bg-slate-200 text-slate-800'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {order.orderStatus === 'PRINTING'
                    ? 'Getting Prepared'
                    : order.orderStatus === 'READY_FOR_PICKUP'
                    ? 'Ready to Pick Up'
                    : order.orderStatus.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Customer: <strong>{order.customer.name}</strong> • {order.customer.mobile}
              </p>
            </div>

            {/* Delivery PIN & Total Amount */}
            <div className="flex items-center gap-4">
              <div className="bg-amber-400/15 border-2 border-amber-400 rounded-2xl px-4 py-2 text-center">
                <div className="text-[10px] text-amber-900 uppercase font-black tracking-wider flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-700" />
                  <span>Delivery PIN</span>
                </div>
                <div className="font-mono text-xl font-black text-slate-950 tracking-widest">
                  {order.deliveryPin || '4921'}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-2xl font-black text-slate-900">
                  ₹{order.totalAmount}
                </div>
                <div className="text-xs text-slate-500">
                  Placed on {new Date(order.createdAt).toLocaleDateString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
              Order Timeline
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {steps.map((step, idx) => {
                const isPassed = idx <= currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <div
                    key={step.key}
                    className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]'
                        : isPassed
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center ${
                            isCurrent
                              ? 'bg-amber-400 text-slate-950'
                              : isPassed
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {isPassed && !isCurrent ? '✓' : idx + 1}
                        </span>

                        {isCurrent && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        )}
                      </div>

                      <div className="font-bold text-xs leading-tight">
                        {step.label}
                      </div>
                    </div>

                    <div
                      className={`text-[10px] mt-2 ${
                        isCurrent
                          ? 'text-slate-300'
                          : isPassed
                          ? 'text-emerald-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3 text-xs">
              <h4 className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                Print Specifications
              </h4>

              <div className="space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Print Type:</span>
                  <span className="font-semibold text-slate-900">
                    {order.printType === 'BW' ? 'Black & White' : 'Colour Print'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Printing Side:</span>
                  <span className="font-semibold text-slate-900">
                    {order.printingSide === 'BOTH' ? 'Both Side (Duplex)' : 'Single Side'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sets / Copies:</span>
                  <span className="font-semibold text-slate-900">{order.copies} set{order.copies === 1 ? '' : 's'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Pages:</span>
                  <span className="font-semibold text-slate-900">{order.totalPages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Rate:</span>
                  <span className="font-semibold text-emerald-700">₹{order.ratePerPage}/page</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3 text-xs">
              <h4 className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                Payment & Collection
              </h4>

              <div className="space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Status:</span>
                  <span className="font-bold text-amber-800">
                    {order.paymentStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                {order.paymentReference && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">UTR / Ref:</span>
                    <span className="font-mono font-bold text-slate-900">{order.paymentReference}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Fulfillment Method:</span>
                  <span className="font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">
                    Counter Pickup Only
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Home Delivery:</span>
                  <span className="font-semibold text-slate-600">Starting Soon</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pickup Counter:</span>
                  <span className="font-semibold text-slate-900">RSCC Main Store</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Store Timings:</span>
                  <span className="font-semibold text-slate-900">{settings.pickupTimings}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
