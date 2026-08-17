import React, { useState } from 'react';
import {
  Printer,
  Image as ImageIcon,
  Search,
  ShieldCheck,
  Phone,
  Clock,
  MapPin,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { ShopSettings } from '../types';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string, params?: any) => void;
  settings: ShopSettings;
  isAdminLoggedIn: boolean;
  onAdminLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  settings,
  isAdminLoggedIn,
  onAdminLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shopInfoModal, setShopInfoModal] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home', icon: null },
    { id: 'upload', label: 'Document Printing', icon: Printer },
    { id: 'photo-layout', label: 'A4 Photo Printing', icon: ImageIcon, badge: 'New' },
    { id: 'my-orders', label: 'My Orders', icon: Search },
    { id: 'track', label: 'Track Order', icon: Clock },
    {
      id: 'admin',
      label: isAdminLoggedIn ? 'Admin Dashboard' : 'Admin Portal',
      icon: ShieldCheck,
      badge: isAdminLoggedIn ? 'Logged In' : undefined,
    },
  ];

  return (
    <>
      {/* Top Shop Quick Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Shop Open Today: {settings.pickupTimings}
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-slate-400">
              <MapPin className="w-3 h-3 text-amber-400" />
              RSCC Shop, Main Market
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShopInfoModal(true)}
              className="text-slate-300 hover:text-white transition flex items-center gap-1 underline underline-offset-2"
            >
              <Phone className="w-3 h-3 text-amber-400" />
              {settings.phone}
            </button>
            <span className="text-slate-600">|</span>
            <span className="text-amber-300 font-mono text-[11px]">
              UPI: {settings.upiId}
            </span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18">
            {/* Brand Logo & Name */}
            <div
              onClick={() => onNavigate('home')}
              className="flex items-center gap-3 cursor-pointer group select-none"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition">
                <Printer className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-900 text-lg tracking-tight">
                    RIDDHI SIDDHI
                  </span>
                  <span className="bg-amber-100 text-amber-900 text-[11px] font-bold px-1.5 py-0.5 rounded border border-amber-300">
                    RSCC
                  </span>
                </div>
                <p className="text-xs text-slate-700 font-medium">
                  Choice Centre • Online Printing & Photos
                </p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                    }}
                    className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-800 hover:text-slate-950 hover:bg-slate-100'
                    }`}
                  >
                    {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-600'}`} />}
                    {item.label}
                    {item.badge && (
                      <span className="ml-1 bg-amber-500 text-slate-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-bounce">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Action Buttons */}
            <div className="hidden sm:flex items-center gap-2">
              {!isAdminLoggedIn ? (
                <button
                  onClick={() => onNavigate('admin')}
                  className="text-xs font-bold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  title="Shop Admin Portal Login"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Admin Portal</span>
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('admin')}
                  className="text-xs font-black text-amber-950 bg-amber-100 border border-amber-300 hover:bg-amber-200 px-3 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  <span>Admin Panel</span>
                </button>
              )}

              <button
                onClick={() => onNavigate('upload')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm hover:shadow transition flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-200" />
                <span>Upload & Print</span>
              </button>

              {isAdminLoggedIn && (
                <button
                  onClick={onAdminLogout}
                  className="text-xs text-rose-600 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                >
                  Logout
                </button>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <div className="lg:hidden flex items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition"
                aria-label="Toggle Navigation"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2 shadow-lg">
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
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {Icon && <Icon className="w-4 h-4 text-amber-500" />}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-amber-500 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  onNavigate('upload');
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-lg text-center flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Start Document Printing
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Shop Info Modal */}
      {shopInfoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShopInfoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
                RSCC
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  {settings.shopName}
                </h3>
                <p className="text-xs text-slate-500">{settings.tagline}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">Shop Address:</div>
                  <div>{settings.address}</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">Working Hours:</div>
                  <div>{settings.pickupTimings}</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">Contact / WhatsApp:</div>
                  <div>{settings.phone}</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">Official UPI ID:</div>
                  <div className="font-mono text-xs font-bold text-slate-900 bg-amber-100 text-amber-950 px-2 py-0.5 rounded inline-block mt-0.5">
                    {settings.upiId}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={() => setShopInfoModal(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
