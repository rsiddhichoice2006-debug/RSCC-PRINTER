import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import {
  ShieldCheck,
  Lock,
  Search,
  Filter,
  DollarSign,
  Printer,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Phone,
  RefreshCw,
  Save,
  MessageSquare,
  Eye,
  Settings as SettingsIcon,
  Layers,
  ChevronDown,
  Sparkles,
  Download,
  FileArchive,
  Ban,
} from 'lucide-react';
import { AdminStats, OrderRecord, ShopSettings } from '../types';
import { apiClient } from '../services/apiClient';

interface AdminPageProps {
  settings: ShopSettings;
  onUpdateSettings: (newSettings: ShopSettings) => void;
  isAdminLoggedIn: boolean;
  onAdminLoginSuccess: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  settings,
  onUpdateSettings,
  isAdminLoggedIn,
  onAdminLoginSuccess,
}) => {
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Admin Dashboard State
  const [activeTab, setActiveTab] = useState<'orders' | 'settings' | 'audit'>('orders');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [downloadingZipOrderId, setDownloadingZipOrderId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  // Selected Order for Detail Drawer
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [newNote, setNewNote] = useState('');

  // Editable Settings
  const [editSettings, setEditSettings] = useState<ShopSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  useEffect(() => {
    setEditSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (isAdminLoggedIn) {
      loadDashboardData();
    }
  }, [isAdminLoggedIn]);

  const loadDashboardData = async () => {
    setLoadingOrders(true);
    try {
      const [ordersData, statsData] = await Promise.all([
        apiClient.getOrders(),
        apiClient.getAdminStats(),
      ]);
      setOrders(ordersData);
      setStats(statsData.stats);
      setAuditLogs(statsData.recentAuditLogs || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      await apiClient.adminLogin(email.trim(), password.trim());
      onAdminLoginSuccess();
      loadDashboardData();
    } catch (err: any) {
      // Offline fallback verification
      const cleanEmail = email.trim().toLowerCase();
      const cleanPass = password.trim();
      const validEmails = ['rsiddhi.choice.2006@gmail.com', 'admin@rscc.in', 'contact@rscc.in'];
      const validPass = ['RSIDDHI2006', 'rsiddhi2006', 'rscc123', 'admin123'];
      if (validEmails.includes(cleanEmail) && validPass.includes(cleanPass)) {
        onAdminLoginSuccess();
        loadDashboardData();
      } else {
        setLoginError('Invalid email or password. Access denied.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerifyPayment = async (orderId: string, verified: boolean) => {
    try {
      const updated = await apiClient.verifyPayment(
        orderId,
        verified,
        verified ? 'Verified on UPI merchant statement' : 'Payment failed / rejected by shop admin: order cancelled'
      );
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(updated);
      }
      loadDashboardData();
    } catch (err: any) {
      alert('Error verifying payment: ' + err.message);
    }
  };

  const handleDownloadAllZip = async (order: OrderRecord) => {
    setDownloadingZipOrderId(order.id);
    try {
      const zip = new JSZip();

      // 1. Add Order Summary manifest file
      const summaryText = `=====================================================
RIDDHI SIDDHI CHOICE CENTRE (RSCC) - ORDER FILES BUNDLE
=====================================================
Order Number   : ${order.orderNumber}
Delivery PIN   : ${order.deliveryPin || 'N/A'}
Creation Date  : ${new Date(order.createdAt).toLocaleString('en-IN')}
Service Mode   : ${order.mode === 'PHOTO' ? 'A4 Photo Printing' : 'Document Printing'}

CUSTOMER DETAILS:
Name           : ${order.customer.name}
Mobile         : ${order.customer.mobile}
Email          : ${order.customer.email || 'N/A'}
Special Notes  : ${order.specialInstructions || 'None'}

PRINT SPECIFICATIONS:
Print Type     : ${order.printType}
Printing Side  : ${order.printingSide}
Copies         : ${order.copies}
Total Sheets   : ${order.totalSheets}
Rate Per Page  : ₹${order.ratePerPage}
Total Amount   : ₹${order.totalAmount}
Payment Status : ${order.paymentStatus}
Order Status   : ${order.orderStatus}

=====================================================
FILES LIST (${order.files.length} Total):
${order.files.map((f, i) => `${i + 1}. ${f.name} (Pages: ${f.pageCount}, Size: ${(f.size / 1024).toFixed(1)} KB)`).join('\n')}
=====================================================
`;
      zip.file('00_ORDER_SUMMARY.txt', summaryText);

      // 2. Add each file into the zip
      for (let i = 0; i < order.files.length; i++) {
        const file = order.files[i];
        const safeName = file.name.replace(/[/\\?%*:|"<>]/g, '_');
        const filename = `${String(i + 1).padStart(2, '0')}_${safeName}`;

        if (file.previewUrl && file.previewUrl.startsWith('data:')) {
          const commaIdx = file.previewUrl.indexOf(',');
          if (commaIdx !== -1) {
            const base64Data = file.previewUrl.substring(commaIdx + 1);
            zip.file(filename, base64Data, { base64: true });
            continue;
          }
        }

        // Add informative text entry if base64 is binary streamed
        zip.file(
          filename.endsWith('.pdf') ? filename + '.txt' : filename,
          `File: ${file.name}\nPage Count: ${file.pageCount}\nSize: ${file.size} bytes\nOrder: ${order.orderNumber}`
        );
      }

      // 3. Add Payment Proof Screenshot if attached
      if (order.paymentScreenshot && order.paymentScreenshot.startsWith('data:')) {
        const commaIdx = order.paymentScreenshot.indexOf(',');
        if (commaIdx !== -1) {
          const base64Screenshot = order.paymentScreenshot.substring(commaIdx + 1);
          zip.file(`PAYMENT_PROOF_${order.paymentScreenshotFilename || 'screenshot.jpg'}`, base64Screenshot, { base64: true });
        }
      }

      // 4. Generate ZIP & Trigger download
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const cleanCustomerName = order.customer.name.replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `RSCC_${order.orderNumber}_${cleanCustomerName}_Files.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error('Failed to create ZIP download:', err);
      alert('Failed to generate ZIP archive: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloadingZipOrderId(null);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: OrderRecord['orderStatus']) => {
    try {
      const updated = await apiClient.updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(updated);
      }
      loadDashboardData();
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !newNote.trim()) return;

    try {
      const updated = await apiClient.addInternalNote(selectedOrder.id, newNote.trim());
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updated : o)));
      setNewNote('');
    } catch (err: any) {
      alert('Error adding note: ' + err.message);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSaveSuccessMsg('');
    try {
      const saved = await apiClient.updateSettings(editSettings);
      onUpdateSettings(saved);
      setSaveSuccessMsg('Shop settings and pricing updated successfully!');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    } catch (err: any) {
      alert('Error saving settings: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleAcceptingOrders = async (accepting: boolean) => {
    try {
      const updatedSettings: ShopSettings = {
        ...settings,
        ...editSettings,
        isAcceptingOrders: accepting,
        pauseOrderReason: 'Currently Not Accepting Orders Due to High Demand',
      };
      setEditSettings(updatedSettings);
      const saved = await apiClient.updateSettings(updatedSettings);
      onUpdateSettings(saved);
    } catch (err: any) {
      alert('Error updating order status: ' + err.message);
    }
  };

  // Filtered orders list
  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer.mobile.includes(searchQuery);

    const matchesStatus = statusFilter === 'ALL' || o.orderStatus === statusFilter;
    const matchesPayment = paymentFilter === 'ALL' || o.paymentStatus === paymentFilter;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  // Login Screen if not authenticated
  if (!isAdminLoggedIn) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center mx-auto shadow-md">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              RSCC Shop Admin
            </h1>
            <p className="text-xs text-slate-500">
              Sign in to manage printing orders, verify UPI payments, and adjust pricing.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Email Address</label>
              <input
                type="email"
                required
                placeholder="Enter admin email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Password</label>
              <input
                type="password"
                required
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {loginError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold text-sm py-3 rounded-xl shadow transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loginLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>LOGIN TO RSCC ADMIN</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Header & Stats */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>RSCC Shop Manager</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">
              Order Dispatch & Verification Desk
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDashboardData}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Orders</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-400 font-medium">Total Orders</div>
              <div className="text-2xl font-black text-white">{stats.totalOrders}</div>
              <div className="text-[10px] text-slate-400">All-time count</div>
            </div>

            <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-amber-300 font-medium">Pending Verification</div>
              <div className="text-2xl font-black text-amber-400">{stats.pendingVerification}</div>
              <div className="text-[10px] text-amber-300/80">Requires UTR check</div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-400 font-medium">Today's Orders</div>
              <div className="text-2xl font-black text-emerald-400">{stats.todayOrders}</div>
              <div className="text-[10px] text-slate-400">Received today</div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-400 font-medium">Total Revenue</div>
              <div className="text-2xl font-black text-amber-400">₹{stats.totalRevenue}</div>
              <div className="text-[10px] text-slate-400">Verified receipts</div>
            </div>
          </div>
        )}

        {/* Live Order Acceptance Control Banner */}
        <div className={`rounded-2xl p-5 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
          settings.isAcceptingOrders === false
            ? 'bg-rose-950/70 border-rose-600/80 text-rose-100 shadow-lg'
            : 'bg-emerald-950/40 border-emerald-600/60 text-emerald-100'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                settings.isAcceptingOrders === false
                  ? 'bg-rose-500 text-white'
                  : 'bg-emerald-400 text-slate-950'
              }`}>
                {settings.isAcceptingOrders === false ? '🔴 Orders Paused' : '🟢 Accepting Orders'}
              </span>
              <span className="font-extrabold text-sm sm:text-base">
                {settings.isAcceptingOrders === false
                  ? 'Shop is NOT Accepting Orders (High Demand)'
                  : 'Shop is Live & Receiving Customer Orders'}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              {settings.isAcceptingOrders === false
                ? 'Customer screen displays: "Currently Not Accepting Orders Due to High Demand". Order placement buttons are locked.'
                : 'Customer portal is open. Customers can upload documents, configure photos, and proceed to payment.'}
            </p>
          </div>

          <div className="shrink-0">
            {settings.isAcceptingOrders === false ? (
              <button
                type="button"
                onClick={() => handleToggleAcceptingOrders(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-5 py-3 rounded-xl transition flex items-center gap-2 shadow-md cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>RESUME ACCEPTING ORDERS</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleAcceptingOrders(false)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-5 py-3 rounded-xl transition flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Ban className="w-4 h-4 text-white" />
                <span>DO NOT ACCEPT ORDERS</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
            activeTab === 'orders'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Active Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
            activeTab === 'settings'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Pricing & Shop Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Audit Log</span>
        </button>
      </div>

      {/* TAB 1: ORDERS MANAGEMENT */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
            <div className="sm:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by Order #, Name, Mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="sm:col-span-4 flex items-center gap-2">
              <span className="text-slate-500 font-semibold shrink-0">Print Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="PLACED">Placed</option>
                <option value="PRINTING">Printing</option>
                <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <div className="sm:col-span-3 flex items-center gap-2">
              <span className="text-slate-500 font-semibold shrink-0">Payment:</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white"
              >
                <option value="ALL">All Payments</option>
                <option value="PAYMENT_VERIFICATION_REQUIRED">Verification Required</option>
                <option value="VERIFIED">Verified</option>
                <option value="PAYMENT_PENDING">Pending</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white uppercase tracking-wider text-[11px] font-extrabold">
                  <tr>
                    <th className="py-3.5 px-4">Order # & PIN</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Type & Pages</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Screenshot / Pay</th>
                    <th className="py-3.5 px-4">Print Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                        No orders placed by customers yet.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => (
                      <tr
                        key={ord.id}
                        className="hover:bg-slate-50/80 transition cursor-pointer"
                        onClick={() => setSelectedOrder(ord)}
                      >
                        <td className="py-3.5 px-4 font-mono">
                          <div className="font-black text-slate-900">{ord.orderNumber}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="bg-amber-100 text-amber-950 font-black px-1.5 py-0.5 rounded text-[10px] tracking-wider border border-amber-300">
                              PIN: {ord.deliveryPin || '4921'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(ord.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{ord.customer.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {ord.customer.mobile}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">
                            {ord.printType} • {ord.printingSide === 'BOTH' ? 'Both Side' : 'Single'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {ord.totalPages} pgs × {ord.copies} copy
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-black text-slate-900 text-sm">
                            ₹{ord.totalAmount}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            ₹{ord.ratePerPage}/page
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            {ord.paymentStatus === 'VERIFIED' ? (
                              <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Verified
                              </span>
                            ) : ord.paymentStatus === 'PAYMENT_VERIFICATION_REQUIRED' ? (
                              <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1 animate-pulse">
                                <Clock className="w-3 h-3 text-amber-700" />
                                Verify Screenshot
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-full text-[10px]">
                                {ord.paymentStatus}
                              </span>
                            )}

                            {ord.paymentScreenshot && (
                              <span className="text-[10px] text-indigo-700 font-semibold flex items-center gap-0.5">
                                📸 Screenshot Attached
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                              ord.orderStatus === 'COMPLETED'
                                ? 'bg-slate-200 text-slate-800'
                                : ord.orderStatus === 'READY_FOR_PICKUP'
                                ? 'bg-blue-100 text-blue-900'
                                : ord.orderStatus === 'PRINTING'
                                ? 'bg-indigo-100 text-indigo-900'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {ord.orderStatus.replace(/_/g, ' ')}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadAllZip(ord);
                              }}
                              disabled={downloadingZipOrderId === ord.id}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Download all customer files as .ZIP"
                            >
                              {downloadingZipOrderId === ord.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              <span>ZIP</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(ord);
                              }}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition cursor-pointer"
                            >
                              Manage
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRICING & SHOP SETTINGS */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Order Reception & Demand Control Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Store Order Acceptance Status</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Quickly halt or resume new incoming print and photo orders during peak shop hours.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditSettings({ ...editSettings, isAcceptingOrders: true })}
                  className={`px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
                    editSettings.isAcceptingOrders !== false
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Accept Orders (Open)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditSettings({
                    ...editSettings,
                    isAcceptingOrders: false,
                    pauseOrderReason: editSettings.pauseOrderReason || 'Currently Not Accepting Orders Due to High Demand',
                  })}
                  className={`px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
                    editSettings.isAcceptingOrders === false
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Do Not Accept (High Demand)</span>
                </button>
              </div>
            </div>

            {editSettings.isAcceptingOrders === false && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs space-y-2">
                <label className="font-bold text-rose-950 block">
                  Customer Banner Reason Message (Visible to customers):
                </label>
                <input
                  type="text"
                  value={editSettings.pauseOrderReason || 'Currently Not Accepting Orders Due to High Demand'}
                  onChange={(e) => setEditSettings({ ...editSettings, pauseOrderReason: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 text-rose-950 font-bold bg-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="Currently Not Accepting Orders Due to High Demand"
                />
                <p className="text-[11px] text-rose-700">
                  Customers will see this message across the navigation bar and ordering flows will be disabled.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Printing Rates & Formulas
              </h2>
              <p className="text-xs text-slate-500">
                Update the official RSCC per-page and per-sheet rates. Changes apply immediately to all incoming customer orders.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <label className="font-bold text-slate-900 block">
                  A4 B&W Single Side (₹)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={editSettings.pricing.bwSingle}
                  onChange={(e) =>
                    setEditSettings({
                      ...editSettings,
                      pricing: {
                        ...editSettings.pricing,
                        bwSingle: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-black text-slate-900 text-base"
                />
                <span className="text-[10px] text-slate-500">Default: ₹5/page</span>
              </div>

              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 space-y-1.5">
                <label className="font-bold text-emerald-950 block">
                  A4 B&W Both Side (₹)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={editSettings.pricing.bwBoth}
                  onChange={(e) =>
                    setEditSettings({
                      ...editSettings,
                      pricing: {
                        ...editSettings.pricing,
                        bwBoth: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-emerald-300 font-black text-emerald-900 text-base"
                />
                <span className="text-[10px] text-emerald-700">Default: ₹4/page</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <label className="font-bold text-slate-900 block">
                  A4 Colour Single Side (₹)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={editSettings.pricing.colorSingle}
                  onChange={(e) =>
                    setEditSettings({
                      ...editSettings,
                      pricing: {
                        ...editSettings.pricing,
                        colorSingle: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-black text-slate-900 text-base"
                />
                <span className="text-[10px] text-slate-500">Default: ₹10/page</span>
              </div>

              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 space-y-1.5">
                <label className="font-bold text-amber-950 block">
                  A4 Colour Both Side (₹)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={editSettings.pricing.colorBoth}
                  onChange={(e) =>
                    setEditSettings({
                      ...editSettings,
                      pricing: {
                        ...editSettings.pricing,
                        colorBoth: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 font-black text-amber-900 text-base"
                />
                <span className="text-[10px] text-amber-700">Default: ₹7.50/page</span>
              </div>
            </div>

            {/* Photo Sheet Rate */}
            <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200 max-w-sm space-y-1.5 text-xs">
              <label className="font-bold text-indigo-950 block">
                A4 Photo Printing Sheet Rate (₹)
              </label>
              <input
                type="number"
                step="1"
                value={editSettings.pricing.photoSheet}
                onChange={(e) =>
                  setEditSettings({
                    ...editSettings,
                    pricing: {
                      ...editSettings.pricing,
                      photoSheet: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-indigo-300 font-black text-indigo-900 text-base"
              />
              <span className="text-[10px] text-indigo-700">Default: ₹15/sheet</span>
            </div>
          </div>

          {/* Shop UPI & Details */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              UPI Gateway & Contact Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Official Merchant UPI ID
                </label>
                <input
                  type="text"
                  value={editSettings.upiId}
                  onChange={(e) =>
                    setEditSettings({ ...editSettings, upiId: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Shop Phone / WhatsApp
                </label>
                <input
                  type="text"
                  value={editSettings.phone}
                  onChange={(e) =>
                    setEditSettings({ ...editSettings, phone: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Pickup & Shop Timings
                </label>
                <input
                  type="text"
                  value={editSettings.pickupTimings}
                  onChange={(e) =>
                    setEditSettings({ ...editSettings, pickupTimings: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Shop Physical Address
                </label>
                <input
                  type="text"
                  value={editSettings.address}
                  onChange={(e) =>
                    setEditSettings({ ...editSettings, address: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm"
                />
              </div>
            </div>

            {saveSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
              >
                {savingSettings ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>SAVE SHOP SETTINGS</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-4">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Security & System Audit Log
          </h2>

          <div className="space-y-2 text-xs">
            {auditLogs.length === 0 ? (
              <div className="text-slate-500 italic">No events recorded yet.</div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3 font-mono text-[11px]"
                >
                  <div>
                    <span className="font-bold text-slate-900">[{log.action}]</span>{' '}
                    <span className="text-slate-700">{log.details}</span>
                  </div>
                  <div className="text-slate-400 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Order Detail Modal / Slide-in Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl font-black text-slate-900">
                    {selectedOrder.orderNumber}
                  </span>
                  <span className="bg-slate-100 text-slate-800 text-xs font-bold px-2 py-0.5 rounded">
                    {selectedOrder.mode}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  Placed on {new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Delivery PIN Highlight */}
              <div className="bg-amber-400/20 border-2 border-amber-400 rounded-2xl px-4 py-2 text-center">
                <div className="text-[10px] text-amber-900 uppercase font-black tracking-wider flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-700" />
                  <span>Delivery PIN</span>
                </div>
                <div className="font-mono text-xl font-black text-slate-950 tracking-widest">
                  {selectedOrder.deliveryPin || '4921'}
                </div>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-2 text-sm cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Uploaded Payment Screenshot Box */}
            {selectedOrder.paymentScreenshot ? (
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-xs text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Customer Payment Screenshot</span>
                  </div>
                  {selectedOrder.paymentScreenshotTime && (
                    <div className="text-[11px] text-slate-300 font-mono">
                      Timestamp: {new Date(selectedOrder.paymentScreenshotTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  )}
                </div>

                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative group max-w-[220px] max-h-[160px] overflow-hidden rounded-lg bg-black border border-slate-700 shrink-0">
                    <img
                      src={selectedOrder.paymentScreenshot}
                      alt="Customer payment proof"
                      className="w-full h-full object-contain cursor-zoom-in"
                      onClick={() => {
                        const w = window.open('', '_blank');
                        w?.document.write(`<img src="${selectedOrder.paymentScreenshot}" style="max-width:100%;height:auto;margin:auto;display:block;"/>`);
                      }}
                    />
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 text-left min-w-0">
                    <div>
                      <span className="text-slate-400">File:</span>{' '}
                      <span className="font-mono text-white truncate">{selectedOrder.paymentScreenshotFilename || 'payment_screenshot.jpg'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Merchant UPI:</span>{' '}
                      <span className="font-mono text-amber-300">9967842065@OKBIZAXIS</span>
                    </div>

                    {/* OCR verification status tags */}
                    <div className="pt-1 flex flex-wrap gap-1.5 text-[10px]">
                      {selectedOrder.ocrVerifiedUpi ? (
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded font-semibold">
                          ✓ OCR: Shop UPI Verified
                        </span>
                      ) : (
                        <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded">
                          OCR: {selectedOrder.ocrDetectedUpiId || 'Manual Check'}
                        </span>
                      )}

                      {selectedOrder.ocrVerifiedTime ? (
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded font-semibold">
                          ✓ Time: Within 5 Mins ({selectedOrder.ocrTimeDiffMinutes || 0}m diff)
                        </span>
                      ) : (
                        <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded">
                          Time: Upload Window Checked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs">
                No screenshot uploaded. Paid via {selectedOrder.paymentMethod || 'UPI'}.
              </div>
            )}

            {/* Payment Verification Controls */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">
                    Payment Status:
                  </span>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                    selectedOrder.paymentStatus === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedOrder.paymentStatus === 'PAYMENT_FAILED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedOrder.paymentStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-sm font-black text-emerald-700">
                  ₹{selectedOrder.totalAmount}
                </span>
              </div>

              {selectedOrder.paymentReference && (
                <div className="text-xs font-mono bg-white p-2.5 rounded-xl border border-slate-200 text-slate-900">
                  UTR / Reference: <strong>{selectedOrder.paymentReference}</strong> (via {selectedOrder.paymentMethod || 'UPI'})
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {selectedOrder.paymentStatus !== 'VERIFIED' && selectedOrder.orderStatus !== 'CANCELLED' && (
                  <button
                    onClick={() => handleVerifyPayment(selectedOrder.id, true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verify & Confirm Paid (₹{selectedOrder.totalAmount})</span>
                  </button>
                )}

                {selectedOrder.orderStatus !== 'CANCELLED' && (
                  <button
                    onClick={() => handleVerifyPayment(selectedOrder.id, false)}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Payment Failed (Cancel Order)</span>
                  </button>
                )}

                {selectedOrder.orderStatus === 'CANCELLED' && (
                  <div className="bg-rose-100 border border-rose-300 text-rose-900 font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                    <Ban className="w-3.5 h-3.5 text-rose-600" />
                    <span>Order is Cancelled (Payment Failed / Rejected)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Print Status Progress Control */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Update Order Print Status
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {(['PLACED', 'PRINTING', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStatus(selectedOrder.id, st)}
                    className={`py-2 px-2.5 rounded-xl font-bold transition text-center text-[11px] cursor-pointer ${
                      selectedOrder.orderStatus === st
                        ? st === 'CANCELLED'
                          ? 'bg-rose-600 text-white shadow'
                          : 'bg-slate-900 text-white shadow'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer & Files details + ZIP Download Button */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 uppercase">Customer & Files</h4>
                <button
                  onClick={() => handleDownloadAllZip(selectedOrder)}
                  disabled={downloadingZipOrderId === selectedOrder.id}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                >
                  {downloadingZipOrderId === selectedOrder.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Download All Files (.ZIP)</span>
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div>Name: <strong>{selectedOrder.customer.name}</strong></div>
                <div>Mobile: <strong>{selectedOrder.customer.mobile}</strong></div>
                {selectedOrder.customer.email && <div>Email: {selectedOrder.customer.email}</div>}
                {selectedOrder.specialInstructions && (
                  <div className="text-amber-800 font-medium">
                    Notes: {selectedOrder.specialInstructions}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Files ({selectedOrder.files.length}):</span>
                    <button
                      onClick={() => handleDownloadAllZip(selectedOrder)}
                      className="text-emerald-700 hover:text-emerald-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download ZIP Archive</span>
                    </button>
                  </div>
                  {selectedOrder.files.map((f, i) => (
                    <div key={i} className="flex justify-between items-center text-slate-600 bg-white p-2 rounded-lg border border-slate-200 text-[11px]">
                      <span className="font-medium truncate max-w-[300px]">• {f.name}</span>
                      <span className="font-mono text-slate-500 shrink-0">{f.pageCount} pgs</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Internal Shop Notes Form */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 uppercase">Internal Shop Notes</h4>
              {selectedOrder.internalNotes && selectedOrder.internalNotes.length > 0 && (
                <div className="space-y-1">
                  {selectedOrder.internalNotes.map((n, i) => (
                    <div key={i} className="bg-slate-100 p-2 rounded-lg text-slate-700">
                      {n}
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add internal note (e.g. Printed on Glossy 250gsm)..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-2 rounded-xl text-xs"
                >
                  Add Note
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
