import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  MapPin,
  Phone,
  Search,
  Download,
  Share2,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { OrderRecord, ShopSettings } from '../types';

interface OrderConfirmationPageProps {
  order: OrderRecord;
  settings: ShopSettings;
  onNavigate: (page: string, params?: any) => void;
}

export const OrderConfirmationPage: React.FC<OrderConfirmationPageProps> = ({
  order,
  settings,
  onNavigate,
}) => {
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    // Trigger celebratory confetti on load
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
  }, []);

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print:p-0 print:m-0">
      {/* Success Hero Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 text-center space-y-4 border border-slate-800 shadow-xl print:hidden">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
            <span>Order Successfully Submitted</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Thank You, {order.customer.name}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
            Your print order has been placed. Payment verification is underway, after which your documents will be printed and prepared for pickup.
          </p>
        </div>

        {/* Order Number & Delivery PIN Badges */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {/* Order Number */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 flex items-center gap-3 w-full sm:w-auto justify-between">
            <div className="text-left">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Your Order Number
              </div>
              <div className="font-mono text-lg font-black text-amber-400 tracking-wider">
                {order.orderNumber}
              </div>
            </div>
            <button
              onClick={copyOrderNumber}
              className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition cursor-pointer"
              title="Copy order number"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Delivery PIN Badge */}
          <div className="bg-amber-400/10 border-2 border-amber-400 rounded-2xl p-4 flex items-center gap-3 w-full sm:w-auto justify-between text-left">
            <div>
              <div className="text-[10px] text-amber-300 uppercase font-black tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Delivery PIN</span>
              </div>
              <div className="font-mono text-2xl font-black text-amber-400 tracking-widest">
                {order.deliveryPin || '4921'}
              </div>
            </div>
            <div className="text-[10px] text-slate-300 max-w-[120px] leading-tight">
              Show at RSCC Counter for pickup
            </div>
          </div>
        </div>
      </div>

      {/* Official Order Receipt Card (Print Friendly) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6 print:border-none print:shadow-none">
        {/* Receipt Shop Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-xl tracking-tight">
                {settings.shopName}
              </span>
              <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2 py-0.5 rounded border border-amber-300">
                RSCC
              </span>
            </div>
            <div className="text-xs text-slate-500">
              {settings.address} • {settings.phone}
            </div>
          </div>

          <div className="text-left sm:text-right space-y-0.5">
            <div className="text-xs text-slate-500 font-medium">Order Date</div>
            <div className="text-xs font-bold text-slate-900">
              {new Date(order.createdAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
          </div>
        </div>

        {/* Status Callouts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 space-y-1">
            <div className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Payment Status</span>
            </div>
            <div className="text-sm font-black text-amber-900">
              {order.paymentStatus === 'VERIFIED'
                ? 'Payment Verified ✓'
                : 'Payment Verification Required'}
            </div>
            {order.paymentReference && (
              <div className="text-[11px] font-mono text-amber-800 truncate">
                Ref / UTR: {order.paymentReference}
              </div>
            )}
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-1">
            <div className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" />
              <span>Print Status</span>
            </div>
            <div className="text-sm font-black text-slate-900 capitalize">
              {order.orderStatus.replace(/_/g, ' ')}
            </div>
            <div className="text-[11px] text-slate-500">
              Estimated pickup: Today ({settings.pickupTimings})
            </div>
          </div>
        </div>

        {/* Customer & Order Items Breakdown */}
        <div className="space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
            Order Breakdown
          </h3>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="text-slate-500 font-medium">Customer</div>
                <div className="font-bold text-slate-900">{order.customer.name}</div>
              </div>
              <div>
                <div className="text-slate-500 font-medium">Mobile</div>
                <div className="font-bold text-slate-900">{order.customer.mobile}</div>
              </div>
              <div>
                <div className="text-slate-500 font-medium">Print Type</div>
                <div className="font-bold text-slate-900">
                  {order.printType === 'BW' ? 'Black & White' : 'Colour'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-medium">Side</div>
                <div className="font-bold text-slate-900">
                  {order.printingSide === 'BOTH' ? 'Both Side' : 'Single Side'}
                </div>
              </div>
            </div>

            {/* Files list */}
            <div className="space-y-1.5">
              <div className="font-bold text-slate-700">Uploaded Documents:</div>
              {order.files.map((f, i) => (
                <div key={i} className="flex justify-between items-center text-slate-600 pl-2">
                  <span className="truncate max-w-xs">• {f.name}</span>
                  <span className="font-mono text-slate-500">{f.pageCount} page(s)</span>
                </div>
              ))}
            </div>

            {order.specialInstructions && (
              <div className="pt-2 border-t border-slate-200 text-slate-700">
                <span className="font-semibold">Special Instructions:</span>{' '}
                <span>{order.specialInstructions}</span>
              </div>
            )}
          </div>

          {/* Pricing Math Box */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-2 border border-slate-800">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Chargeable Pages / Sheets:</span>
              <span className="font-mono font-bold text-white">
                {order.mode === 'PHOTO' ? `${order.totalSheets || 1} Sheets` : `${order.totalPages} Pages`}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Copies:</span>
              <span className="font-mono font-bold text-white">{order.copies}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Rate per page/sheet:</span>
              <span className="font-mono font-bold text-amber-400">₹{order.ratePerPage}</span>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <span className="font-extrabold text-sm text-white uppercase tracking-wider">
                Total Paid Amount
              </span>
              <span className="font-black text-2xl text-emerald-400">
                ₹{order.totalAmount}
              </span>
            </div>
          </div>
        </div>

        {/* Pickup Notice */}
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-950">
          <MapPin className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold text-sm">Shop Pickup Location</div>
            <div>{settings.address}</div>
            <div className="text-emerald-800 font-medium">Timings: {settings.pickupTimings}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onNavigate('track', { orderNumber: order.orderNumber, mobile: order.customer.mobile })}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-3 rounded-xl transition flex items-center justify-center gap-2 shadow cursor-pointer"
            >
              <Search className="w-4 h-4 text-amber-400" />
              <span>Track Live Status</span>
            </button>

            <button
              onClick={() => onNavigate('my-orders')}
              className="bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-bold px-4 py-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-amber-800" />
              <span>My Past Orders</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrintReceipt}
              className="flex-1 sm:flex-none border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold px-4 py-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>

            <button
              onClick={() => onNavigate('upload')}
              className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Another</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
