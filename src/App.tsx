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
import { OrderRecord, ShopSettings } from './types';
import { apiClient } from './services/apiClient';

export default function App() {
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [navigationParams, setNavigationParams] = useState<any>(null);

  // Active Pending / Completed Order in current checkout flow
  const [activeOrder, setActiveOrder] = useState<OrderRecord | null>(null);

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

  // Load shop settings on start
  useEffect(() => {
    apiClient
      .getSettings()
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch((err) => {
        console.warn('Using default settings fallback:', err);
      });
  }, []);

  const handleNavigate = (page: string, params?: any) => {
    setCurrentPage(page);
    setNavigationParams(params || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Called when user clicks "Proceed to Payment" from Document or Photo page
  const handleProceedToPayment = async (orderPayload: any) => {
    try {
      // Authoritative creation on backend with locked amount calculation
      const createdOrder = await apiClient.createOrder(orderPayload);
      setActiveOrder(createdOrder);
      setCurrentPage('payment');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert('Could not initiate order: ' + (err.message || 'Server error'));
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
    </div>
  );
}
