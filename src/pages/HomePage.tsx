import React from 'react';
import {
  Printer,
  FileText,
  Image as ImageIcon,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Search,
  CheckCircle,
  HelpCircle,
  QrCode,
  Layers,
  MapPin,
  Clock,
  Phone,
} from 'lucide-react';
import { ShopSettings } from '../types';
import { AcceptanceCalculatorWidget } from '../components/AcceptanceCalculatorWidget';

interface HomePageProps {
  settings: ShopSettings;
  onNavigate: (page: string, params?: any) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ settings, onNavigate }) => {
  const p = settings.pricing;

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        {/* Subtle Decorative Backdrop Elements */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 bg-slate-800/90 border border-slate-700 text-amber-400 text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Fast & Affordable Local Printing in India</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white">
              RIDDHI SIDDHI CHOICE CENTRE
            </h1>
            <p className="text-lg sm:text-2xl font-bold text-amber-400 tracking-wide uppercase">
              Online Printing Service
            </p>
          </div>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed">
            Upload your documents, choose your printing preferences, pay securely and collect your prints from our shop.
          </p>

          {/* Primary CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => onNavigate('upload')}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base px-8 py-3.5 rounded-xl shadow-lg hover:shadow-emerald-900/40 transition transform active:scale-95 flex items-center justify-center gap-2.5"
            >
              <Printer className="w-5 h-5 text-emerald-200" />
              <span>START PRINTING</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('photo-layout')}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base px-7 py-3.5 rounded-xl shadow-md transition flex items-center justify-center gap-2"
            >
              <ImageIcon className="w-5 h-5 text-amber-300" />
              <span>A4 PHOTO PRINTING</span>
            </button>

            <button
              onClick={() => onNavigate('track')}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-base px-7 py-3.5 rounded-xl border border-slate-700 transition flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4 text-amber-400" />
              <span>TRACK ORDER</span>
            </button>
          </div>

          {/* Quick Features Highlight */}
          <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-3 flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-white">Auto Page Count</div>
                <div className="text-slate-400 text-[11px]">PDF, Word & Images</div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-3 flex items-center gap-2.5">
              <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-white">Instant UPI Pay</div>
                <div className="text-slate-400 text-[11px]">GPay, PhonePe, Paytm</div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-3 flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-white">Content Safety</div>
                <div className="text-slate-400 text-[11px]">Safe AI Moderation</div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-3 flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-purple-400 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-white">Ready for Pickup</div>
                <div className="text-slate-400 text-[11px]">Collect from Shop</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* 4 Service Cards */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Our Core Printing Services
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Choose from standard office document printing or premium photo layout sheets.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: A4 Black & White */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-900">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">A4 Black & White</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Crisp laser monochrome printing for notes, official forms, exam papers, and legal reports.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Starts from</span>
                <span className="text-lg font-extrabold text-slate-900">₹{p.bwBoth} / ₹{p.bwSingle}</span>
              </div>
            </div>

            {/* Card 2: A4 Colour */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">A4 Colour Printing</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Vibrant high-resolution colour prints for presentations, project charts, certificates, and graphs.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Starts from</span>
                <span className="text-lg font-extrabold text-amber-700">₹{p.colorBoth} / ₹{p.colorSingle}</span>
              </div>
            </div>

            {/* Card 3: Single Side Printing */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Single Side Print</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Printed on one side per sheet. Suitable for single-page letters, certificates, resumes, and posters.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Rate</span>
                <span className="text-sm font-bold text-slate-800">₹{p.bwSingle} (B&W) / ₹{p.colorSingle} (Colour)</span>
              </div>
            </div>

            {/* Card 4: Both Side Printing */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Both Side (Duplex)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Front & back printing for multi-page documents, booklets, manuals, and project books. Save money & paper!
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Discounted Rate</span>
                <span className="text-sm font-bold text-emerald-700">₹{p.bwBoth} (B&W) / ₹{p.colorBoth} (Colour)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Clear Transparent Pricing Table */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                Official Price Card
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Transparent Document Printing Rates
              </h2>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2 rounded-xl text-xs font-medium">
              💡 <strong>Pricing is based on the number of pages in your document.</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* B&W Box */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-700" />
                  BLACK & WHITE (A4)
                </h3>
                <span className="bg-slate-200 text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded">
                  Monochrome
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                  <div className="text-xs text-slate-500 font-medium mb-1">Single Side</div>
                  <div className="text-2xl font-black text-slate-900">₹{p.bwSingle}</div>
                  <div className="text-[11px] text-slate-400">per page</div>
                </div>

                <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 text-center">
                  <div className="text-xs text-emerald-800 font-semibold mb-1">Both Side</div>
                  <div className="text-2xl font-black text-emerald-700">₹{p.bwBoth}</div>
                  <div className="text-[11px] text-emerald-600">per page</div>
                </div>
              </div>
            </div>

            {/* Colour Box */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  COLOUR PRINT (A4)
                </h3>
                <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded">
                  High Quality
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                  <div className="text-xs text-slate-500 font-medium mb-1">Single Side</div>
                  <div className="text-2xl font-black text-slate-900">₹{p.colorSingle}</div>
                  <div className="text-[11px] text-slate-400">per page</div>
                </div>

                <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 text-center">
                  <div className="text-xs text-amber-800 font-semibold mb-1">Both Side</div>
                  <div className="text-2xl font-black text-amber-700">₹{p.colorBoth}</div>
                  <div className="text-[11px] text-amber-600">per page</div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Example Callout for 6-Page Document */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-5 text-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <span>Example Calculation: 6-Page Document</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <div className="font-bold text-slate-900">B&W + Single Side</div>
                <div className="text-slate-600">6 × ₹5 = <strong className="text-slate-900">₹30</strong></div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <div className="font-bold text-slate-900">B&W + Both Side</div>
                <div className="text-slate-600">6 × ₹4 = <strong className="text-emerald-700">₹24</strong></div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <div className="font-bold text-slate-900">Colour + Single Side</div>
                <div className="text-slate-600">6 × ₹10 = <strong className="text-slate-900">₹60</strong></div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <div className="font-bold text-slate-900">Colour + Both Side</div>
                <div className="text-slate-600">6 × ₹7.50 = <strong className="text-amber-700">₹45</strong></div>
              </div>
            </div>

            <p className="text-xs text-blue-900/80 font-medium">
              * Note: Both-side printing does not reduce the number of chargeable pages. The rate changes according to the selected printing option.
            </p>
          </div>
        </section>

        {/* Acceptance Calculator Widget */}
        <AcceptanceCalculatorWidget
          pricing={settings.pricing}
          onApplySample={(params) => {
            onNavigate('upload', { sample: params });
          }}
        />

        {/* A4 Photo Printing Spotlight */}
        <section className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-xl relative overflow-hidden">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                <ImageIcon className="w-3.5 h-3.5" />
                Featured Service
              </div>

              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                A4 Photo Printing Layout Studio
              </h2>

              <p className="text-sm text-indigo-100 leading-relaxed">
                Upload your favourite photos from your phone and arrange them on professional A4 sheets. Choose from <strong>9 Photos (6.7×9.4cm)</strong>, <strong>4 Photos (9×13cm)</strong>, <strong>2 Photos (13×18cm)</strong>, or <strong>1 Full-Page Photo</strong>.
              </p>

              <ul className="space-y-2 text-xs text-indigo-200">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Interactive live A4 canvas preview before ordering</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Drag & drop rearrangement and aspect ratio preservation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Automatic multi-sheet pagination for bulk photo uploads</span>
                </li>
              </ul>

              <div className="pt-2">
                <button
                  onClick={() => onNavigate('photo-layout')}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold px-6 py-3 rounded-xl transition flex items-center gap-2 shadow-lg"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Open Photo Layout Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Layout Cards Showcase */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-center space-y-2">
                <div className="text-2xl font-black text-amber-300">9 Photos</div>
                <div className="text-[11px] text-slate-300 font-mono">6.7 × 9.4 cm each</div>
                <div className="text-[10px] text-slate-400">3 × 3 Grid Layout</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-center space-y-2">
                <div className="text-2xl font-black text-amber-300">4 Photos</div>
                <div className="text-[11px] text-slate-300 font-mono">9 × 13 cm each</div>
                <div className="text-[10px] text-slate-400">2 × 2 Grid Layout</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-center space-y-2">
                <div className="text-2xl font-black text-amber-300">2 Photos</div>
                <div className="text-[11px] text-slate-300 font-mono">13 × 18 cm each</div>
                <div className="text-[10px] text-slate-400">1 × 2 Large Layout</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-center space-y-2">
                <div className="text-2xl font-black text-amber-300">1 Full Page</div>
                <div className="text-[11px] text-slate-300 font-mono">Full A4 Area</div>
                <div className="text-[10px] text-slate-400">Portrait / Landscape</div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works 4-Step Flow */}
        <section className="space-y-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
              Simple 4-Step Ordering
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              How RSCC Online Printing Works
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative space-y-3">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-sm">
                1
              </div>
              <h3 className="font-bold text-slate-900 text-base">Upload Files</h3>
              <p className="text-xs text-slate-600">
                Drag & drop your PDF, Word, PPTX, or Image files from mobile or desktop.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative space-y-3">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-sm">
                2
              </div>
              <h3 className="font-bold text-slate-900 text-base">Select Preferences</h3>
              <p className="text-xs text-slate-600">
                Choose B&W or Colour, Single or Both Side, and number of copies with instant price calculation.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative space-y-3">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-sm">
                3
              </div>
              <h3 className="font-bold text-slate-900 text-base">Pay via UPI QR</h3>
              <p className="text-xs text-slate-600">
                Scan the official RSCC shop QR code or pay directly with GPay, PhonePe, or Paytm.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative space-y-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                4
              </div>
              <h3 className="font-bold text-slate-900 text-base">Collect From Shop</h3>
              <p className="text-xs text-slate-600">
                Track your order timeline and pick up your ready prints from Riddhi Siddhi Choice Centre.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
