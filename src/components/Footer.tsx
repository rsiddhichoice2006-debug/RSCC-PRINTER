import React from 'react';
import { Printer, ShieldCheck, MapPin, Phone, Mail, Clock, ArrowRight, Heart, Camera } from 'lucide-react';
import { ShopSettings } from '../types';
import { RsccLogo } from './RsccLogo';

interface FooterProps {
  settings: ShopSettings;
  onNavigate: (page: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ settings, onNavigate }) => {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Col 1: Brand & Bio */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <RsccLogo size="md" className="ring-1 ring-slate-700 shadow-md" />
              <div>
                <h3 className="text-white font-bold tracking-tight text-base">
                  {settings.shopName}
                </h3>
                <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
                  RSCC Online Services
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your trusted local printing destination. Fast online document uploads, instant page detection, A4 photo printing layouts, and secure shop pickup.
            </p>
            <div className="pt-2">
              <span className="inline-block bg-slate-900 border border-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-md font-mono">
                UPI: <span className="text-amber-400 font-bold">{settings.upiId}</span>
              </span>
            </div>
          </div>

          {/* Col 2: Quick Services */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
              Printing Services
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('upload')}
                  className="hover:text-amber-400 transition flex items-center gap-1.5"
                >
                  <ArrowRight className="w-3 h-3 text-amber-500" />
                  A4 Black & White Printing (₹5 / ₹4)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('upload')}
                  className="hover:text-amber-400 transition flex items-center gap-1.5"
                >
                  <ArrowRight className="w-3 h-3 text-amber-500" />
                  A4 Colour Printing (₹10 / ₹7.50)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('photo-layout')}
                  className="hover:text-amber-400 transition flex items-center gap-1.5"
                >
                  <ArrowRight className="w-3 h-3 text-amber-500" />
                  A4 Photo Printing (9, 4, 2, 1 Grid Layouts)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('my-orders')}
                  className="hover:text-amber-400 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-3 h-3 text-amber-500" />
                  My Past Orders & Delivery PINs
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('track')}
                  className="hover:text-amber-400 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-3 h-3 text-amber-500" />
                  Track Live Order Status
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Supported Formats & Security */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
              File Formats & Security
            </h4>
            <p className="text-xs text-slate-400 mb-2.5">
              Supports PDF, DOCX, DOC, PPTX, XLSX, JPG, PNG, TXT & RTF.
            </p>
            <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>Private & Secure Storage</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Uploaded documents are scanned for safety and automatically deleted after {settings.retentionDays} days.
              </p>
            </div>
          </div>

          {/* Col 4: Shop Location & Contact */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
              Shop Location & Hours
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{settings.address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{settings.pickupTimings}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-slate-200 font-medium">{settings.phone}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-400 shrink-0" />
                <span>{settings.email}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-900 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            © {new Date().getFullYear()} {settings.shopName} (RSCC). All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('admin')}
              className="text-slate-600 hover:text-slate-400 transition flex items-center gap-1 text-[11px] cursor-pointer"
              title="Shop Staff Access"
            >
              <ShieldCheck className="w-3 h-3 text-slate-600" />
              <span>Staff Login</span>
            </button>
            <span className="text-slate-800">•</span>
            <span className="text-slate-500">
              Made for Local Indian Business
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
