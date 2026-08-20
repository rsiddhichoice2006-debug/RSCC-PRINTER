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
import { AuthModal } from './components/AuthModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { auth } from './firebase';
import { OrderRecord, ShopSettings } from './types';
import { apiClient } from './services/apiClient';

function MainApp() {
  const [currentPage, setCurrentPage] = useState<string>('home');
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
    address: 'RSCC Shop, Main Market Road, Opp. SBI Bank, Maharashtra, India',
    phone: '+91 99678 42065',
    email: 'contact@rscc.in',
    upiId: '9967842065@OKBIZAXIS',
    pickupTimings: '9:00 AM - 9:00 PM',
    retentionDays: 7,
    maxFileSizeMb: 50,
    pricing: {
      bwSingle: 5,
      bwBoth: 4,
      colorSingle: 10,
      colorBoth: 7.5,
      photoSheet: 15,
    },
  });

  // Admin authentication state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  // Auto sync admin login when logged in with the official shop admin email
  useEffect(() => {
    if (currentUser?.email?.toLowerCase() === 'rsiddhi.choice.2006@gmail.com') {
      setIsAdminLoggedIn(true);
    }
  }, [currentUser]);

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

  // Called when user clicks "Proceed to Payment" from Document or Photo page
  const handleProceedToPayment = async (orderPayload: any) => {
    // If user is not authenticated yet, require sign-in or sign-up before taking order
    if (!currentUser) {
      openAuthModal(
        'signup',
        'Create Account / Sign In to Place Order & Save Booking',
        async () => {
          // Callback after successful authentication
          try {
            const user = auth.currentUser;
            const enhancedPayload = {
              ...orderPayload,
              userId: user?.uid || orderPayload.userId,
              customer: {
                ...orderPayload.customer,
                name: orderPayload.customer?.name || user?.displayName || user?.email?.split('@')[0] || 'Customer',
                email: orderPayload.customer?.email || user?.email || '',
                mobile: orderPayload.customer?.mobile || '',
              },
            };
            const draftOrder = apiClient.createDraftOrder(enhancedPayload);
            setActiveOrder(draftOrder);
            setCurrentPage('payment');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } catch (err: any) {
            alert('Could not initiate checkout: ' + (err.message || 'Server error'));
          }
        }
      );
      return;
    }

    try {
      // In-memory draft creation (Order is placed to Firestore ONLY after payment is completed)
      const enhancedPayload = {
        ...orderPayload,
        userId: currentUser.uid,
        customer: {
          ...orderPayload.customer,
          name: orderPayload.customer?.name || currentUser.displayName || customerProfile?.name || 'Customer',
          email: orderPayload.customer?.email || currentUser.email || '',
          mobile: orderPayload.customer?.mobile || customerProfile?.mobile || '',
        },
      };
      const draftOrder = apiClient.createDraftOrder(enhancedPayload);
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
        onAdminLogout={() => setIsAdminLoggedIn(false)}
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
          <AdminPage
            settings={settings}
            onUpdateSettings={(newSettings) => setSettings(newSettings)}
            isAdminLoggedIn={isAdminLoggedIn}
            onAdminLoginSuccess={() => setIsAdminLoggedIn(true)}
          />
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
