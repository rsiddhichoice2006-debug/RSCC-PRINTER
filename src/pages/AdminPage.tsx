import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import {
  ShieldCheck,
  Lock,
  Search,
  Filter,
  DollarSign,
  IndianRupee,
  Tag,
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
  Trash2,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  X,
  Send,
  ExternalLink,
} from 'lucide-react';
import { AdminStats, OrderRecord, ShopSettings, SerializableFileItem } from '../types';
import { apiClient } from '../services/apiClient';
import { notifyCustomerOrderReady, formatPickupReadyWhatsAppMessage, generateWhatsAppUrl } from '../services/whatsappService';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

// Web Audio API Multi-Tone Chime for New Order Notification
const playOrderChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // Rich 4-Note Order Alert Chime (C5, E5, G5, C6 Arpeggio)
    const notes = [
      { freq: 523.25, time: now, duration: 0.2, vol: 0.4 },
      { freq: 659.25, time: now + 0.12, duration: 0.2, vol: 0.4 },
      { freq: 783.99, time: now + 0.24, duration: 0.25, vol: 0.45 },
      { freq: 1046.5, time: now + 0.38, duration: 0.5, vol: 0.5 },
    ];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, note.time);

      gain.gain.setValueAtTime(0.001, note.time);
      gain.gain.exponentialRampToValueAtTime(note.vol, note.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, note.time + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(note.time);
      osc.stop(note.time + note.duration);
    });
  } catch (e) {
    console.warn('Audio chime warning:', e);
  }
};

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
  const { currentUser, signInWithGoogle } = useAuth();

  // Auto grant access if signed in as authorized admin email
  useEffect(() => {
    if (currentUser?.email?.toLowerCase() === 'rsiddhi.choice.2006@gmail.com') {
      if (!isAdminLoggedIn) {
        onAdminLoginSuccess();
      }
    }
  }, [currentUser, isAdminLoggedIn, onAdminLoginSuccess]);

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Admin Dashboard State
  const [activeTab, setActiveTab] = useState<'orders' | 'prices' | 'settings' | 'audit'>('orders');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [downloadingZipOrderId, setDownloadingZipOrderId] = useState<string | null>(null);

  // Sound & Live Notifications
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('rscc_admin_sound') !== 'false';
  });
  const [newOrderAlerts, setNewOrderAlerts] = useState<OrderRecord[]>([]);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialSnapshotRef = useRef<boolean>(true);

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
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<OrderRecord | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [whatsAppModalOrder, setWhatsAppModalOrder] = useState<{
    order: OrderRecord;
    message: string;
    url: string;
  } | null>(null);

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    setWebhookTestResult(null);
    try {
      const res = await apiClient.testWebhook(editSettings.webhookUrl);
      setWebhookTestResult(res);
      if (res.success) {
        showToast('✅ Webhook test payload sent successfully to Make.com!');
      } else {
        showToast('⚠️ Webhook response: ' + res.message);
      }
    } catch (err: any) {
      setWebhookTestResult({ success: false, message: err?.message || 'Error triggering test' });
      showToast('❌ Webhook test failed: ' + (err?.message || 'Network error'));
    } finally {
      setTestingWebhook(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 4000);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('rscc_admin_sound', String(next));
    if (next) {
      playOrderChime();
      showToast('Notification Sound Enabled 🔔');
    } else {
      showToast('Notification Sound Muted 🔕');
    }
  };

  const dismissAlert = (orderId: string) => {
    setNewOrderAlerts((prev) => prev.filter((o) => o.id !== orderId));
  };

  useEffect(() => {
    setEditSettings(settings);
  }, [settings]);

  // Real-time Multi-Device Snapshot & Backend Listener for Live Order Notifications
  useEffect(() => {
    if (!isAdminLoggedIn) return;

    loadDashboardData();

    // Attach dual-engine real-time subscription (Firestore + Server Backend Heartbeat)
    const unsubscribe = apiClient.subscribeOrders((fetchedOrders) => {
      const freshlyAdded: OrderRecord[] = [];

      fetchedOrders.forEach((data) => {
        if (!isInitialSnapshotRef.current && !knownOrderIdsRef.current.has(data.id)) {
          freshlyAdded.push(data);
        }
      });

      // Update state with sorted orders
      setOrders(fetchedOrders);

      // If new orders detected from any device
      if (!isInitialSnapshotRef.current && freshlyAdded.length > 0) {
        freshlyAdded.forEach((newOrd) => {
          knownOrderIdsRef.current.add(newOrd.id);
        });

        if (soundEnabled) {
          playOrderChime();
        }

        setNewOrderAlerts((prev) => [...freshlyAdded, ...prev].slice(0, 5));
        showToast(`🔔 ${freshlyAdded.length} New Order(s) Received!`);
      } else if (isInitialSnapshotRef.current) {
        fetchedOrders.forEach((o) => knownOrderIdsRef.current.add(o.id));
        isInitialSnapshotRef.current = false;
      }
    });

    // Secondary fallback sync timer for stats & audit logs
    const syncTimer = setInterval(() => {
      apiClient
        .getAdminStats()
        .then((statsData) => {
          if (statsData?.stats) setStats(statsData.stats);
          if (statsData?.recentAuditLogs) setAuditLogs(statsData.recentAuditLogs);
        })
        .catch(() => {});
    }, 4000);

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(syncTimer);
    };
  }, [isAdminLoggedIn, soundEnabled]);

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

  const handleDeleteOrder = (order: OrderRecord) => {
    setOrderToDelete(order);
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    const order = orderToDelete;
    setDeletingOrderId(order.id);
    try {
      await apiClient.deleteOrder(order.id);
      setOrders((prev) => prev.filter((o) => o.id !== order.id && o.orderNumber !== order.orderNumber));
      if (selectedOrder && (selectedOrder.id === order.id || selectedOrder.orderNumber === order.orderNumber)) {
        setSelectedOrder(null);
      }
      setOrderToDelete(null);
      showToast(`Order #${order.orderNumber} deleted successfully.`);
      loadDashboardData();
    } catch (err: any) {
      console.error('Failed to delete order:', err);
      showToast('Failed to delete order: ' + (err?.message || 'Error occurred'));
    } finally {
      setDeletingOrderId(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    // Check specific admin credentials requested
    if (
      cleanEmail === 'rsiddhi.choice.2006@gmail.com' &&
      (cleanPass === 'RSIDDHI2006' || cleanPass === 'rsiddhi2006')
    ) {
      onAdminLoginSuccess();
      loadDashboardData();
      setLoginLoading(false);
      return;
    }

    try {
      await apiClient.adminLogin(email.trim(), password.trim());
      onAdminLoginSuccess();
      loadDashboardData();
    } catch (err: any) {
      if (cleanEmail === 'rsiddhi.choice.2006@gmail.com' && (cleanPass === 'RSIDDHI2006' || cleanPass === 'rsiddhi2006')) {
        onAdminLoginSuccess();
        loadDashboardData();
      } else {
        setLoginError('Access denied. Please log in with rsiddhi.choice.2006@gmail.com and password RSIDDHI2006.');
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

  /**
   * Safely converts any data URL, blob URL, HTTP URL, base64 string, or text into a binary Uint8Array or string for JSZip
   */
  const resolveFileBinary = async (
    urlOrContent?: string
  ): Promise<{ data: Uint8Array | string; isBinary: boolean } | null> => {
    if (!urlOrContent || typeof urlOrContent !== 'string') return null;

    // Strategy 1: Browser fetch (handles data: URIs, blob: URIs, http(s) URLs natively)
    if (
      urlOrContent.startsWith('data:') ||
      urlOrContent.startsWith('blob:') ||
      urlOrContent.startsWith('http://') ||
      urlOrContent.startsWith('https://')
    ) {
      try {
        const response = await fetch(urlOrContent);
        if (response.ok) {
          const arrayBuf = await response.arrayBuffer();
          return { data: new Uint8Array(arrayBuf), isBinary: true };
        }
      } catch {
        // Continue to fallback decoders
      }
    }

    // Strategy 2: Manual Data URI parsing
    if (urlOrContent.startsWith('data:')) {
      try {
        const commaIdx = urlOrContent.indexOf(',');
        if (commaIdx !== -1) {
          const metadata = urlOrContent.substring(0, commaIdx);
          const rawBody = urlOrContent.substring(commaIdx + 1);

          if (metadata.includes(';base64')) {
            let cleanB64 = rawBody.replace(/[^A-Za-z0-9+/=]/g, '');
            const mod = cleanB64.length % 4;
            if (mod === 2) cleanB64 += '==';
            else if (mod === 3) cleanB64 += '=';
            else if (mod === 1) cleanB64 = cleanB64.slice(0, -1);

            const binaryString = atob(cleanB64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            return { data: bytes, isBinary: true };
          } else {
            const decoded = decodeURIComponent(rawBody);
            return { data: decoded, isBinary: false };
          }
        }
      } catch (err) {
        console.warn('Data URI decode error:', err);
      }
    }

    // Strategy 3: Raw base64 string
    try {
      let cleanB64 = urlOrContent.replace(/[^A-Za-z0-9+/=]/g, '');
      if (cleanB64.length >= 8) {
        const mod = cleanB64.length % 4;
        if (mod === 2) cleanB64 += '==';
        else if (mod === 3) cleanB64 += '=';
        else if (mod === 1) cleanB64 = cleanB64.slice(0, -1);

        const binaryString = atob(cleanB64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return { data: bytes, isBinary: true };
      }
    } catch {
      // Ignore
    }

    return null;
  };

  const handleDownloadSingleFile = async (file: SerializableFileItem, orderNumber: string) => {
    if (!file.previewUrl) {
      showToast(`File "${file.name}" has no preview URL attached.`);
      return;
    }

    try {
      const resolved = await resolveFileBinary(file.previewUrl);
      if (resolved && resolved.isBinary && resolved.data instanceof Uint8Array) {
        const mimeType = file.type || 'application/octet-stream';
        const blob = new Blob([resolved.data], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = file.name || `Order_${orderNumber}_file`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 3000);
        showToast(`Downloading "${file.name}"...`);
        return;
      }

      const link = document.createElement('a');
      link.href = file.previewUrl;
      link.download = file.name || `Order_${orderNumber}_file`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 500);
      showToast(`Downloading "${file.name}"...`);
    } catch {
      window.open(file.previewUrl, '_blank');
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
Service Mode   : ${order.mode === 'PHOTO' ? 'A4 Photo Printing' : order.mode === 'PASSPORT_PHOTO' ? 'Passport Photos' : 'Document Printing'}

CUSTOMER DETAILS:
Name           : ${order.customer.name}
Mobile         : ${order.customer.mobile}
Email          : ${order.customer.email || 'N/A'}
Special Notes  : ${order.specialInstructions || 'None'}

PRINT SPECIFICATIONS:
Print Type     : ${order.printType}
Printing Side  : ${order.printingSide}
Copies         : ${order.copies}
Total Sheets   : ${order.totalSheets || order.totalPages}
Rate Per Page  : ₹${order.ratePerPage}
Total Amount   : ₹${order.totalAmount}
Payment Status : ${order.paymentStatus}
Order Status   : ${order.orderStatus}
Payment Ref    : ${order.paymentReference || 'N/A'}

=====================================================
FILES LIST (${order.files.length} Total):
${order.files.map((f, i) => `${i + 1}. ${f.name} (Pages: ${f.pageCount}, Size: ${(f.size / 1024).toFixed(1)} KB)`).join('\n')}
=====================================================
`;
      zip.file('00_ORDER_SUMMARY.txt', summaryText);

      // 2. Add each file into the zip
      for (let i = 0; i < order.files.length; i++) {
        const file = order.files[i];
        const safeName = (file.name || `file_${i + 1}`).replace(/[/\\?%*:|"<>]/g, '_');
        const filename = `${String(i + 1).padStart(2, '0')}_${safeName}`;

        let added = false;
        if (file.previewUrl) {
          const resolved = await resolveFileBinary(file.previewUrl);
          if (resolved) {
            zip.file(filename, resolved.data);
            added = true;
          }
        }

        if (!added) {
          // Add informative text placeholder if binary data is not available
          zip.file(
            filename.endsWith('.pdf') || filename.endsWith('.jpg') || filename.endsWith('.png')
              ? `${filename}.info.txt`
              : `${filename}.txt`,
            `File Name: ${file.name}\nPage Count: ${file.pageCount}\nSize: ${file.size} bytes\nOrder: ${order.orderNumber}\nPrint Type: ${order.printType}\nStatus: Customer uploaded at counter`
          );
        }
      }

      // 3. Add Payment Proof Screenshot if attached
      if (order.paymentScreenshot) {
        const resolvedScreenshot = await resolveFileBinary(order.paymentScreenshot);
        if (resolvedScreenshot) {
          const screenshotName = `PAYMENT_PROOF_${(order.paymentScreenshotFilename || 'screenshot.jpg').replace(/[/\\?%*:|"<>]/g, '_')}`;
          zip.file(screenshotName, resolvedScreenshot.data);
        }
      }

      // 4. Generate ZIP & Trigger download reliably
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      const cleanCustomerName = (order.customer.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
      const zipFilename = `RSCC_${order.orderNumber}_${cleanCustomerName}_Files.zip`;

      try {
        const downloadUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        a.setAttribute('download', zipFilename);
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
          URL.revokeObjectURL(downloadUrl);
        }, 3000);
      } catch (blobErr) {
        const zipBase64 = await zip.generateAsync({ type: 'base64' });
        const dataUrl = `data:application/zip;base64,${zipBase64}`;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = zipFilename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) document.body.removeChild(a);
        }, 3000);
      }

      showToast(`ZIP downloaded for Order #${order.orderNumber} ✅`);
    } catch (err: any) {
      console.error('Failed to create ZIP download:', err);
      showToast('Failed to generate ZIP archive: ' + (err.message || 'Unknown error'));
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

      // AUTOMATIC WHATSAPP NOTIFICATION TRIGGER WHEN READY FOR PICKUP IS MARKED
      if (status === 'READY_FOR_PICKUP') {
        const cleanMobile = updated.customer?.mobile?.replace(/\D/g, '').slice(-10) || '';
        const message = formatPickupReadyWhatsAppMessage(updated, settings);
        const url = generateWhatsAppUrl(cleanMobile, message);

        // Check if automatic direct dispatch is enabled (default: true)
        const autoNotify = settings.autoNotifyReadyWhatsApp !== false;

        let opened = false;
        if (autoNotify && cleanMobile.length >= 10) {
          try {
            const win = window.open(url, '_blank');
            if (win) {
              opened = true;
            }
          } catch (e) {
            console.warn('Window open restricted:', e);
          }
        }

        if (opened) {
          showToast(`📲 Order #${updated.orderNumber} marked Ready! Opening WhatsApp message for +91 ${cleanMobile}...`);
        } else {
          showToast(`🎉 Order #${updated.orderNumber} marked Ready for Pickup!`);
        }

        // Show prompt / preview modal so staff can also send or re-send with 1 click
        setWhatsAppModalOrder({
          order: updated,
          message,
          url,
        });
      } else {
        showToast(`Order #${updated.orderNumber} status updated to ${status.replace(/_/g, ' ')}`);
      }
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleManualSendWhatsApp = (order: OrderRecord) => {
    const cleanMobile = order.customer?.mobile?.replace(/\D/g, '').slice(-10) || '';
    if (!cleanMobile || cleanMobile.length < 10) {
      alert(`Customer mobile number "${order.customer.mobile}" is invalid.`);
      return;
    }
    const message = formatPickupReadyWhatsAppMessage(order, settings);
    const url = generateWhatsAppUrl(cleanMobile, message);
    setWhatsAppModalOrder({
      order,
      message,
      url,
    });
    window.open(url, '_blank');
    showToast(`WhatsApp message opened for +91 ${cleanMobile}!`);
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
      setSaveSuccessMsg('Prices and settings saved to cloud! Synced in real-time to all devices.');
      showToast('✅ Prices & settings saved and synced across all devices!');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
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
        pauseOrderReason: editSettings.pauseOrderReason || 'Currently Not Accepting Orders Due to High Demand',
      };
      setEditSettings(updatedSettings);
      const saved = await apiClient.updateSettings(updatedSettings);
      onUpdateSettings(saved);
      showToast(
        accepting
          ? '✅ Store OPEN: Now accepting incoming customer orders.'
          : '⛔ Store PAUSED: "Do Not Accept Orders" activated & synced across all customer devices.'
      );
    } catch (err: any) {
      alert('Error updating order status: ' + err.message);
    }
  };

  // Filtered orders list
  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      o.orderNumber?.toLowerCase().includes(q) ||
      o.customer?.name?.toLowerCase().includes(q) ||
      o.customer?.mobile?.includes(q) ||
      o.deliveryPin?.includes(q) ||
      o.paymentReference?.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'ALL' ||
      o.orderStatus === statusFilter ||
      (statusFilter === 'PLACED' && (o.orderStatus === 'CONFIRMED' || o.orderStatus === 'PLACED' || o.orderStatus === 'PENDING')) ||
      (statusFilter === 'CONFIRMED' && (o.orderStatus === 'CONFIRMED' || o.orderStatus === 'PLACED'));

    const matchesPayment =
      paymentFilter === 'ALL' ||
      o.paymentStatus === paymentFilter ||
      (paymentFilter === 'PAYMENT_VERIFIED' && (o.paymentStatus === 'PAYMENT_VERIFIED' || o.paymentStatus === 'VERIFIED')) ||
      (paymentFilter === 'VERIFIED' && (o.paymentStatus === 'PAYMENT_VERIFIED' || o.paymentStatus === 'VERIFIED')) ||
      (paymentFilter === 'PAYMENT_VERIFICATION_REQUIRED' &&
        (o.paymentStatus === 'PAYMENT_VERIFICATION_REQUIRED' || o.paymentStatus === 'PAYMENT_PENDING')) ||
      (paymentFilter === 'PAYMENT_PENDING' &&
        (o.paymentStatus === 'PAYMENT_PENDING' || o.paymentStatus === 'PAYMENT_VERIFICATION_REQUIRED')) ||
      (paymentFilter === 'PAYMENT_FAILED' && o.paymentStatus === 'PAYMENT_FAILED');

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
              RSCC Shop Admin Portal
            </h1>
            <p className="text-xs text-slate-500">
              Access restricted to authorized shop account (rsiddhi.choice.2006@gmail.com).
            </p>
          </div>

          {/* Quick Google Sign In for Admin */}
          <button
            type="button"
            onClick={async () => {
              try {
                await signInWithGoogle();
              } catch (e) {
                console.warn('Google admin sign-in error:', e);
              }
            }}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs py-3 px-4 rounded-xl border border-slate-300 shadow-xs flex items-center justify-center gap-2.5 transition cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign In with Google (rsiddhi.choice.2006@gmail.com)</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-slate-200"></div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Or Admin Email & Password</span>
            <div className="flex-1 border-t border-slate-200"></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Admin Email Address</label>
              <input
                type="email"
                required
                placeholder="rsiddhi.choice.2006@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700">Admin Password</label>
              <input
                type="password"
                required
                placeholder="Enter password (RSIDDHI2006)"
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleSound}
              title={soundEnabled ? 'Click to Mute New Order Chime' : 'Click to Enable New Order Chime'}
              className={`text-xs font-bold px-3 py-2 rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
                soundEnabled
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-slate-950" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              <span>{soundEnabled ? 'Live Chime ON' : 'Live Chime OFF'}</span>
            </button>

            <button
              onClick={() => {
                playOrderChime();
                showToast('🔔 Played test order chime!');
              }}
              title="Test notification chime sound"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-2.5 py-2 rounded-xl border border-slate-700 transition flex items-center gap-1 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Test Sound</span>
            </button>

            <button
              onClick={loadDashboardData}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Real-time Order Alerts Popup/Banner */}
        {newOrderAlerts.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 p-4 rounded-2xl shadow-xl border-2 border-amber-300 animate-in slide-in-from-top-2 duration-300 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wide">
                <BellRing className="w-5 h-5 animate-bounce text-slate-950" />
                <span>Real-Time Alert: {newOrderAlerts.length} New Order(s) Received</span>
              </div>
              <button
                onClick={() => setNewOrderAlerts([])}
                className="text-xs font-bold bg-slate-950/20 hover:bg-slate-950/40 text-slate-950 px-2 py-1 rounded-lg transition cursor-pointer"
              >
                Clear All
              </button>
            </div>

            <div className="space-y-2 pt-1">
              {newOrderAlerts.map((alertOrder) => (
                <div
                  key={alertOrder.id}
                  className="bg-white/95 backdrop-blur-xs p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs border border-amber-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm">
                        Order #{alertOrder.orderNumber} • ₹{alertOrder.totalAmount}
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        Customer: <span className="font-bold text-slate-900">{alertOrder.customer.name}</span> ({alertOrder.customer.mobile}) • {alertOrder.mode}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedOrder(alertOrder);
                        setActiveTab('orders');
                        dismissAlert(alertOrder.id);
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs px-3 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Order</span>
                    </button>
                    <button
                      onClick={() => dismissAlert(alertOrder.id)}
                      className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Active Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('prices')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'prices'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <IndianRupee className="w-4 h-4" />
          <span>Edit Prices & Rates</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Shop & UPI Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
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
                <option value="PLACED">Placed / Confirmed</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PRINTING">Printing</option>
                <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
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
                <option value="PAYMENT_VERIFIED">Paid & Verified</option>
                <option value="PAYMENT_VERIFICATION_REQUIRED">Screenshot Verification</option>
                <option value="PAYMENT_PENDING">Pending</option>
                <option value="PAYMENT_FAILED">Payment Failed</option>
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
                    <th className="py-3.5 px-4">Payment & Proof</th>
                    <th className="py-3.5 px-4">Print Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                        No orders matching the current filter.
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
                            {ord.paymentStatus === 'VERIFIED' || ord.paymentStatus === 'PAYMENT_VERIFIED' ? (
                              <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Paid & Verified
                              </span>
                            ) : ord.paymentStatus === 'PAYMENT_VERIFICATION_REQUIRED' ? (
                              <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1 animate-pulse">
                                <Clock className="w-3 h-3 text-amber-700" />
                                Verify Screenshot
                              </span>
                            ) : ord.paymentStatus === 'PAYMENT_FAILED' ? (
                              <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                                Payment Failed
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-full text-[10px]">
                                Pending Payment
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
                            {ord.orderStatus !== 'READY_FOR_PICKUP' && ord.orderStatus !== 'COMPLETED' && ord.orderStatus !== 'CANCELLED' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(ord.id, 'READY_FOR_PICKUP');
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-sm"
                                title="Mark as Ready & send WhatsApp notification"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Mark Ready</span>
                              </button>
                            )}

                            {ord.orderStatus === 'READY_FOR_PICKUP' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleManualSendWhatsApp(ord);
                                }}
                                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 font-extrabold text-[11px] px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                                title="Resend WhatsApp pickup alert to customer"
                              >
                                <Send className="w-3.5 h-3.5 text-emerald-700" />
                                <span>WhatsApp</span>
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadAllZip(ord);
                              }}
                              disabled={downloadingZipOrderId === ord.id}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
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

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOrder(ord);
                              }}
                              disabled={deletingOrderId === ord.id}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-200 hover:border-rose-400 font-bold text-[11px] px-2 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title={`Delete order #${ord.orderNumber}`}
                            >
                              {deletingOrderId === ord.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              )}
                              <span className="hidden sm:inline">Delete</span>
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

      {/* TAB 2: EDIT PRICES & RATES (DEDICATED PRICING TAB) */}
      {activeTab === 'prices' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    RSCC Pricing Matrix & Rate Editor
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Configure real-time per-page rates for A4/A3 formats, paper weights (75 GSM & 100 GSM), single/both sides, and passport services. Changes take effect immediately across all customer devices.
                </p>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow transition flex items-center gap-2 cursor-pointer shrink-0"
              >
                {savingSettings ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>SAVE ALL RATES</span>
                  </>
                )}
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Section 1: A4 Document Printing Rates */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-xs font-black">A4</span>
                  <span>A4 Paper Document Printing Rates</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Standard A4 page rates by print color and paper quality (75 GSM / 100 GSM).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {/* A4 B&W 75 GSM */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>B&W • 75 GSM</span>
                  <span className="text-[10px] text-slate-500 font-normal">Economy B&W</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Single Side Rate (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.a4Bw75Single ?? editSettings.pricing.bwSingle ?? 5}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            a4Bw75Single: parseFloat(e.target.value) || 0,
                            bwSingle: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-black text-slate-900 text-base"
                    />
                    <span className="text-[10px] text-slate-400">Default: ₹5/page</span>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Both Side Rate (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.a4Bw75Both ?? editSettings.pricing.bwBoth ?? 4}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            a4Bw75Both: parseFloat(e.target.value) || 0,
                            bwBoth: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-black text-slate-900 text-base"
                    />
                    <span className="text-[10px] text-slate-400">Default: ₹4/page</span>
                  </div>
                </div>
              </div>

              {/* A4 B&W 100 GSM */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>B&W • 100 GSM</span>
                  <span className="text-[10px] text-slate-500 font-normal">Heavy Premium B&W</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Single Side Rate (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.a4Bw100Single ?? 7}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            a4Bw100Single: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-black text-slate-900 text-base"
                    />
                    <span className="text-[10px] text-slate-400">Default: ₹7/page</span>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Both Side Rate (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.a4Bw100Both ?? 12}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            a4Bw100Both: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-black text-slate-900 text-base"
                    />
                    <span className="text-[10px] text-slate-400">Default: ₹12/page</span>
                  </div>
                </div>
              </div>

              {/* A4 Colour 100 GSM */}
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 space-y-3">
                <div className="font-bold text-amber-950 border-b border-amber-200 pb-1 flex items-center justify-between">
                  <span>Colour • 100 GSM</span>
                  <span className="text-[10px] text-amber-700 font-normal">Standard Colour</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-amber-900 font-semibold mb-1">
                      Single Side Rate (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.a4Color100Single ?? editSettings.pricing.colorSingle ?? 10}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            a4Color100Single: parseFloat(e.target.value) || 0,
                            colorSingle: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 font-black text-amber-950 text-base"
                    />
                    <span className="text-[10px] text-amber-700">Default: ₹10/page</span>
                  </div>
                  <div>
                    <label className="block text-amber-900 font-semibold mb-1">
                      Both Side Rate (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.a4Color100Both ?? editSettings.pricing.colorBoth ?? 15}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            a4Color100Both: parseFloat(e.target.value) || 0,
                            colorBoth: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 font-black text-amber-950 text-base"
                    />
                    <span className="text-[10px] text-amber-700">Default: ₹15/page</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: A3 Document Printing Rates */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 text-xs font-black">A3</span>
                  <span>A3 Large Paper Document Printing Rates</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Large ledger A3 page rates by print color and paper quality (75 GSM / 100 GSM).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {/* A3 B&W 75 GSM */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>B&W • 75 GSM</span>
                  <span className="text-[10px] text-slate-500 font-normal">Economy Large B&W</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Single Side Rate (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.a3Bw75Single ?? 10}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            a3Bw75Single: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-black text-slate-900 text-base"
                    />
                    <span className="text-[10px] text-slate-400">Default: ₹10/page</span>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Both Side Rate (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.a3Bw75Both ?? 20}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            a3Bw75Both: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-black text-slate-900 text-base"
                    />
                    <span className="text-[10px] text-slate-400">Default: ₹20/page</span>
                  </div>
                </div>
              </div>

              {/* A3 B&W 100 GSM */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>B&W • 100 GSM</span>
                  <span className="text-[10px] text-slate-500 font-normal">Heavy Ledger B&W</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Single Side Rate (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.a3Bw100Single ?? 15}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            a3Bw100Single: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-black text-slate-900 text-base"
                    />
                    <span className="text-[10px] text-slate-400">Default: ₹15/page</span>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Both Side Rate (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.a3Bw100Both ?? 25}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            a3Bw100Both: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-black text-slate-900 text-base"
                    />
                    <span className="text-[10px] text-slate-400">Default: ₹25/page</span>
                  </div>
                </div>
              </div>

              {/* A3 Colour 100 GSM */}
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 space-y-3">
                <div className="font-bold text-amber-950 border-b border-amber-200 pb-1 flex items-center justify-between">
                  <span>Colour • 100 GSM</span>
                  <span className="text-[10px] text-amber-700 font-normal">A3 Vivid Colour</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-amber-900 font-semibold mb-1">
                      Single Side Rate (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.a3Color100Single ?? 20}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            a3Color100Single: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 font-black text-amber-950 text-base"
                    />
                    <span className="text-[10px] text-amber-700">Default: ₹20/page</span>
                  </div>
                  <div>
                    <label className="block text-amber-900 font-semibold mb-1">
                      Both Side Rate (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.a3Color100Both ?? 35}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            a3Color100Both: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 font-black text-amber-950 text-base"
                    />
                    <span className="text-[10px] text-amber-700">Default: ₹35/page</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Passport Photo Services & Photo Sheet Rates */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-xs font-black">PHOTO</span>
                <span>Passport Size Photos & Studio Photo Sheets</span>
              </h3>
              <p className="text-xs text-slate-500">
                Official fixed package rates for Passport Size studio prints and custom A4 photo sheets.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Standard Passport Size */}
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 space-y-2">
                <label className="font-bold text-emerald-950 block">
                  Standard Passport (8 Photos) Rate (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  value={editSettings.pricing.passportStandard ?? 50}
                  onChange={(e) =>
                    setEditSettings({
                      ...editSettings,
                      pricing: {
                        ...editSettings.pricing,
                        passportStandard: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-emerald-300 font-black text-emerald-900 text-base"
                />
                <span className="text-[10px] text-emerald-700">Default: ₹50 for 8 photos (3.5 × 4.5 cm)</span>
              </div>

              {/* Mixed Size Photos */}
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 space-y-2">
                <label className="font-bold text-emerald-950 block">
                  Mixed Size (8 Pass + 8 Stamp) Rate (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  value={editSettings.pricing.passportMixed ?? 60}
                  onChange={(e) =>
                    setEditSettings({
                      ...editSettings,
                      pricing: {
                        ...editSettings.pricing,
                        passportMixed: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-emerald-300 font-black text-emerald-900 text-base"
                />
                <span className="text-[10px] text-emerald-700">Default: ₹60 for 16 photos total</span>
              </div>

              {/* Photo Sheet Rate */}
              <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200 space-y-2">
                <label className="font-bold text-indigo-950 block">
                  A4 Glossy Photo Sheet Rate (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  value={editSettings.pricing.photoSheet ?? 15}
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
                <span className="text-[10px] text-indigo-700">Default: ₹15 per photo sheet</span>
              </div>
            </div>

            {/* Bottom Save Action */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Changes will instantly update pricing calculations on customer upload forms.
              </span>
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
                    <span>SAVE ALL PRICES</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: SHOP & UPI SETTINGS */}
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
                  onClick={() => handleToggleAcceptingOrders(true)}
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
                  onClick={() => handleToggleAcceptingOrders(false)}
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

            {/* Shop WhatsApp & Automation Card */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-sm">
                    💬
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      Automated WhatsApp Pickup Notifications
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Active
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      When staff marks an order as "Ready for Pickup", an automated notification with collection PIN and pickup address is instantly dispatched.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Auto-trigger WhatsApp to Customer on Ready
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Automatically opens and formats the WhatsApp pickup notification when staff clicks "READY / PICKUP".
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editSettings.autoNotifyReadyWhatsApp !== false}
                      onChange={(e) =>
                        setEditSettings({ ...editSettings, autoNotifyReadyWhatsApp: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Official Shop Dispatch Number (WhatsApp Business)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editSettings.whatsAppSenderPhone || '8652411690'}
                      onChange={(e) =>
                        setEditSettings({ ...editSettings, whatsAppSenderPhone: e.target.value.trim() })
                      }
                      placeholder="8652411690"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 font-mono font-bold text-emerald-950 bg-white text-sm focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    All customer ready messages and Make.com notifications will reference this number (+91 {editSettings.whatsAppSenderPhone || '8652411690'}) as the official sender and pickup support contact.
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                  <span className="font-bold text-slate-900">WhatsApp Notification Template Includes:</span>
                  <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                    <li>Customer name & Order Number</li>
                    <li>Unique 4-digit Collection/Pickup PIN</li>
                    <li>Verified payment amount and print items summary</li>
                    <li>Counter address ({editSettings.address || 'Shop No. 4, Ground Floor, RSCC'})</li>
                    <li>Store hours ({editSettings.pickupTimings || '9:00 AM - 9:00 PM'})</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Make.com Webhook Automation & Real-time Sync */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-sm">
                    ⚡
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      Make.com Webhook Integration & Multi-Device Sync
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Live Active
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Every order placed on ANY mobile or desktop device is automatically dispatched to this endpoint and synced via Firestore.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="font-bold text-slate-700 text-xs block mb-1">
                    Make.com Webhook Endpoint URL
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={editSettings.webhookUrl || 'https://hook.eu1.make.com/8pf2rw2l0pk9va2ofhqjjsg0cap9kutr'}
                      onChange={(e) =>
                        setEditSettings({ ...editSettings, webhookUrl: e.target.value })
                      }
                      placeholder="https://hook.eu1.make.com/..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleTestWebhook}
                      disabled={testingWebhook}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {testingWebhook ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing Webhook...</span>
                        </>
                      ) : (
                        <>
                          <span>⚡ Test Webhook</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {webhookTestResult && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      webhookTestResult.success
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border border-amber-200 text-amber-800'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{webhookTestResult.message}</span>
                  </div>
                )}
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
                      <span className="font-mono text-amber-300">{settings.upiId || '8652411690@OKBIZAXIS'}</span>
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
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Update Order Print Status
                </label>
                <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                  <span>📲 Auto-WhatsApp on Ready</span>
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {(['PLACED', 'PRINTING', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStatus(selectedOrder.id, st)}
                    className={`py-2 px-2.5 rounded-xl font-bold transition text-center text-[11px] cursor-pointer ${
                      selectedOrder.orderStatus === st
                        ? st === 'CANCELLED'
                          ? 'bg-rose-600 text-white shadow'
                          : st === 'READY_FOR_PICKUP'
                          ? 'bg-emerald-600 text-white shadow ring-2 ring-emerald-400'
                          : 'bg-slate-900 text-white shadow'
                        : st === 'READY_FOR_PICKUP'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 font-extrabold'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {st === 'READY_FOR_PICKUP' ? 'READY / PICKUP ✨' : st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              {/* Dedicated Customer WhatsApp Notification Bar */}
              <div className="mt-3 p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-emerald-700" />
                    <span>WhatsApp Customer Pickup Notification</span>
                  </div>
                  <div className="text-[11px] text-emerald-800 mt-0.5">
                    Customer: <strong>{selectedOrder.customer.name}</strong> • Mobile: <strong>+91 {selectedOrder.customer.mobile}</strong> • PIN: <strong>{selectedOrder.deliveryPin || '4921'}</strong>
                  </div>
                  {selectedOrder.whatsappNotifiedAt && (
                    <div className="text-[10px] text-emerald-700 mt-0.5">
                      ✓ Last notified: {new Date(selectedOrder.whatsappNotifiedAt).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleManualSendWhatsApp(selectedOrder)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send WhatsApp Now</span>
                  </button>
                </div>
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
                    <div key={i} className="flex justify-between items-center text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 text-xs gap-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-slate-100 text-slate-700 font-mono font-bold flex items-center justify-center text-[10px] shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-slate-900 truncate max-w-[220px] sm:max-w-[280px]">
                          {f.name}
                        </span>
                        <span className="font-mono text-slate-400 text-[11px] shrink-0">
                          ({f.pageCount} pgs • {(f.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {f.previewUrl && (
                          <button
                            type="button"
                            onClick={() => handleDownloadSingleFile(f, selectedOrder.orderNumber)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 transition flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                            title="Download this file directly"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Download</span>
                          </button>
                        )}
                      </div>
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
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Add Note
                </button>
              </form>
            </div>

            {/* Danger Zone: Delete Order */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Remove this order record from system</span>
              <button
                type="button"
                onClick={() => handleDeleteOrder(selectedOrder)}
                disabled={deletingOrderId === selectedOrder.id}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-300 font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deletingOrderId === selectedOrder.id ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Delete Order #{selectedOrder.orderNumber}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Order Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 text-slate-900">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-black text-slate-900">
                Delete Order #{orderToDelete.orderNumber}?
              </h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently delete this order for <strong>{orderToDelete.customer.name}</strong> (₹{orderToDelete.totalAmount})? This action cannot be undone.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-800">{orderToDelete.customer.name} ({orderToDelete.customer.mobile})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Service:</span>
                <span className="font-bold text-slate-800">{orderToDelete.mode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Files:</span>
                <span className="font-bold text-slate-800">{orderToDelete.files.length} file(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Amount:</span>
                <span className="font-black text-emerald-700">₹{orderToDelete.totalAmount}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                disabled={deletingOrderId !== null}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingOrderId !== null}
                className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                {deletingOrderId === orderToDelete.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP NOTIFICATION TRIGGER / PREVIEW MODAL */}
      {whatsAppModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    WhatsApp Pickup Notification
                  </h3>
                  <p className="text-xs text-slate-500">
                    Order #{whatsAppModalOrder.order.orderNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWhatsAppModalOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 text-sm cursor-pointer rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Customer & PIN Highlights */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Recipient</span>
                <span className="font-extrabold text-slate-900">{whatsAppModalOrder.order.customer.name}</span>
                <span className="text-slate-600 block text-[11px]">+91 {whatsAppModalOrder.order.customer.mobile}</span>
              </div>
              <div className="bg-amber-100/70 border border-amber-300 rounded-xl p-2 text-center">
                <span className="text-amber-900 block text-[10px] uppercase font-black">Collection PIN</span>
                <span className="font-mono text-lg font-black text-slate-950 tracking-wider">
                  {whatsAppModalOrder.order.deliveryPin || '4921'}
                </span>
              </div>
            </div>

            {/* Sender Dispatch Number Indicator */}
            <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
              <span className="text-emerald-900 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Official Dispatch Line:
              </span>
              <span className="font-mono font-black text-emerald-950">
                +91 {settings.whatsAppSenderPhone || settings.whatsapp || '8652411690'}
              </span>
            </div>

            {/* Preview Box */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Formatted Message Preview
              </label>
              <div className="p-3.5 bg-emerald-950/5 border border-emerald-200 rounded-2xl text-xs font-mono text-slate-800 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                {whatsAppModalOrder.message}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(whatsAppModalOrder.message);
                  showToast('Message copied to clipboard! 📋');
                }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>📋 Copy Message</span>
              </button>

              <a
                href={whatsAppModalOrder.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  showToast('WhatsApp launched! 🚀');
                  setTimeout(() => setWhatsAppModalOrder(null), 1500);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow cursor-pointer text-center"
              >
                <Send className="w-4 h-4" />
                <span>Open WhatsApp Web / App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
