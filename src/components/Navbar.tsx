import React, { useState } from 'react';
import {
  Printer,
  Image as ImageIcon,
  Camera,
  Search,
  ShieldCheck,
  Phone,
  Clock,
  MapPin,
  Menu,
  X,
  Sparkles,
  User,
  LogOut,
  LogIn,
  UserPlus,
  Ban,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { ShopSettings } from '../types';
import { RsccLogo } from './RsccLogo';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string, params?: any) => void;
  settings: ShopSettings;
  isAdminLoggedIn: boolean;
  onAdminLogout: () => void;
  onOpenAuthModal?: (mode?: 'login' | 'signup') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  settings,
  isAdminLoggedIn,
  onAdminLogout,
  onOpenAuthModal,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shopInfoModal, setShopInfoModal] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { currentUser, customerProfile, logout } = useAuth();

  const navItems = [
    { id: 'home', label: 'Overview', icon: null },
    { id: 'upload', label: 'Document Printing', icon: Printer },
    { id: 'passport-photo', label: 'Passport Photo Studio', icon: Camera, badge: 'Standard' },
    { id: 'photo-layout', label: 'A4 Photo Sheets', icon: ImageIcon },
    { id: 'my-orders', label: 'My Bookings', icon: Search },
    { id: 'track', label: 'Live Tracking', icon: Clock },
  ];

  return (
    <>
      {/* Top Shop Status & Contact Utility Strip */}
      <div className="bg-slate-950 text-slate-300 text-xs py-2 px-4 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-5">
            {settings.isAcceptingOrders === false ? (
              <span className="flex items-center gap-1.5 text-rose-400 font-semibold bg-rose-950/80 px-2.5 py-0.5 rounded-md border border-rose-800 text-[11px]">
                <Ban className="w-3.5 h-3.5 text-rose-400" />
                <span>Orders Paused: {settings.pauseOrderReason || 'High Demand'}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2 text-emerald-400 font-medium text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Counter Open: {settings.pickupTimings}</span>
              </span>
            )}
            <span className="hidden md:inline-flex items-center gap-1.5 text-slate-400 text-xs">
              <MapPin className="w-3.5 h-3.5 text-amber-400/90" />
              <span>{settings.address || 'RSCC Shop, Main Market'}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-xs">
            <button
              onClick={() => setShopInfoModal(true)}
              className="text-slate-300 hover:text-white transition flex items-center gap-1.5 group cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="font-medium">{settings.phone}</span>
            </button>
            <span className="text-slate-700 hidden sm:inline">|</span>
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px]">
              <span className="text-emerald-400 font-bold">⚡ Razorpay Verified</span>
              <span className="text-slate-400 text-[10px]">Secure Payments</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Notice when Not Accepting Orders */}
      {settings.isAcceptingOrders === false && (
        <div className="bg-rose-950 border-b border-rose-900 text-rose-100 px-4 py-2.5 shadow-sm text-center text-xs sm:text-sm font-medium flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Service Notice:</strong> {settings.pauseOrderReason || 'Online order queue is temporarily full to complete pending print jobs'}. In-store counter remains open.
          </span>
        </div>
      )}

      {/* Main Studio Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-[4.25rem] py-2 gap-4 relative">
            {/* Brand Identity */}
            <div
              onClick={() => onNavigate('home')}
              className="flex items-center gap-3 cursor-pointer group select-none py-1 shrink-0 z-10"
            >
              <RsccLogo size="md" className="group-hover:shadow-sm transition-all rounded-xl border border-slate-200 shrink-0" />
              <div className="shrink-0 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-950 text-base sm:text-lg tracking-tight whitespace-nowrap">
                    RIDDHI SIDDHI
                  </span>
                  <span className="bg-slate-950 text-amber-400 text-[10px] font-mono-code font-bold px-1.5 py-0.5 rounded tracking-wide shrink-0">
                    RSCC
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium tracking-wide whitespace-nowrap">
                  Choice Centre • Digital Print & Photo Lab
                </p>
              </div>
            </div>

            {/* Desktop Navigation Links (Visible on XL screens to prevent crowding and overlapping the brand name) */}
            <nav className="hidden xl:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`relative px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-white text-slate-950 shadow-2xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                    }`}
                  >
                    {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />}
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-1 bg-amber-500/20 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-400/40">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Action Suite */}
            <div className="hidden sm:flex items-center gap-2.5">
              {/* Customer Account Button */}
              {(currentUser || customerProfile) ? (
                <div className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="text-xs font-semibold text-slate-800 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <div className="w-5 h-5 rounded-md bg-slate-950 text-amber-400 flex items-center justify-center font-bold text-[10px]">
                      {(customerProfile?.name || currentUser?.displayName || currentUser?.email || 'U')[0].toUpperCase()}
                    </div>
                    <span className="max-w-[110px] truncate">
                      {customerProfile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || customerProfile?.mobile || 'Account'}
                    </span>
                  </button>

                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 divide-y divide-slate-100">
                      <div className="px-3.5 py-2">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {customerProfile?.name || currentUser?.displayName || 'Verified Customer'}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono-code truncate mt-0.5">
                          {customerProfile?.mobile ? `+91 ${customerProfile.mobile}` : currentUser?.email || 'Customer ID: ' + (customerProfile?.id || '')}
                        </p>
                      </div>

                      <div className="py-1">
                        {(isAdminLoggedIn || currentUser?.email?.toLowerCase() === 'rsiddhi.choice.2006@gmail.com') && (
                          <button
                            onClick={() => {
                              setUserDropdownOpen(false);
                              onNavigate('admin');
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-bold text-amber-950 bg-amber-50/80 hover:bg-amber-100/80 flex items-center gap-2 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                            <span>Staff Admin Desk</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            onNavigate('my-orders');
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <Search className="w-3.5 h-3.5 text-slate-400" />
                          <span>My Bookings & PINs</span>
                        </button>
                      </div>

                      <div className="pt-1">
                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            logout();
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <LogOut className="w-3.5 h-3.5 text-rose-500" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => onOpenAuthModal && onOpenAuthModal('login')}
                  className="text-xs font-bold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sign In</span>
                </button>
              )}

              {/* Authorized Staff Badge */}
              {(isAdminLoggedIn || currentUser?.email?.toLowerCase() === 'rsiddhi.choice.2006@gmail.com') && (
                <button
                  onClick={() => onNavigate('admin')}
                  className="text-xs font-bold text-slate-900 bg-amber-100/90 border border-amber-300 hover:bg-amber-200/90 px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-800" />
                  <span>Staff Portal</span>
                </button>
              )}

              {/* Primary Document Upload CTA */}
              <button
                onClick={() => onNavigate('upload')}
                className="bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer btn-elevated"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Upload & Print</span>
              </button>

              {isAdminLoggedIn && (
                <button
                  onClick={onAdminLogout}
                  className="text-xs text-rose-600 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                >
                  Logout Admin
                </button>
              )}
            </div>

            {/* Mobile / Tablet Menu Toggle Button */}
            <div className="xl:hidden flex items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition border border-slate-200"
                aria-label="Toggle Navigation"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Flyout Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2 shadow-xl animate-in slide-in-from-top-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
                    isActive
                      ? 'bg-slate-950 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-amber-400 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="pt-3 border-t border-slate-100 space-y-2">
              {(currentUser || customerProfile) ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-950 text-amber-400 flex items-center justify-center font-bold text-xs">
                      {(customerProfile?.name || currentUser?.displayName || currentUser?.email || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {customerProfile?.name || currentUser?.displayName || 'Customer'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono-code truncate">
                        {customerProfile?.mobile ? `+91 ${customerProfile.mobile}` : currentUser?.email || 'Customer'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg transition"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuthModal && onOpenAuthModal('login');
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Customer Sign In / Register</span>
                </button>
              )}

              <button
                onClick={() => {
                  onNavigate('upload');
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl text-center flex items-center justify-center gap-2 shadow-xs"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>Upload Document & Print</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Shop Info Dialog Modal */}
      {shopInfoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShopInfoModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3.5 mb-5">
              <RsccLogo size="lg" className="rounded-2xl border border-slate-200 shadow-2xs" />
              <div>
                <h3 className="font-extrabold text-slate-950 text-lg tracking-tight">
                  {settings.shopName}
                </h3>
                <p className="text-xs text-slate-500 font-medium">{settings.tagline || 'Choice Centre & Studio Print Lab'}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Physical Address:</div>
                  <div className="text-slate-600 mt-0.5 leading-relaxed">{settings.address}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Counter Working Hours:</div>
                  <div className="text-slate-600 mt-0.5">{settings.pickupTimings}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Contact / WhatsApp:</div>
                  <div className="text-slate-600 mt-0.5 font-medium">{settings.phone}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Online Payments:</div>
                  <div className="text-xs font-bold text-slate-700 inline-flex items-center gap-1 mt-0.5">
                    <span className="text-indigo-600 font-black">Razorpay Gateway</span>
                    <span className="text-slate-500">(UPI, GPay, PhonePe, Cards, NetBanking)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShopInfoModal(false)}
                className="w-full bg-slate-950 hover:bg-slate-800 text-white font-bold py-3 rounded-2xl transition shadow-xs text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
