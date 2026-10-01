import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { UploadPrintPage } from './pages/UploadPrintPage';
import { PassportPhotoPage } from './pages/PassportPhotoPage';
import { PhotoLayoutPage } from './pages/PhotoLayoutPage';
import { PaymentPage } from './pages/PaymentPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { TrackOrderPage } from './pages/TrackOrderPage';
import { MyOrdersPage } from './pages/MyOrdersPage';
import { AdminPage } from './pages/AdminPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthModal } from './components/AuthModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { auth } from './firebase';
import { OrderRecord, ShopSettings } from './types';
import { apiClient } from './services/apiClient';

function MainApp() {
  const getInitialPage = () => {
    try {
      const hash = window.location.hash.replace('#', '').trim();
      const validPages = ['home', 'upload', 'passport-photo', 'photo-layout', 'payment', 'confirmation', 'track', 'my-orders', 'admin'];
      if (validPages.includes(hash)) return hash;
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get('page');
      if (pageParam && validPages.includes(pageParam)) return pageParam;
    } catch {}
    return 'home';
  };

  const [currentPage, setCurrentPage] = useState<string>(getInitialPage);
  const [navigationParams, setNavigationParams] = useState<any>(null);

  // Active Pending / Completed Order in current checkout flow
  const [activeOrder, setActiveOrder] = useState<OrderRecord | null>(null);

  // Auth Modal State
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    mode: 'login' | 'signup';
    title?: string;
    onAuthenticated?: () => void;
  }>({
    isOpen: false,
    mode: 'signup',
  });

  const { currentUser, customerProfile } = useAuth();

  // Shop Settings & Pricing State
  const [settings, setSettings] = useState<ShopSettings>({
    shopName: 'Riddhi Siddhi Choice Centre',
    shortName: 'RSCC',
    tagline: 'Online Printing & Document Services',
    address: 'Shop No. 4, Ground Floor, Riddhi Siddhi Choice Centre, Main Market, India',
    phone: '+91 86524 11690',
    whatsapp: '8652411690',
    whatsAppSenderPhone: '8652411690',
    email: 'rsiddhi.choice.2006@gmail.com',
    upiId: '8652411690@OKBIZAXIS',
    pickupTimings: '9:00 AM - 9:00 PM (Monday - Saturday)',
    retentionDays: 30,
    maxFileSizeMb: 50,
    autoNotifyReadyWhatsApp: true,
    whatsappSingleTabMode: true,
    whatsAppDispatchMode: 'DESKTOP_APP',
    pricing: {
      bwSingle: 5,
      bwBoth: 5,
      colorSingle: 10,
      colorBoth: 10,
      photoSheet: 0,
    },
  });

  // Admin authentication state with local persistence
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rscc_admin_session') === 'true';
    } catch {
      return false;
    }
  });

  const handleAdminLoginSuccess = () => {
    setIsAdminLoggedIn(true);
    try {
      localStorage.setItem('rscc_admin_session', 'true');
    } catch {}
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    try {
      localStorage.removeItem('rscc_admin_session');
    } catch {}
    handleNavigate('home');
  };

  // Auto sync admin login when logged in with the official shop admin email
  useEffect(() => {
    if (currentUser?.email?.toLowerCase() === 'rsiddhi.choice.2006@gmail.com') {
      setIsAdminLoggedIn(true);
      try {
        localStorage.setItem('rscc_admin_session', 'true');
      } catch {}
    }
  }, [currentUser]);

  // Sync with browser URL hash for direct links like #admin
  useEffect(() => {
    const handleHash = () => {
      try {
        const hash = window.location.hash.replace('#', '').trim();
        const validPages = ['home', 'upload', 'passport-photo', 'photo-layout', 'payment', 'confirmation', 'track', 'my-orders', 'admin'];
        if (hash && validPages.includes(hash)) {
          setCurrentPage(hash);
        }
      } catch {}
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Load & subscribe to live shop settings & pricing across all devices in real-time
  useEffect(() => {
    // 1. Initial cached/stored load
    apiClient
      .getSettings()
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch((err) => {
        console.warn('Using default settings fallback:', err);
      });

    // 2. Real-time Firestore onSnapshot subscription so all devices update instantly
    const unsubscribe = apiClient.subscribeSettings((liveSettings) => {
      if (liveSettings) {
        setSettings(liveSettings);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleNavigate = (page: string, params?: any) => {
    setCurrentPage(page);
    setNavigationParams(params || null);
    try {
      if (page === 'home') {
        window.history.replaceState(null, '', window.location.pathname);
      } else {
        window.location.hash = page;
      }
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAuthModal = (mode: 'login' | 'signup' = 'login', title?: string, onAuthenticated?: () => void) => {
    setAuthModalState({
      isOpen: true,
      mode,
      title,
      onAuthenticated,
    });
  };

  // Called when user clicks "Proceed to Payment" from Document, Photo, or Passport page
  const handleProceedToPayment = async (orderPayload: any) => {
    try {
      const user = auth.currentUser || currentUser;
      const isCustomerLoggedIn = !!(user || customerProfile);

      // CRITICAL REQUIREMENT: Customers CANNOT place an order unless they are logged in
      if (!isCustomerLoggedIn) {
        openAuthModal('login', 'Customer Login Required to Place Order', () => {
          const updatedUser = auth.currentUser || currentUser;
          const savedStr = localStorage.getItem('rscc_customer_user');
          let savedProfile: any = null;
          if (savedStr) {
            try {
              savedProfile = JSON.parse(savedStr);
            } catch {}
          }
          const finalProfile = customerProfile || savedProfile;
          const enhanced = {
            ...orderPayload,
            userId: updatedUser?.uid || finalProfile?.id || undefined,
            customer: {
              ...orderPayload.customer,
              name: orderPayload.customer?.name || updatedUser?.displayName || finalProfile?.name || 'Customer',
              email: orderPayload.customer?.email || updatedUser?.email || finalProfile?.email || '',
              mobile: orderPayload.customer?.mobile || finalProfile?.mobile || '',
            },
          };
          const draftOrder = apiClient.createDraftOrder(enhanced, settings);
          setActiveOrder(draftOrder);
          setCurrentPage('payment');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        return;
      }

      const enhancedPayload = {
        ...orderPayload,
        userId: user?.uid || customerProfile?.id || orderPayload.userId || undefined,
        customer: {
          ...orderPayload.customer,
          name: orderPayload.customer?.name || user?.displayName || customerProfile?.name || 'Customer',
          email: orderPayload.customer?.email || user?.email || customerProfile?.email || '',
          mobile: orderPayload.customer?.mobile || customerProfile?.mobile || '',
        },
      };
      // Prepare draft order for customer payment.
      // CRITICAL RULE: DO NOT submit or register order to Staff Portal until payment is SUCCESSFUL.
      const draftOrder = apiClient.createDraftOrder(enhancedPayload, settings);
      setActiveOrder(draftOrder);
      setCurrentPage('payment');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert('Could not initiate checkout: ' + (err.message || 'Server error'));
    }
  };

  // Called when payment reference is submitted
  const handlePaymentSubmitted = (updatedOrder: OrderRecord) => {
    setActiveOrder(updatedOrder);
    setCurrentPage('confirmation');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-amber-400 selection:text-slate-950">
      {/* Navigation Header */}
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        settings={settings}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={handleAdminLogout}
        onOpenAuthModal={(mode) => openAuthModal(mode || 'login')}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentPage === 'home' && (
          <HomePage settings={settings} onNavigate={handleNavigate} />
        )}

        {currentPage === 'upload' && (
          <UploadPrintPage
            settings={settings}
            sampleParams={navigationParams?.sample}
            onProceedToPayment={handleProceedToPayment}
          />
        )}

        {currentPage === 'passport-photo' && (
          <PassportPhotoPage
            settings={settings}
            onProceedToPayment={handleProceedToPayment}
          />
        )}

        {currentPage === 'photo-layout' && (
          <PhotoLayoutPage
            settings={settings}
            onProceedToPayment={handleProceedToPayment}
          />
        )}

        {currentPage === 'payment' && activeOrder && (
          <PaymentPage
            order={activeOrder}
            settings={settings}
            onPaymentSubmitted={handlePaymentSubmitted}
            onBackToHome={() => {
              setCurrentPage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onBackToEdit={() => {
              if (activeOrder.mode === 'PASSPORT_PHOTO') {
                setCurrentPage('passport-photo');
              } else if (activeOrder.mode === 'PHOTO') {
                setCurrentPage('photo-layout');
              } else {
                setCurrentPage('upload');
              }
            }}
          />
        )}

        {currentPage === 'confirmation' && activeOrder && (
          <OrderConfirmationPage
            order={activeOrder}
            settings={settings}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'track' && (
          <TrackOrderPage
            settings={settings}
            initialOrderNumber={navigationParams?.orderNumber}
            initialMobile={navigationParams?.mobile}
          />
        )}

        {currentPage === 'my-orders' && (
          <MyOrdersPage
            settings={settings}
            onNavigate={handleNavigate}
            onOpenAuthModal={(mode) => openAuthModal(mode || 'login')}
          />
        )}

        {currentPage === 'admin' && (
          <ErrorBoundary fallbackTitle="Staff Portal Recovery Desk" onReset={() => window.location.reload()}>
            <AdminPage
              settings={settings}
              onUpdateSettings={(newSettings) => setSettings(newSettings)}
              isAdminLoggedIn={isAdminLoggedIn}
              onAdminLoginSuccess={handleAdminLoginSuccess}
              onAdminLogout={handleAdminLogout}
              onNavigateHome={() => handleNavigate('home')}
            />
          </ErrorBoundary>
        )}
      </main>

      {/* Footer */}
      <Footer settings={settings} onNavigate={handleNavigate} />

      {/* Global Authentication Modal */}
      <AuthModal
        isOpen={authModalState.isOpen}
        onClose={() => setAuthModalState((prev) => ({ ...prev, isOpen: false }))}
        initialMode={authModalState.mode}
        title={authModalState.title}
        onAuthenticated={() => {
          if (authModalState.onAuthenticated) {
            authModalState.onAuthenticated();
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
