import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { OrderRecord, ShopSettings } from '../types';
import { apiClient } from '../services/apiClient';

interface TrackOrderPageProps {
  settings: ShopSettings;
  initialOrderNumber?: string;
  initialMobile?: string;
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

  useEffect(() => {
    if (initialOrderNumber && initialMobile) {
      handleSearch(initialOrderNumber, initialMobile);
    }
  }, [initialOrderNumber, initialMobile]);

  const handleSearch = async (ordNum?: string, mobNum?: string) => {
    const searchOrd = ordNum || orderNumber;
    const searchMob = mobNum || mobile;

    if (!searchOrd.trim() || !searchMob.trim()) {
      setErrorMsg('Please enter both Order Number and Mobile Number.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const result = await apiClient.trackOrder(searchOrd, searchMob);
      setOrder(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'No matching order found. Please verify your order number and mobile number.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { key: 'PLACED', label: 'Order Placed', desc: 'Received online' },
    { key: 'VERIFICATION', label: 'Payment Verification', desc: 'Shop verifying UTR' },
    { key: 'PRINTING', label: 'Printing In Progress', desc: 'Documents on press' },
    { key: 'READY', label: 'Ready for Pickup', desc: 'Available at shop counter' },
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
              type="tel"
              placeholder="10-digit Mobile Number"
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
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-8 animate-in fade-in">
          {/* Order Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl font-black text-slate-900">
                  {order.orderNumber}
                </span>
                <span className="bg-slate-100 text-slate-800 text-xs font-bold px-2 py-0.5 rounded">
                  {order.mode === 'PHOTO' ? 'Photo Printing' : 'Document Printing'}
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
                  <span className="text-slate-500">Copies:</span>
                  <span className="font-semibold text-slate-900">{order.copies}</span>
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
