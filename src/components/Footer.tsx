import React from 'react';
import { Printer, ShieldCheck, MapPin, Phone, Mail, Clock, ArrowUpRight, Camera, Image as ImageIcon } from 'lucide-react';
import { ShopSettings } from '../types';
import { RsccLogo } from './RsccLogo';

interface FooterProps {
  settings: ShopSettings;
  onNavigate: (page: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ settings, onNavigate }) => {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800/80 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <RsccLogo size="md" className="rounded-xl border border-slate-700/80 shadow-md" />
              <div>
                <h3 className="text-white font-extrabold tracking-tight text-base">
                  {settings.shopName}
                </h3>
                <span className="text-[10px] text-amber-400 font-mono-code uppercase tracking-wider font-semibold">
                  Lab & Online Printing
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Certified digital printing counter and studio photo laboratory. Instant page estimation, ISO-standard passport framing, and secure physical counter pickup.
            </p>
            <div className="pt-1">
              <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-xl font-mono-code">
                <span className="text-slate-500 text-[10px] uppercase font-bold">UPI ID:</span>
                <span className="text-amber-400 font-bold">{settings.upiId}</span>
              </div>
            </div>
          </div>

          {/* Quick Print Services Navigation */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider text-slate-200">
              Services & Formats
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('upload')}
                  className="hover:text-white transition flex items-center justify-between w-full text-left group cursor-pointer"
                >
                  <span className="text-slate-300 group-hover:text-amber-400 transition-colors">A4 Document Printing (B&W & Colour)</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('passport-photo')}
                  className="hover:text-white transition flex items-center justify-between w-full text-left group cursor-pointer"
                >
                  <span className="text-slate-300 group-hover:text-amber-400 transition-colors">Passport Size Photos (10 Pcs Sheet)</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('photo-layout')}
                  className="hover:text-white transition flex items-center justify-between w-full text-left group cursor-pointer"
                >
                  <span className="text-slate-300 group-hover:text-amber-400 transition-colors">A4 Photo Studio Layouts (9, 4, 2, 1)</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('my-orders')}
                  className="hover:text-white transition flex items-center justify-between w-full text-left group cursor-pointer"
                >
                  <span className="text-slate-300 group-hover:text-amber-400 transition-colors">My Past Orders & Collection PINs</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('track')}
                  className="hover:text-white transition flex items-center justify-between w-full text-left group cursor-pointer"
                >
                  <span className="text-slate-300 group-hover:text-amber-400 transition-colors">Real-time Order Status Tracker</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
                </button>
              </li>
            </ul>
          </div>

          {/* Privacy & Storage Commitment */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider text-slate-200">
              Data Privacy & Security
            </h4>
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Encrypted Document Queue</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Customer files are transferred through 256-bit SSL encryption and permanently removed after {settings.retentionDays || 3} days from our private print server.
              </p>
            </div>
          </div>

          {/* Contact Details & Hours */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider text-slate-200">
              Counter Hours & Contact
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-slate-300 leading-relaxed">{settings.address}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{settings.pickupTimings}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="font-semibold text-white">{settings.phone}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-slate-400">{settings.email}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Sub-Footer Bar */}
        <div className="border-t border-slate-900 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} {settings.shopName} (RSCC). All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('admin')}
              className="text-slate-500 hover:text-slate-300 transition flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Staff Login</span>
            </button>
            <span className="text-slate-800">•</span>
            <span className="text-slate-500 font-medium">
              Registered Choice Centre Lab
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
