import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  BellOff,
  Volume2,
  VolumeX,
  X,
  Send,
  ExternalLink,
} from 'lucide-react';
import { AdminStats, OrderRecord, ShopSettings, SerializableFileItem } from '../types';
import { apiClient } from '../services/apiClient';
import {
  notifyCustomerOrderReady,
  formatPickupReadyWhatsAppMessage,
  generateWhatsAppUrl,
  generateWhatsAppDesktopUrl,
  launchWhatsAppDesktop,
  copyWhatsAppMessageToClipboard,
  dispatchOrderReadyWhatsApp,
  openWhatsAppInSingleTab,
  WHATSAPP_TAB_TARGET,
} from '../services/whatsappService';
import { downloadWhatsAppExtensionZip } from '../services/whatsappExtensionHelper';
import { extractSelectedPagesFromPdf, getSelectedPagesList } from '../utils/pdfExtractor';
import { getPreservedFormatDetails } from '../utils/fileFormatHelper';
import { resolveFileFromStorage } from '../utils/fileStorage';
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

    // Emphatic Dual-Phase Order Alert Chime (Arpeggio + Echo High Bell)
    const notes = [
      { freq: 523.25, time: now, duration: 0.18, vol: 0.45 },
      { freq: 659.25, time: now + 0.1, duration: 0.18, vol: 0.45 },
      { freq: 783.99, time: now + 0.2, duration: 0.2, vol: 0.5 },
      { freq: 1046.5, time: now + 0.32, duration: 0.38, vol: 0.55 },
      // Distinctive secondary chime to cut through ambient print-shop noise
      { freq: 783.99, time: now + 0.52, duration: 0.16, vol: 0.4 },
      { freq: 1046.5, time: now + 0.65, duration: 0.45, vol: 0.55 },
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

  // Chrome Single-Tab WhatsApp Companion Extension State
  const [isExtensionActive, setIsExtensionActive] = useState<boolean>(false);
  const [showExtensionModal, setShowExtensionModal] = useState<boolean>(false);
  const [downloadingExtension, setDownloadingExtension] = useState<boolean>(false);

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'RSCC_EXTENSION_ACTIVE') {
        setIsExtensionActive(true);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

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

  // Tracks orders where staff has clicked "Download ZIP"
  const [downloadedZipIds, setDownloadedZipIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('rscc_downloaded_zip_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markZipDownloaded = (orderId: string, orderNumber?: string) => {
    setDownloadedZipIds((prev) => {
      const updated = new Set(prev);
      updated.add(orderId);
      if (orderNumber) updated.add(orderNumber);
      try {
        localStorage.setItem('rscc_downloaded_zip_ids', JSON.stringify(Array.from(updated)));
      } catch (e) {
        console.warn('Storage save zip id error:', e);
      }
      return updated;
    });
  };

  // Helper to determine if an order's alarm has been silenced on ANY connected device
  const isOrderAlarmSilenced = (o: OrderRecord) => {
    return (
      Boolean(o.alarmSilenced) ||
      Boolean(o.zipDownloaded) ||
      downloadedZipIds.has(o.id) ||
      downloadedZipIds.has(o.orderNumber)
    );
  };

  // Pending orders with files that require staff to silence alarm or download ZIP
  const pendingZipOrders = useMemo(() => {
    return orders.filter((o) => {
      const hasFiles = o.files && o.files.length > 0;
      const isActive = o.orderStatus !== 'CANCELLED' && o.orderStatus !== 'COMPLETED';
      return hasFiles && isActive && !isOrderAlarmSilenced(o);
    });
  }, [orders, downloadedZipIds]);

  // Loading states for stopping alarms
  const [stoppingAlarmOrderIds, setStoppingAlarmOrderIds] = useState<Set<string>>(new Set());
  const [isStoppingAllAlarms, setIsStoppingAllAlarms] = useState<boolean>(false);

  // Stop Alarm for a Single Order across all devices
  const handleStopSingleAlarm = async (order: OrderRecord) => {
    setStoppingAlarmOrderIds((prev) => new Set(prev).add(order.id));
    // Immediately silence locally for zero-latency feedback
    markZipDownloaded(order.id, order.orderNumber);
    setNewOrderAlerts((prev) => prev.filter((o) => o.id !== order.id && o.orderNumber !== order.orderNumber));
    try {
      await apiClient.stopOrderAlarm(order.id, order.orderNumber);
      showToast(`🔕 Alarm stopped for Order #${order.orderNumber} (synced across all devices)!`);
    } catch (err: any) {
      console.warn('Error stopping single alarm:', err);
      showToast(`Alarm silenced locally for #${order.orderNumber}`);
    } finally {
      setStoppingAlarmOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  };

  // Stop ALL Active Order Alarms simultaneously across all logged-in devices
  const handleStopAllAlarms = async () => {
    if (pendingZipOrders.length === 0) {
      showToast('No active order alarms to stop.');
      return;
    }
    setIsStoppingAllAlarms(true);
    // 1. Immediately silence all pending alarms locally
    pendingZipOrders.forEach((o) => {
      markZipDownloaded(o.id, o.orderNumber);
    });
    setNewOrderAlerts([]);

    try {
      const res = await apiClient.stopAllOrderAlarms();
      showToast(`🔕 Stopped all alarms (${res.silencedCount || pendingZipOrders.length} orders) across all devices!`);
    } catch (err: any) {
      console.warn('Error stopping all alarms:', err);
      showToast('All order alarms silenced on this device.');
    } finally {
      setIsStoppingAllAlarms(false);
    }
  };

  // Continuous Repeating Notification Alarm: Rings every 7 seconds until alarm is stopped or ZIP is downloaded!
  useEffect(() => {
    if (!isAdminLoggedIn) return;

    if (pendingZipOrders.length === 0) {
      document.title = 'Admin Portal | Riddhi Siddhi Choice Centre';
      return;
    }

    // Play chime immediately once when pending un-downloaded orders are present
    if (soundEnabled) {
      playOrderChime();
    }

    let toggleTitle = false;
    const alarmInterval = setInterval(() => {
      if (soundEnabled) {
        playOrderChime();
      }
      toggleTitle = !toggleTitle;
      document.title = toggleTitle
        ? `🚨 (${pendingZipOrders.length}) NEW ORDER - STOP ALARM / ZIP!`
        : `🔔 (${pendingZipOrders.length}) PENDING ORDERS WAITING`;
    }, 7000);

    return () => {
      clearInterval(alarmInterval);
      document.title = 'Admin Portal | Riddhi Siddhi Choice Centre';
    };
  }, [isAdminLoggedIn, pendingZipOrders.length, soundEnabled]);

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
      const targetOrder = orders.find((o) => o.id === orderId || o.orderNumber === orderId) || (selectedOrder?.id === orderId || selectedOrder?.orderNumber === orderId ? selectedOrder : undefined);
      const updated = await apiClient.verifyPayment(
        orderId,
        verified,
        verified ? 'Verified on UPI merchant statement' : 'Payment failed / rejected by shop admin: order cancelled',
        targetOrder
      );
      setOrders((prev) => prev.map((o) => (o.id === orderId || o.orderNumber === orderId ? updated : o)));
      if (selectedOrder && (selectedOrder.id === orderId || selectedOrder.orderNumber === orderId)) {
        setSelectedOrder(updated);
      }
      loadDashboardData();
    } catch (err: any) {
      showToast('Error verifying payment: ' + (err.message || 'Operation failed'));
    }
  };

  /**
   * Safely converts any data URL, blob URL, HTTP URL, base64 string, or text into a binary Uint8Array or string for JSZip
   */
  const resolveFileBinary = async (
    urlOrContent?: string
  ): Promise<{ data: Uint8Array | string; isBinary: boolean } | null> => {
    if (!urlOrContent || typeof urlOrContent !== 'string') return null;

    // Strategy 1: Browser fetch (handles data: URIs, blob: URIs, http(s) URLs, and server API endpoints natively)
    if (
      urlOrContent.startsWith('data:') ||
      urlOrContent.startsWith('blob:') ||
      urlOrContent.startsWith('http://') ||
      urlOrContent.startsWith('https://') ||
      urlOrContent.startsWith('/api/')
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

  // Helper: Ensures file is trimmed to customer's selected pages before serving to staff, with IndexedDB and server fallbacks
  const getTrimmedFilePreviewUrl = async (
    file: SerializableFileItem,
    orderId?: string,
    fileIndex?: number,
    orderNumber?: string
  ): Promise<string | undefined> => {
    let sourceUrl = file.previewUrl || (file as any).dataUrl;
    if (!sourceUrl && orderId) {
      sourceUrl = (await resolveFileFromStorage(orderId, file.id, fileIndex, file.name, orderNumber)) || undefined;
    }
    if (!sourceUrl && orderNumber) {
      sourceUrl = (await resolveFileFromStorage(orderNumber, file.id, fileIndex, file.name, orderNumber)) || undefined;
    }
    if (!sourceUrl && orderId && fileIndex !== undefined) {
      sourceUrl = `/api/orders/${orderId}/files/${fileIndex}/view`;
    }
    if (!sourceUrl && orderNumber && fileIndex !== undefined) {
      sourceUrl = `/api/orders/${orderNumber}/files/${fileIndex}/view`;
    }
    if (!sourceUrl) return undefined;
    if (file.trimmedPdfCreated) return sourceUrl;

    // If file has page selection (Odd, Even, Custom) but wasn't trimmed previously:
    if (file.pageSelectionMode && file.pageSelectionMode !== 'ALL' && file.pageCount > 0) {
      const isPdf =
        file.name.toLowerCase().endsWith('.pdf') ||
        (file.type && file.type.includes('pdf')) ||
        sourceUrl.startsWith('data:application/pdf');

      if (isPdf) {
        try {
          const selectedPages = getSelectedPagesList(
            file.pageCount,
            file.pageSelectionMode,
            file.customPageRange || ''
          );
          if (selectedPages.length > 0 && selectedPages.length < file.pageCount) {
            const extracted = await extractSelectedPagesFromPdf(sourceUrl, selectedPages);
            return extracted.dataUrl;
          }
        } catch (err) {
          console.warn('Could not trim PDF on-the-fly for staff download:', err);
        }
      }
    }
    return sourceUrl;
  };

  const handleViewOrPrintSingleFile = async (
    file: SerializableFileItem,
    orderNumber: string,
    orderId?: string,
    fileIndex?: number
  ) => {
    const targetOrderId = orderId || (selectedOrder?.orderNumber === orderNumber ? selectedOrder.id : orders.find(o => o.orderNumber === orderNumber)?.id);
    if (targetOrderId) {
      const targetOrd = orders.find(o => o.id === targetOrderId) || (selectedOrder?.id === targetOrderId ? selectedOrder : null);
      if (targetOrd && targetOrd.orderStatus !== 'READY_FOR_PICKUP' && targetOrd.orderStatus !== 'COMPLETED' && targetOrd.orderStatus !== 'CANCELLED') {
        try {
          const updated = await apiClient.updateOrderStatus(targetOrderId, 'PRINTING');
          setOrders((prev) => prev.map((o) => (o.id === targetOrderId ? updated : o)));
          if (selectedOrder && selectedOrder.id === targetOrderId) {
            setSelectedOrder(updated);
          }
          loadDashboardData();
          showToast(`Print status updated: Getting Prepared 🖨️ (Order #${orderNumber})`);
        } catch (statusErr) {
          console.error('Failed to update status to PRINTING on print view:', statusErr);
        }
      }
    }

    try {
      const effectiveUrl = await getTrimmedFilePreviewUrl(file, targetOrderId, fileIndex);
      if (!effectiveUrl) {
        showToast(`Could not load preview for "${file.name}".`);
        return;
      }

      const resolved = await resolveFileBinary(effectiveUrl);
      if (resolved && resolved.isBinary && resolved.data instanceof Uint8Array) {
        const { filename: safeName, mimeType, formatLabel } = getPreservedFormatDetails(
          file,
          resolved.data,
          effectiveUrl
        );
        const blob = new Blob([resolved.data], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        showToast(`Opened "${safeName}" in print viewer (${formatLabel}) 🖨️`);
        return;
      }
      window.open(effectiveUrl, '_blank');
    } catch {
      if (file.previewUrl) {
        window.open(file.previewUrl, '_blank');
      }
    }
  };

  const handleDownloadSingleFile = async (
    file: SerializableFileItem,
    orderNumber: string,
    orderId?: string,
    fileIndex?: number
  ) => {
    // CRITICAL: When staff portal downloads the file, auto-update the print status to PRINTING ("Getting Prepared")
    const targetOrderId = orderId || (selectedOrder?.orderNumber === orderNumber ? selectedOrder.id : orders.find(o => o.orderNumber === orderNumber)?.id);
    if (targetOrderId) {
      const targetOrd = orders.find(o => o.id === targetOrderId) || (selectedOrder?.id === targetOrderId ? selectedOrder : null);
      if (targetOrd && targetOrd.orderStatus !== 'READY_FOR_PICKUP' && targetOrd.orderStatus !== 'COMPLETED' && targetOrd.orderStatus !== 'CANCELLED') {
        try {
          const updated = await apiClient.updateOrderStatus(targetOrderId, 'PRINTING');
          setOrders((prev) => prev.map((o) => (o.id === targetOrderId ? updated : o)));
          if (selectedOrder && selectedOrder.id === targetOrderId) {
            setSelectedOrder(updated);
          }
          loadDashboardData();
          showToast(`Print status updated: Getting Prepared 🖨️ (Order #${orderNumber})`);
        } catch (statusErr) {
          console.error('Failed to update status to PRINTING on file download:', statusErr);
        }
      }
    }

    try {
      let effectiveUrl = (await getTrimmedFilePreviewUrl(file, targetOrderId, fileIndex)) || file.previewUrl;
      if (!effectiveUrl && targetOrderId) {
        effectiveUrl = (await resolveFileFromStorage(targetOrderId, file.id, fileIndex, file.name)) || undefined;
      }
      if (!effectiveUrl && targetOrderId && fileIndex !== undefined) {
        effectiveUrl = `/api/orders/${targetOrderId}/files/${fileIndex}/download`;
      }

      if (!effectiveUrl) {
        showToast(`File "${file.name}" binary is not available.`);
        return;
      }

      const resolved = await resolveFileBinary(effectiveUrl);
      if (resolved && resolved.isBinary && resolved.data instanceof Uint8Array) {
        const { filename: safeName, mimeType, formatLabel } = getPreservedFormatDetails(
          file,
          resolved.data,
          effectiveUrl
        );
        const blob = new Blob([resolved.data], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = safeName;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 60000);
        showToast(`Downloaded "${safeName}" in ${formatLabel} format ✅`);
        return;
      }

      const { filename: safeName, formatLabel } = getPreservedFormatDetails(file, undefined, effectiveUrl);
      const link = document.createElement('a');
      link.href = effectiveUrl;
      link.download = safeName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 1000);
      showToast(`Downloading "${safeName}" in ${formatLabel} format...`);
    } catch (err) {
      console.error('Download single file error:', err);
      if (file.previewUrl) {
        window.open(file.previewUrl, '_blank');
      }
    }
  };

  const handleDownloadAllZip = async (order: OrderRecord) => {
    // Silence repeating alarm immediately on Download ZIP click and sync across all devices
    markZipDownloaded(order.id, order.orderNumber);
    apiClient.markOrderZipDownloaded(order.id, order.orderNumber).catch(() => {});
    setNewOrderAlerts((prev) => prev.filter((o) => o.id !== order.id && o.orderNumber !== order.orderNumber));
    setDownloadingZipOrderId(order.id);
    showToast(`Downloading ZIP for Order #${order.orderNumber}... Alarm silenced! 🔕✅`);

    try {
      // Auto-update the print status to PRINTING ("Getting Prepared") while preserving full file binaries in memory
      if (order.orderStatus !== 'READY_FOR_PICKUP' && order.orderStatus !== 'COMPLETED' && order.orderStatus !== 'CANCELLED') {
        try {
          const updated = await apiClient.updateOrderStatus(order.id, 'PRINTING', undefined, order);
          setOrders((prev) =>
            prev.map((o) => {
              if (o.id === order.id || o.orderNumber === order.orderNumber) {
                const preservedFiles = (o.files || []).map((origF, fIdx) => {
                  const newF = updated.files?.[fIdx] || origF;
                  return {
                    ...newF,
                    previewUrl: origF.previewUrl || newF.previewUrl,
                    dataUrl: (origF as any).dataUrl || (newF as any).dataUrl,
                  };
                });
                return {
                  ...updated,
                  files: preservedFiles.length > 0 ? preservedFiles : updated.files,
                };
              }
              return o;
            })
          );
          if (selectedOrder && (selectedOrder.id === order.id || selectedOrder.orderNumber === order.orderNumber)) {
            setSelectedOrder(updated);
          }
          loadDashboardData();
          showToast(`Print status updated: Getting Prepared 🖨️ (Order #${order.orderNumber})`);
        } catch (statusErr) {
          console.warn('Status update fallback on ZIP download:', statusErr);
          const fallbackUpdated: OrderRecord = {
            ...order,
            orderStatus: 'PRINTING',
            updatedAt: new Date().toISOString(),
          };
          setOrders((prev) => prev.map((o) => (o.id === order.id || o.orderNumber === order.orderNumber ? fallbackUpdated : o)));
          if (selectedOrder && (selectedOrder.id === order.id || selectedOrder.orderNumber === order.orderNumber)) {
            setSelectedOrder(fallbackUpdated);
          }
        }
      }

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
Layout Mode    : ${order.pagesPerSheet === 2 ? `2 Pages on 1 Side (${order.nupOrientation === 'SIDE_BY_SIDE' ? 'Side-by-Side' : 'Top & Bottom'})` : '1 Page / Sheet'}
Copies         : ${order.copies}
Total Sheets   : ${order.totalSheets || order.totalPages}
Rate Per Page  : ₹${order.ratePerPage}
Total Amount   : ₹${order.totalAmount}
Payment Status : ${order.paymentStatus}
Order Status   : ${order.orderStatus}
Payment Ref    : ${order.paymentReference || 'N/A'}

=====================================================
FILES LIST (${order.files.length} Total):
${order.files.map((f, i) => {
  const format = getPreservedFormatDetails(f);
  const isTrimmed = f.trimmedPdfCreated || (f.pageSelectionMode && f.pageSelectionMode !== 'ALL');
  const tag = isTrimmed ? ` [CONTAINS ONLY SELECTED PAGES: ${f.selectedPagesSummary || f.pageSelectionMode} (from original ${f.originalPageCount || f.pageCount} pgs)]` : '';
  return `${i + 1}. ${format.filename} (Format: ${format.formatLabel}, Pages: ${f.pageCount}, Size: ${(f.size / 1024).toFixed(1)} KB)${tag}`;
}).join('\n')}
=====================================================
`;
      zip.file('00_ORDER_SUMMARY.txt', summaryText);

      // 2. Add each file into the zip preserving exact customer format (PDF, JPG, PNG, etc.)
      for (let i = 0; i < order.files.length; i++) {
        const file = order.files[i];
        let added = false;
        let effectiveUrl = (await getTrimmedFilePreviewUrl(file, order.id, i, order.orderNumber)) || file.previewUrl || (file as any).dataUrl;
        if (!effectiveUrl) {
          effectiveUrl = (await resolveFileFromStorage(order.id, file.id, i, file.name, order.orderNumber)) || undefined;
        }
        if (!effectiveUrl && order.orderNumber) {
          effectiveUrl = (await resolveFileFromStorage(order.orderNumber, file.id, i, file.name, order.orderNumber)) || undefined;
        }
        if (!effectiveUrl && order.id) {
          effectiveUrl = `/api/orders/${order.id}/files/${i}/download`;
        }
        if (!effectiveUrl && order.orderNumber) {
          effectiveUrl = `/api/orders/${order.orderNumber}/files/${i}/download`;
        }

        let finalZipEntryName = `${String(i + 1).padStart(2, '0')}_${(file.name || `file_${i + 1}`).replace(/[/\\?%*:|"<>]/g, '_')}`;

        if (effectiveUrl) {
          const resolved = await resolveFileBinary(effectiveUrl);
          if (resolved) {
            const formatDetails = getPreservedFormatDetails(
              file,
              resolved.data instanceof Uint8Array ? resolved.data : undefined,
              effectiveUrl
            );
            finalZipEntryName = `${String(i + 1).padStart(2, '0')}_${formatDetails.filename.replace(/[/\\?%*:|"<>]/g, '_')}`;
            zip.file(finalZipEntryName, resolved.data);
            added = true;
          }
        }

        if (!added) {
          const formatDetails = getPreservedFormatDetails(file);
          finalZipEntryName = `${String(i + 1).padStart(2, '0')}_${formatDetails.filename.replace(/[/\\?%*:|"<>]/g, '_')}`;
          zip.file(
            `${finalZipEntryName}.info.txt`,
            `File Name: ${file.name}\nFormat: ${formatDetails.formatLabel}\nPage Count: ${file.pageCount}\nSize: ${file.size} bytes\nOrder: ${order.orderNumber}\nPrint Type: ${order.printType}\nStatus: Customer uploaded at counter`
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

      // 4. Generate ZIP & Trigger download reliably with proper ZIP MIME & 60s persistence
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/zip',
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
        // Keep object URL active for 60s so repeated downloads / OS file scanners never corrupt or truncate the file!
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
          URL.revokeObjectURL(downloadUrl);
        }, 60000);
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
        }, 10000);
      }

      showToast(`ZIP downloaded for Order #${order.orderNumber} ✅`);
    } catch (err: any) {
      console.error('Failed to create ZIP download:', err);
      showToast('Failed to generate ZIP archive: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloadingZipOrderId(null);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: OrderRecord['orderStatus'], fallbackOrder?: OrderRecord) => {
    try {
      const targetOrder = fallbackOrder || orders.find((o) => o.id === orderId || o.orderNumber === orderId) || (selectedOrder?.id === orderId || selectedOrder?.orderNumber === orderId ? selectedOrder : undefined);
      const updated = await apiClient.updateOrderStatus(orderId, status, undefined, targetOrder);
      setOrders((prev) => prev.map((o) => (o.id === orderId || o.orderNumber === orderId ? updated : o)));
      if (selectedOrder && (selectedOrder.id === orderId || selectedOrder.orderNumber === orderId)) {
        setSelectedOrder(updated);
      }
      loadDashboardData();

      // AUTOMATIC WHATSAPP NOTIFICATION TRIGGER WHEN READY FOR PICKUP IS MARKED
      if (status === 'READY_FOR_PICKUP') {
        const cleanMobile = updated.customer?.mobile?.replace(/\D/g, '').slice(-10) || '';
        const message = formatPickupReadyWhatsAppMessage(updated, settings);
        const webUrl = generateWhatsAppUrl(cleanMobile, message, true);

        // Check if automatic direct dispatch is enabled (default: true)
        const autoNotify = settings.autoNotifyReadyWhatsApp !== false;

        if (autoNotify && cleanMobile.length >= 10) {
          const dispatchRes = dispatchOrderReadyWhatsApp(updated, settings);
          if (dispatchRes.mode === 'EXTENSION_SINGLE_TAB') {
            if (isExtensionActive) {
              showToast(`🟢 Order #${updated.orderNumber} Ready! Navigated your open WhatsApp tab to customer with message pasted (0 new tabs)!`);
            } else {
              showToast(`📲 Order #${updated.orderNumber} Ready! Copied to clipboard & dispatched to open WhatsApp tab.`);
            }
          } else if (dispatchRes.mode === 'DESKTOP_APP') {
            showToast(`📲 Order #${updated.orderNumber} Ready! Launched in WhatsApp Desktop (0 browser tabs).`);
          } else if (dispatchRes.mode === 'CLIPBOARD_PASTE') {
            showToast(`📋 Order #${updated.orderNumber} Ready! Message copied to clipboard. Paste into your open WhatsApp tab.`);
          } else {
            showToast(`📲 Order #${updated.orderNumber} marked Ready! Opening WhatsApp...`);
          }
        } else {
          showToast(`🎉 Order #${updated.orderNumber} marked Ready to Pick Up!`);
        }

        // Show prompt / preview modal so staff can also review, copy or re-send
        setWhatsAppModalOrder({
          order: updated,
          message,
          url: webUrl,
        });
      } else if (status === 'PRINTING') {
        showToast(`🖨️ Order #${updated.orderNumber} status updated to: Getting Prepared`);
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
    const url = generateWhatsAppUrl(cleanMobile, message, true);
    setWhatsAppModalOrder({
      order,
      message,
      url,
    });
    const dispatchRes = dispatchOrderReadyWhatsApp(order, settings);
    if (dispatchRes.mode === 'EXTENSION_SINGLE_TAB') {
      if (isExtensionActive) {
        showToast(`🟢 Opened in your existing WhatsApp Web tab for +91 ${cleanMobile} (0 new tabs)!`);
      } else {
        showToast(`🟢 Copied & dispatched for +91 ${cleanMobile}!`);
      }
    } else if (dispatchRes.mode === 'DESKTOP_APP') {
      showToast(`📲 Launched WhatsApp Desktop for +91 ${cleanMobile} (0 tabs)!`);
    } else if (dispatchRes.mode === 'CLIPBOARD_PASTE') {
      showToast(`📋 Message copied to clipboard for +91 ${cleanMobile}! Paste in open WhatsApp tab.`);
    } else {
      showToast(`WhatsApp launched for +91 ${cleanMobile}!`);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !newNote.trim()) return;

    try {
      const updated = await apiClient.addInternalNote(selectedOrder.id, newNote.trim(), selectedOrder);
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id || o.orderNumber === selectedOrder.orderNumber ? updated : o)));
      setNewNote('');
    } catch (err: any) {
      showToast('Error adding note: ' + (err.message || 'Operation failed'));
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

  // Filtered orders list - Shows all orders with comprehensive search and filtering
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
              type="button"
              onClick={handleStopAllAlarms}
              disabled={isStoppingAllAlarms}
              title="Stop and silence all order alarms across all logged-in devices immediately"
              className="text-xs font-black px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300 shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isStoppingAllAlarms ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
              ) : (
                <BellOff className="w-3.5 h-3.5 text-slate-950" />
              )}
              <span>Stop All Alarms 🔕</span>
            </button>

            <button
              onClick={toggleSound}
              title={soundEnabled ? 'Click to Mute New Order Chime' : 'Click to Enable New Order Chime'}
              className={`text-xs font-bold px-3 py-2 rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
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

        {/* Continuous Repeating Notification Banner - Stays active and alarms until alarms are stopped or ZIP is downloaded */}
        {pendingZipOrders.length > 0 && (
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-4 sm:p-5 rounded-2xl shadow-2xl border-2 border-red-300 animate-in slide-in-from-top-2 duration-300 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/20 pb-3">
              <div className="flex items-center gap-2.5 font-black text-sm sm:text-base uppercase tracking-wide">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-yellow-400"></span>
                </span>
                <BellRing className="w-5 h-5 animate-bounce text-yellow-300 shrink-0" />
                <span>🚨 REPEATING ALARM: {pendingZipOrders.length} New Order(s) Awaiting Attention</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleStopAllAlarms}
                  disabled={isStoppingAllAlarms}
                  className="bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-black text-xs sm:text-sm px-4 py-2 rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer border-2 border-white/80 disabled:opacity-50"
                  title="Stop all order alarms across all logged-in devices immediately"
                >
                  {isStoppingAllAlarms ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <BellOff className="w-4 h-4 text-slate-950" />
                  )}
                  <span>STOP ALL ALARMS (Across Devices) 🔕</span>
                </button>

                <span className="bg-black/40 backdrop-blur-xs font-mono font-bold text-[11px] sm:text-xs px-2.5 py-1.5 rounded-lg border border-yellow-300/40 text-yellow-300 flex items-center gap-1.5 shadow-xs">
                  <Volume2 className="w-3.5 h-3.5 animate-pulse text-yellow-300" />
                  Beeps every 7s
                </span>
              </div>
            </div>

            <p className="text-xs text-red-100 font-medium leading-relaxed">
              🔔 <strong>Cross-Device Alarm Sync:</strong> When you stop an alarm or download a ZIP on this device, the alarm is <strong>immediately silenced across all other logged-in devices</strong> too.
            </p>

            <div className="space-y-2.5 pt-1">
              {pendingZipOrders.map((alertOrder) => (
                <div
                  key={alertOrder.id}
                  className="bg-white text-slate-900 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md border-2 border-amber-300"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-red-600 animate-ping shrink-0"></span>
                    <div>
                      <div className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2 flex-wrap">
                        <span>Order #{alertOrder.orderNumber}</span>
                        <span className="bg-red-100 text-red-800 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                          Alarm Ringing 🔔
                        </span>
                        <span className="bg-slate-100 text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded-md">
                          {alertOrder.files.length} {alertOrder.files.length === 1 ? 'file' : 'files'}
                        </span>
                        <span className="text-emerald-700 font-black text-sm">₹{alertOrder.totalAmount}</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium mt-1">
                        Customer: <span className="font-bold text-slate-900">{alertOrder.customer.name}</span> (+91 {alertOrder.customer.mobile}) • Service: <span className="font-semibold text-slate-800">{alertOrder.mode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Dedicated Button to Stop Alarm for this specific order */}
                    <button
                      type="button"
                      onClick={() => handleStopSingleAlarm(alertOrder)}
                      disabled={stoppingAlarmOrderIds.has(alertOrder.id)}
                      className="bg-slate-100 hover:bg-red-50 text-red-700 hover:text-red-800 border border-slate-300 hover:border-red-300 font-extrabold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Stop and silence the alarm for this order across all devices"
                    >
                      {stoppingAlarmOrderIds.has(alertOrder.id) ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-red-700" />
                      ) : (
                        <BellOff className="w-4 h-4 text-red-600" />
                      )}
                      <span>Stop Alarm 🔕</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadAllZip(alertOrder)}
                      disabled={downloadingZipOrderId === alertOrder.id}
                      className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer border border-red-500 animate-pulse hover:animate-none disabled:opacity-50"
                      title="Download ZIP archive now to silence this repeating notification"
                    >
                      {downloadingZipOrderId === alertOrder.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>Download ZIP (Stops Alarm) 🔕</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(alertOrder);
                        setActiveTab('orders');
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs px-3 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Regular new order toasts/alerts for orders whose ZIP is already handled */}
        {pendingZipOrders.length === 0 && newOrderAlerts.length > 0 && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 rounded-2xl shadow-xl border-2 border-emerald-300 animate-in slide-in-from-top-2 duration-300 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wide">
                <CheckCircle2 className="w-5 h-5 text-white" />
                <span>Orders Received (All ZIPs Downloaded)</span>
              </div>
              <button
                onClick={() => setNewOrderAlerts([])}
                className="text-xs font-bold bg-black/20 hover:bg-black/30 text-white px-2 py-1 rounded-lg transition cursor-pointer"
              >
                Clear
              </button>
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
                <option value="PRINTING">Getting Prepared</option>
                <option value="READY_FOR_PICKUP">Ready to Pick Up</option>
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
                          {ord.files.some(f => f.trimmedPdfCreated || (f.pageSelectionMode && f.pageSelectionMode !== 'ALL')) && (
                            <span className="inline-block mt-0.5 text-[9px] font-black bg-indigo-100 text-indigo-900 border border-indigo-200 px-1.5 py-0.2 rounded">
                              ✂️ Selected Pages Only
                            </span>
                          )}
                          {ord.pagesPerSheet === 2 && (
                            <span className="inline-block mt-0.5 ml-1 text-[9px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.2 rounded">
                              ✨ 2-in-1 (Same Side)
                            </span>
                          )}
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
                                ? 'bg-blue-100 text-blue-900 font-extrabold'
                                : ord.orderStatus === 'PRINTING'
                                ? 'bg-indigo-100 text-indigo-900 font-extrabold'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {ord.orderStatus === 'PRINTING'
                              ? 'GETTING PREPARED'
                              : ord.orderStatus === 'READY_FOR_PICKUP'
                              ? 'READY TO PICK UP'
                              : ord.orderStatus.replace(/_/g, ' ')}
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

                            {ord.files && ord.files.length > 0 && (
                              !isOrderAlarmSilenced(ord) ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStopSingleAlarm(ord);
                                    }}
                                    disabled={stoppingAlarmOrderIds.has(ord.id)}
                                    className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 font-extrabold text-[11px] px-2 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    title="Stop and silence the alarm across all devices"
                                  >
                                    {stoppingAlarmOrderIds.has(ord.id) ? (
                                      <RefreshCw className="w-3 h-3 animate-spin text-red-600" />
                                    ) : (
                                      <BellOff className="w-3 h-3 text-red-600" />
                                    )}
                                    <span>Stop Alarm</span>
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadAllZip(ord);
                                    }}
                                    disabled={downloadingZipOrderId === ord.id}
                                    className="bg-red-600 hover:bg-red-700 text-white font-black text-[11px] px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer animate-pulse shadow-sm disabled:opacity-50"
                                    title="Click to Download ZIP and stop repeating alarm across all devices"
                                  >
                                    {downloadingZipOrderId === ord.id ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Download className="w-3.5 h-3.5" />
                                    )}
                                    <span>ZIP (Alarm 🔔)</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadAllZip(ord);
                                  }}
                                  disabled={downloadingZipOrderId === ord.id}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="Download all customer files as .ZIP (Alarm already silenced)"
                                >
                                  {downloadingZipOrderId === ord.id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Download className="w-3.5 h-3.5" />
                                  )}
                                  <span>ZIP (Silenced 🔕)</span>
                                </button>
                              )
                            )}

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
                      value={editSettings.pricing.a4Bw100Single ?? 5}
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
                    <span className="text-[10px] text-slate-400">Default: ₹5/page</span>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Both Side Rate (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.a4Bw100Both ?? 4}
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
                    <span className="text-[10px] text-slate-400">Default: ₹4/page</span>
                  </div>
                </div>
              </div>

              {/* A4 Additional Sets (2nd+ Set Copy Discount) */}
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-3">
                <div className="font-bold text-emerald-950 border-b border-emerald-200 pb-1 flex items-center justify-between">
                  <span>2nd+ Set (Copies) • B&W</span>
                  <span className="text-[10px] text-emerald-700 font-bold">Copy Discount</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-emerald-900 font-semibold mb-1">
                      Single Side 2nd+ Set (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.bwCopySingle ?? 2}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            bwCopySingle: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-emerald-300 font-black text-emerald-950 text-base"
                    />
                    <span className="text-[10px] text-emerald-700">Default: ₹2/page</span>
                  </div>
                  <div>
                    <label className="block text-emerald-900 font-semibold mb-1">
                      Both Side 2nd+ Set (₹/pg):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editSettings.pricing.bwCopyBoth ?? 3}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          pricing: {
                            ...editSettings.pricing,
                            bwCopyBoth: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-emerald-300 font-black text-emerald-950 text-base"
                    />
                    <span className="text-[10px] text-emerald-700">Default: ₹3/page</span>
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
                      value={editSettings.pricing.a4Color100Both ?? editSettings.pricing.colorBoth ?? 10}
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
                    <span className="text-[10px] text-amber-700">Default: ₹10/page</span>
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
                  A4 100 GSM Photo Sheet Rate (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  value={editSettings.pricing.photoSheet ?? 0}
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
                <span className="text-[10px] text-indigo-700">Default: ₹0 per 100 GSM photo sheet</span>
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

          {/* Shop Payment Gateway & Contact Information */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Payment Gateway & Contact Information
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

                {/* Single-Tab Chrome Extension Companion Banner */}
                <div className={`p-4 rounded-xl border transition ${
                  isExtensionActive ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${isExtensionActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                        <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                          {isExtensionActive ? '🟢 Chrome Single-Tab Extension Active' : 'Chrome Single-Tab WhatsApp Companion'}
                        </span>
                        {isExtensionActive && (
                          <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                            REUSING OPEN TAB
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                        {isExtensionActive
                          ? 'Connected! When you click "Mark Ready", Chrome navigates your already-open WhatsApp Web tab directly to the customer with the message pasted. Zero new tabs created!'
                          : 'Install our free 30-second helper so Chrome can find your already-open WhatsApp tab, open the customer chat in THAT SAME TAB, and paste the message automatically.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={downloadingExtension}
                        onClick={async () => {
                          setDownloadingExtension(true);
                          await downloadWhatsAppExtensionZip();
                          setDownloadingExtension(false);
                          setShowExtensionModal(true);
                        }}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{downloadingExtension ? 'Downloading...' : 'Download Extension (.zip)'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowExtensionModal(true)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap"
                      >
                        <span>Setup Guide</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    WhatsApp Dispatch Mode (Prevent Tab Spawning)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setEditSettings({ ...editSettings, whatsAppDispatchMode: 'EXTENSION_SINGLE_TAB' })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        (editSettings.whatsAppDispatchMode || 'EXTENSION_SINGLE_TAB') === 'EXTENSION_SINGLE_TAB'
                          ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1">
                            🟢 Existing Tab
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1 py-0.5 rounded">
                            0 TABS
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">
                          Finds your <strong>already-open WhatsApp Web tab</strong> in Chrome, navigates to the customer, and pastes the message in that same tab!
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditSettings({ ...editSettings, whatsAppDispatchMode: 'DESKTOP_APP' })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        editSettings.whatsAppDispatchMode === 'DESKTOP_APP'
                          ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1">
                            🖥️ Desktop App
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1 py-0.5 rounded">
                            0 TABS
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">
                          Controls the official WhatsApp Desktop app directly. <strong>Never opens any browser tabs.</strong>
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditSettings({ ...editSettings, whatsAppDispatchMode: 'CLIPBOARD_PASTE' })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        editSettings.whatsAppDispatchMode === 'CLIPBOARD_PASTE'
                          ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1">
                            📋 Auto-Copy
                          </span>
                          <span className="bg-blue-100 text-blue-800 text-[9px] font-extrabold px-1 py-0.5 rounded">
                            0 TABS
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">
                          Auto-copies text on Mark Ready. Switch to your open WhatsApp tab &amp; press <strong>Ctrl+V + Enter</strong>.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditSettings({ ...editSettings, whatsAppDispatchMode: 'WEB_WHATSAPP' })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        editSettings.whatsAppDispatchMode === 'WEB_WHATSAPP'
                          ? 'border-amber-600 bg-amber-50/90 ring-2 ring-amber-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1">
                            🌐 Web URL
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">
                          Standard web link. Note: Browser security will open a new tab for each message.
                        </p>
                      </div>
                    </button>
                  </div>
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xl font-black text-slate-900">
                    {selectedOrder.orderNumber}
                  </span>
                  <span className="bg-slate-100 text-slate-800 text-xs font-bold px-2 py-0.5 rounded">
                    {selectedOrder.mode}
                  </span>
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                    selectedOrder.orderStatus === 'PRINTING'
                      ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                      : selectedOrder.orderStatus === 'READY_FOR_PICKUP'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : selectedOrder.orderStatus === 'COMPLETED'
                      ? 'bg-slate-200 text-slate-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {selectedOrder.orderStatus === 'PRINTING'
                      ? 'Getting Prepared'
                      : selectedOrder.orderStatus === 'READY_FOR_PICKUP'
                      ? 'Ready to Pick Up'
                      : selectedOrder.orderStatus.replace(/_/g, ' ')}
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
                    {st === 'READY_FOR_PICKUP'
                      ? 'READY TO PICK UP ✨'
                      : st === 'PRINTING'
                      ? 'GETTING PREPARED 🖨️'
                      : st.replace(/_/g, ' ')}
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
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 uppercase">Customer & Files</h4>
                  {isOrderAlarmSilenced(selectedOrder) && (
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ✓ Alarm Silenced
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {!isOrderAlarmSilenced(selectedOrder) && (
                    <button
                      type="button"
                      onClick={() => handleStopSingleAlarm(selectedOrder)}
                      disabled={stoppingAlarmOrderIds.has(selectedOrder.id)}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Stop alarm across all devices"
                    >
                      {stoppingAlarmOrderIds.has(selectedOrder.id) ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-600" />
                      ) : (
                        <BellOff className="w-3.5 h-3.5 text-red-600" />
                      )}
                      <span>Stop Alarm 🔕</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDownloadAllZip(selectedOrder)}
                    disabled={downloadingZipOrderId === selectedOrder.id}
                    className={`font-bold text-xs px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50 ${
                      !isOrderAlarmSilenced(selectedOrder)
                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                    title={
                      !isOrderAlarmSilenced(selectedOrder)
                        ? 'Download ZIP and stop repeating notification alarm across all devices'
                        : 'Download all customer files as .ZIP'
                    }
                  >
                    {downloadingZipOrderId === selectedOrder.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {!isOrderAlarmSilenced(selectedOrder)
                        ? 'Download ZIP (Silences Alarm) 🔔'
                        : 'Download All Files (.ZIP) ✅'}
                    </span>
                  </button>
                </div>
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
                  {selectedOrder.files.map((f, i) => {
                    const format = getPreservedFormatDetails(f);
                    const isTrimmed = f.trimmedPdfCreated || (f.pageSelectionMode && f.pageSelectionMode !== 'ALL');
                    return (
                      <div key={i} className="flex flex-col sm:flex-row justify-between sm:items-center text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 text-xs gap-2.5">
                        <div className="min-w-0 flex items-start gap-2">
                          <span className="w-5 h-5 rounded bg-slate-100 text-slate-700 font-mono font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 truncate max-w-[190px] sm:max-w-[270px]">
                                {format.filename}
                              </span>
                              <span className="bg-slate-100 text-slate-700 border border-slate-300 font-mono font-bold text-[10px] px-1.5 py-0.2 rounded uppercase">
                                {format.extension.replace('.', '') || 'FILE'}
                              </span>
                              {isTrimmed && (
                                <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-black px-1.5 py-0.2 rounded-md">
                                  ✂️ Only {f.selectedPagesSummary || f.pageSelectionMode}
                                </span>
                              )}
                              {(f.pagesPerSheet === 2 || selectedOrder.pagesPerSheet === 2) && (
                                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black px-1.5 py-0.2 rounded-md">
                                  ✨ 2 Pages on 1 Side ({f.nupOrientation || selectedOrder.nupOrientation === 'TOP_BOTTOM' ? 'Top/Bottom' : 'Side-by-Side'})
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-slate-400 text-[11px] flex items-center gap-1.5">
                              <span className="text-emerald-700 font-bold">
                                {f.pageCount} pgs to print
                              </span>
                              {f.originalPageCount && f.originalPageCount !== f.pageCount && (
                                <span>(of {f.originalPageCount} orig)</span>
                              )}
                              <span>•</span>
                              <span>{(f.size / 1024).toFixed(1)} KB</span>
                              <span>•</span>
                              <span className="text-slate-500 font-sans">{format.formatLabel}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleViewOrPrintSingleFile(f, selectedOrder.orderNumber, selectedOrder.id, i)}
                            className="p-1.5 px-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 hover:border-indigo-300 transition flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                            title={`Open in print viewer (${format.formatLabel})`}
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>View / Print</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadSingleFile(f, selectedOrder.orderNumber, selectedOrder.id, i)}
                            className="p-1.5 px-2 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 transition flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                            title={`Download in original ${format.formatLabel} format`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download ({format.extension.replace('.', '').toUpperCase() || 'FILE'})</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
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

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const cleanMobile = whatsAppModalOrder.order.customer?.mobile?.replace(/\D/g, '').slice(-10) || '';
                  window.postMessage({
                    type: 'RSCC_DISPATCH_WHATSAPP',
                    phone: cleanMobile,
                    message: whatsAppModalOrder.message,
                    orderNumber: whatsAppModalOrder.order.orderNumber,
                  }, '*');
                  navigator.clipboard.writeText(whatsAppModalOrder.message);

                  if (isExtensionActive) {
                    showToast('🟢 Customer chat opened in your existing WhatsApp Web tab! (0 new tabs)');
                    setTimeout(() => setWhatsAppModalOrder(null), 1200);
                  } else {
                    // Open/reuse web tab with clean mobile and message, and copy text
                    openWhatsAppInSingleTab(whatsAppModalOrder.url, true);
                    showToast('🌐 WhatsApp Web opened & message copied to clipboard! (Install Chrome Extension to auto-navigate without new tabs)');
                    setTimeout(() => setWhatsAppModalOrder(null), 1500);
                  }
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow cursor-pointer text-center"
              >
                <span>🟢 Send to Open WhatsApp Web Tab</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cleanMobile = whatsAppModalOrder.order.customer?.mobile?.replace(/\D/g, '').slice(-10) || '';
                    launchWhatsAppDesktop(cleanMobile, whatsAppModalOrder.message);
                    showToast('🚀 Opened in WhatsApp Desktop app!');
                    setTimeout(() => setWhatsAppModalOrder(null), 1200);
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-2 rounded-xl text-[11px] transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>🖥️ Desktop App</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(whatsAppModalOrder.message);
                    showToast('📋 Copied! Switch to your open WhatsApp tab & press Ctrl+V + Enter.');
                  }}
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold py-2.5 px-2 rounded-xl text-[11px] transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>📋 Copy Text</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    openWhatsAppInSingleTab(whatsAppModalOrder.url, settings.whatsappSingleTabMode !== false);
                    showToast('Opening WhatsApp Web tab... 🌐');
                    setTimeout(() => setWhatsAppModalOrder(null), 1500);
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-2 rounded-xl text-[11px] transition cursor-pointer flex items-center justify-center gap-1 text-center"
                >
                  <Send className="w-3 h-3" />
                  <span>Web Link</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>

              {!isExtensionActive && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setWhatsAppModalOrder(null);
                      setShowExtensionModal(true);
                    }}
                    className="w-full text-center text-[11px] text-emerald-700 hover:text-emerald-800 underline font-bold cursor-pointer"
                  >
                    💡 Want Chrome to auto-paste into your open tab without new tabs? Click here for the 30s Chrome Helper.
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CHROME SINGLE-TAB WHATSAPP EXTENSION SETUP MODAL */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-black">
                  🧩
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Chrome Single-Tab WhatsApp Helper
                  </h3>
                  <p className="text-xs text-slate-500">
                    Never let Chrome open duplicate WhatsApp tabs again
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExtensionModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 text-sm cursor-pointer rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Connection Status Pill */}
            <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
              isExtensionActive ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isExtensionActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <span>
                  {isExtensionActive
                    ? '🟢 Active & Connected to this Browser Tab!'
                    : '⚪ Extension Not Yet Loaded in Chrome'}
                </span>
              </div>
              {isExtensionActive && (
                <button
                  type="button"
                  onClick={() => {
                    window.postMessage({
                      type: 'RSCC_DISPATCH_WHATSAPP',
                      phone: '8652411690',
                      message: 'Test message from RSCC Admin Dashboard! 🎉'
                    }, '*');
                    showToast('🚀 Test message sent to your open WhatsApp tab!');
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-lg cursor-pointer"
                >
                  Test Navigation
                </button>
              )}
            </div>

            {/* Why This Is Needed */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1.5 leading-relaxed">
              <span className="font-extrabold text-slate-900 block">Why does Chrome open a new tab by default?</span>
              <p>
                Google Chrome security (Same-Origin Policy) blocks all regular websites from accessing other tabs. Without this lightweight helper, Chrome forces a new tab every time you click a WhatsApp link.
              </p>
              <p>
                With this 1-click helper, Chrome grants permission to find your <strong>already-open WhatsApp Web tab</strong>, jump straight to the customer, and paste the message into that exact tab.
              </p>
            </div>

            {/* 3 Simple Setup Steps */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                3-Step Setup (Takes 30 Seconds):
              </h4>

              <div className="space-y-2.5 text-xs text-slate-700">
                <div className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <span className="font-bold text-slate-900 block">Download and unzip the helper folder</span>
                    <button
                      type="button"
                      disabled={downloadingExtension}
                      onClick={async () => {
                        setDownloadingExtension(true);
                        await downloadWhatsAppExtensionZip();
                        setDownloadingExtension(false);
                        showToast('📦 Downloaded rscc-whatsapp-single-tab-extension.zip! Please unzip/extract it.');
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>{downloadingExtension ? 'Packaging...' : 'Download Helper (.zip)'}</span>
                    </button>
                    <span className="text-[11px] text-slate-500 block">
                      Extract / Unzip the downloaded file to a folder on your computer.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">Open Chrome Extensions page</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      In Chrome address bar, open: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-slate-800">chrome://extensions</code>
                    </p>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      In the top-right corner, turn ON the <strong>"Developer mode"</strong> switch.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">Click "Load unpacked" &amp; choose folder</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Click the <strong>"Load unpacked"</strong> button in the top-left corner, and select the folder you extracted in Step 1.
                    </p>
                    <p className="text-emerald-700 text-[11px] mt-1 font-bold">
                      Done! Once loaded, refresh this page. You will see the green connection indicator above!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowExtensionModal(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer transition text-center"
              >
                Close Setup Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
