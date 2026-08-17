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
  Copy,
  Check,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { OrderRecord, ShopSettings } from '../types';
import { apiClient } from '../services/apiClient';

interface MyOrdersPageProps {
  settings: ShopSettings;
  onNavigate: (page: string, params?: any) => void;
}

export const MyOrdersPage: React.FC<MyOrdersPageProps> = ({ settings, onNavigate }) => {
  const [localOrders, setLocalOrders] = useState<OrderRecord[]>([]);
  const [mobileSearch, setMobileSearch] = useState<string>('');
  const [serverOrders, setServerOrders] = useState<OrderRecord[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copiedPin, setCopiedPin] = useState<string | null>(null);
  const [copiedOrder, setCopiedOrder] = useState<string | null>(null);

  // Load orders stored in localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('rscc_customer_orders');
      if (raw) {
        const parsed: OrderRecord[] = JSON.parse(raw);
        setLocalOrders(parsed);
      }
    } catch (e) {
      console.warn('Could not parse localStorage orders', e);
    }
  }, []);

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

  const handleSearchByMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileSearch.trim() || mobileSearch.trim().length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const orders = await apiClient.getCustomerOrders(mobileSearch.trim());
      setServerOrders(orders);
      if (orders.length === 0) {
        setErrorMsg('No orders found for this mobile number.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to find orders for this mobile number.');
      setServerOrders(null);
    } finally {
      setLoading(false);
    }
  };

  // Combine and deduplicate orders to display
  const displayOrders = serverOrders !== null
    ? serverOrders
    : localOrders;

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
    if (order.paymentStatus === 'VERIFIED') {
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
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              <span>Customer Order Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              My Past Orders & Delivery PINs
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              View your active print queues, verification statuses, and 4-digit pickup Delivery PINs.
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

        {/* Mobile Number Search lookup */}
        <div className="pt-2 border-t border-slate-800">
          <form
            onSubmit={handleSearchByMobile}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
          >
            <div className="sm:col-span-8">
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  placeholder="Find orders by 10-digit mobile number..."
                  value={mobileSearch}
                  onChange={(e) => setMobileSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="sm:col-span-4 flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>LOOKUP</span>
              </button>

              {serverOrders !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setServerOrders(null);
                    setMobileSearch('');
                    setErrorMsg('');
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl transition cursor-pointer"
                  title="Clear search"
                >
                  Reset
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Orders List */}
      {displayOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900">No Past Orders Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven't placed any orders from this device yet, or search returned 0 records. Upload your documents to print right away!
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
              Showing {displayOrders.length} Order{displayOrders.length > 1 ? 's' : ''}
              {serverOrders !== null ? ` for mobile ${mobileSearch}` : ' on this device'}
            </span>
            <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Delivery PIN required at pickup
            </span>
          </div>

          <div className="space-y-4">
            {displayOrders.map((ord) => (
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
                      <span>Track Status</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
