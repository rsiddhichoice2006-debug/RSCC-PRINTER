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
  LogIn,
  UserCheck,
  Lock,
  UserPlus,
} from 'lucide-react';
import { OrderRecord, ShopSettings } from '../types';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

interface MyOrdersPageProps {
  settings: ShopSettings;
  onNavigate: (page: string, params?: any) => void;
  onOpenAuthModal?: (mode?: 'login' | 'signup') => void;
}

export const MyOrdersPage: React.FC<MyOrdersPageProps> = ({
  settings,
  onNavigate,
  onOpenAuthModal,
}) => {
  const { currentUser, customerProfile, logout, openAuthModal } = useAuth();
  const isAuthenticated = !!(currentUser || customerProfile);

  // Orders State (isolated strictly to verified customer)
  const [customerOrders, setCustomerOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copiedPin, setCopiedPin] = useState<string | null>(null);
  const [copiedOrder, setCopiedOrder] = useState<string | null>(null);

  // Load orders strictly for the authenticated customer across all their identifiers
  const loadOrdersForCustomer = async (identifier?: string, isSilent = false) => {
    if (!isSilent) {
      setLoadingOrders(true);
    }
    setErrorMsg('');
    try {
      const queries = new Set<string>();
      if (identifier) queries.add(identifier.trim());
      if (customerProfile?.mobile) queries.add(customerProfile.mobile.trim());
      if (customerProfile?.email) queries.add(customerProfile.email.trim());
      if (customerProfile?.id) queries.add(customerProfile.id.trim());
      if (currentUser?.email) queries.add(currentUser.email.trim());
      if (currentUser?.uid) queries.add(currentUser.uid.trim());

      if (queries.size === 0) {
        setCustomerOrders([]);
        return;
      }

      const allOrders: OrderRecord[] = [];
      const seenIds = new Set<string>();

      for (const q of queries) {
        if (!q) continue;
        const res = await apiClient.getCustomerOrders(q);
        for (const ord of res) {
          const key = ord.id || ord.orderNumber;
          if (key && !seenIds.has(key)) {
            seenIds.add(key);
            if (ord.orderNumber) seenIds.add(ord.orderNumber);
            if (ord.id) seenIds.add(ord.id);
            allOrders.push(ord);
          }
        }
      }

      allOrders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setCustomerOrders(allOrders);
    } catch (err: any) {
      console.warn('Could not fetch orders:', err);
      if (!isSilent) {
        setErrorMsg(err.message || 'Could not fetch your order history.');
      }
      setCustomerOrders([]);
    } finally {
      if (!isSilent) {
        setLoadingOrders(false);
      }
    }
  };

  // Automatically sync when logged in & poll every 3 seconds for simultaneous updates
  useEffect(() => {
    if (!isAuthenticated) {
      setCustomerOrders([]);
      return;
    }

    loadOrdersForCustomer();

    // Auto-polling interval
    const interval = setInterval(() => {
      loadOrdersForCustomer(undefined, true);
    }, 3000);

    const handleOrderEvent = () => {
      loadOrdersForCustomer(undefined, true);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'rscc_orders_v2') {
        loadOrdersForCustomer(undefined, true);
      }
    };

    window.addEventListener('rscc_order_updated', handleOrderEvent);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('rscc_order_updated', handleOrderEvent);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated, currentUser, customerProfile]);

  const handleOpenLogin = (mode: 'login' | 'signup' = 'login') => {
    if (onOpenAuthModal) {
      onOpenAuthModal(mode);
    } else {
      openAuthModal(mode);
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
          <span>Ready to Pick Up</span>
        </span>
      );
    }
    if (order.orderStatus === 'PRINTING') {
      return (
        <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 text-[11px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
          <Printer className="w-3 h-3 text-indigo-700" />
          <span>Getting Prepared</span>
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
        <span>Order Received</span>
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
              My Orders & Print Bookings
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

        {/* Logged In User Account Status */}
        {isAuthenticated && (
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs text-slate-300">
                Signed In As:{' '}
                <strong className="text-amber-400 font-mono">
                  {customerProfile?.name || currentUser?.displayName || customerProfile?.mobile || currentUser?.email || 'Customer'}
                </strong>
                {customerProfile?.mobile && (
                  <span className="text-slate-400 text-[11px] ml-1.5 font-mono">
                    ({customerProfile.mobile})
                  </span>
                )}
              </span>
              <span className="bg-emerald-950 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-800">
                ✓ Account Verified
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadOrdersForCustomer()}
                disabled={loadingOrders}
                className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
                <span>Refresh Orders</span>
              </button>

              <button
                onClick={() => logout()}
                className="text-xs text-rose-300 hover:text-rose-200 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notice: Self-Pickup Only (Delivery Starting Soon) */}
      <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 text-xs text-amber-950 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-black text-amber-900 text-sm block">
            ⚠️ Store Counter Pickup Only (Home Delivery Starting Soon!)
          </span>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Please note that we have not currently started doorstep delivery services. Home delivery will be started soon! All completed orders can be picked up at our shop counter ({settings.address}) with your 4-digit Delivery PIN.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STATE 1: PLEASE SIGN IN PROMPT (When not logged in) */}
      {!isAuthenticated ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-md text-center space-y-6 max-w-lg mx-auto">
          <div className="w-16 h-16 bg-amber-100 text-amber-900 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1 rounded-full uppercase">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>Customer Authentication Required</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              Sign In to View Your Bookings & Orders
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
              Please sign in to your email account with password to securely view your print jobs, live order tracking, and 4-digit pickup PINs.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => handleOpenLogin('login')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In with Email</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenLogin('signup')}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create New Account</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>End-to-end protected by Firebase Authentication</span>
          </div>
        </div>
      ) : (
        /* STATE 2: AUTHENTICATED ORDERS LIST */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>Your Orders ({customerOrders.length})</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Showing orders for {currentUser.email || customerProfile?.name || 'your account'}
            </span>
          </div>

          {loadingOrders ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs font-bold text-slate-600">Loading your orders from database...</p>
            </div>
          ) : customerOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs space-y-4">
              <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <FileText className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">No Orders Placed Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  You haven't placed any print orders with this email account yet. Upload documents or photos to make your first booking!
                </p>
              </div>
              <button
                onClick={() => onNavigate('upload')}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition shadow cursor-pointer inline-flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Upload & Print Now</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {customerOrders.map((order, idx) => (
                <div
                  key={order.id ? `cust-order-${order.id}-${idx}` : `cust-order-${idx}`}
                  className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {order.orderNumber}
                      </span>
                      <button
                        onClick={() => handleCopyOrder(order.orderNumber)}
                        className="text-slate-400 hover:text-slate-700 transition cursor-pointer"
                        title="Copy Order ID"
                      >
                        {copiedOrder === order.orderNumber ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">{getStatusBadge(order)}</div>
                  </div>

                  {/* Order Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Print Type:</span>
                      <span className="font-bold text-slate-900">
                        {order.printType === 'COLOUR' ? 'Colour' : 'B&W'} (
                        {order.printingSide === 'BOTH' ? 'Both Side' : 'Single Side'})
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">Pages & Copies:</span>
                      <span className="font-bold text-slate-900">
                        {order.totalPages} pgs × {order.copies} set{order.copies === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">Total Paid:</span>
                      <span className="font-black text-emerald-700 text-sm">
                        ₹{order.totalAmount.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">Pickup Delivery PIN:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 text-sm">
                          {order.deliveryPin}
                        </span>
                        <button
                          onClick={() => handleCopyPin(order.deliveryPin)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="Copy PIN"
                        >
                          {copiedPin === order.deliveryPin ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Files List */}
                  {order.files && order.files.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Files in this order:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {order.files?.map((file, idx) => (
                          <div
                            key={idx}
                            className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-medium text-slate-800 max-w-[200px] truncate">
                              {file?.name || 'Document'}
                            </span>
                            <span className="text-slate-400 text-[11px]">({file?.pageCount || 1} pgs)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
