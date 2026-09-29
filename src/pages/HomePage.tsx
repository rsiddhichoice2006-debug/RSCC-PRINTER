import React, { useState } from 'react';
import {
  Printer,
  FileText,
  Image as ImageIcon,
  Camera,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Search,
  CheckCircle2,
  HelpCircle,
  QrCode,
  Layers,
  MapPin,
  Clock,
  Phone,
  ShieldAlert,
  ArrowUpRight,
  Sliders,
  Check,
  ChevronRight,
  Flame,
  Award,
} from 'lucide-react';
import { ShopSettings } from '../types';
import { RsccLogo } from '../components/RsccLogo';

interface HomePageProps {
  settings: ShopSettings;
  onNavigate: (page: string, params?: any) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ settings, onNavigate }) => {
  const p = settings.pricing;

  return (
    <div className="space-y-20 pb-16">
      {/* Hero Section - Asymmetrical Editorial Layout */}
      <section className="relative bg-slate-950 text-white border-b border-slate-800/90 overflow-hidden pt-12 sm:pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        {/* Subtle grid texture */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 space-y-10">
          {/* Order Intake Pause Alert */}
          {settings.isAcceptingOrders === false && (
            <div className="bg-rose-950/90 border border-rose-800 rounded-2xl p-5 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-900 border border-rose-700 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5 text-rose-300" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="bg-rose-900 text-rose-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                      Notice
                    </span>
                    <span className="font-bold text-sm sm:text-base text-rose-100">
                      {settings.pauseOrderReason || 'Online order queue temporarily paused'}
                    </span>
                  </div>
                  <p className="text-xs text-rose-300/90 leading-relaxed">
                    Online print queues are on hold to clear pending jobs. In-person desk is open at {settings.address}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Asymmetrical Grid: Left Headline & Action + Right Quick Estimator */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Col (7 cols): Editorial Typography & Direct CTAs */}
            <div className="lg:col-span-7 space-y-6 text-left">
              {/* Studio Status Pill & Shop Name */}
              <div className="space-y-2.5">
                <div className="inline-flex items-center gap-2 bg-slate-900/90 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-full font-medium shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-slate-200 font-bold">{settings.shopName || 'Choice Centre Print Lab'}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-amber-400 font-mono-code font-bold">Counter Open</span>
                </div>

                {/* Delivery Starting Soon with Red Light Blinking */}
                <div>
                  <div className="inline-flex items-center gap-2.5 bg-red-950/90 border border-red-600/80 text-red-200 text-xs px-3.5 py-1.5 rounded-full font-black shadow-lg">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-90"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                    </span>
                    <span className="text-red-400 uppercase tracking-wider font-extrabold text-[11px] sm:text-xs">
                      Delivery Starting Soon
                    </span>
                  </div>
                </div>
              </div>

              {/* Display Headline */}
              <div className="space-y-3">
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
                  Precision Digital Printing & Passport Studio.
                </h1>
                <p className="text-sm sm:text-base text-slate-300 max-w-xl font-normal leading-relaxed">
                  Upload your documents and portrait photographs online. Get automated ISO-framing, instant page billing, and pickup ready at our physical counter.
                </p>
              </div>

              {/* Primary Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => onNavigate('upload')}
                  className="bg-white hover:bg-slate-100 text-slate-950 font-extrabold text-xs sm:text-sm px-5 py-3 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm btn-elevated"
                >
                  <Printer className="w-4 h-4 text-slate-950" />
                  <span>Document Printing</span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => onNavigate('passport-photo')}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm px-5 py-3 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm btn-elevated"
                >
                  <Camera className="w-4 h-4 text-slate-950" />
                  <span>Passport Studio (10 Pcs)</span>
                </button>

                <button
                  onClick={() => onNavigate('photo-layout')}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs sm:text-sm px-4 py-3 rounded-xl border border-slate-800 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <span>A4 Photo Sheets</span>
                </button>

                <button
                  onClick={() => onNavigate('track')}
                  className="text-slate-400 hover:text-white font-medium text-xs px-3 py-3 transition-colors flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Track Status</span>
                </button>
              </div>
            </div>

            {/* Right Col (5 cols): Official Studio Rates & Quick Counter Access Card */}
            <div className="lg:col-span-5">
              <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 text-left relative">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] text-amber-400 font-mono-code uppercase tracking-wider font-bold">
                      Direct Counter Rates
                    </span>
                    <h3 className="text-base font-extrabold text-white tracking-tight">
                      Official Transparent Pricing
                    </h3>
                  </div>
                  <span className="bg-emerald-950/80 text-emerald-300 text-[11px] font-mono-code px-2.5 py-1 rounded-lg border border-emerald-800/60 font-semibold">
                    Fixed Rates
                  </span>
                </div>

                <div className="space-y-3">
                  {/* B&W 5 Rupee Single / 4 Rupee Double */}
                  <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 flex items-center justify-between transition hover:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center font-bold text-xs">
                        B&W
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Black & White Print</div>
                        <div className="text-xs text-slate-400">Single ₹5 • Double ₹4 • Extra sets from ₹2/pg</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-white font-mono-code">₹5 <span className="text-xs text-slate-400 font-normal">/ ₹4</span></div>
                      <div className="text-[10px] text-slate-400 font-medium">per page</div>
                    </div>
                  </div>

                  {/* Colour 10 Rupee */}
                  <div className="bg-slate-950/80 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between transition hover:border-amber-500/40">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center font-bold text-xs">
                        COL
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Colour Print</div>
                        <div className="text-xs text-slate-400">100 GSM • High-def laser colour</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-amber-400 font-mono-code">₹10</div>
                      <div className="text-[10px] text-slate-400 font-medium">per page</div>
                    </div>
                  </div>

                  {/* Passport Photo Studio */}
                  <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 flex items-center justify-between transition hover:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 flex items-center justify-center font-bold text-xs">
                        PAS
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Passport Photo Studio</div>
                        <div className="text-xs text-slate-400">10 Photos • Auto background & framing</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-white font-mono-code">₹50</div>
                      <div className="text-[10px] text-slate-400 font-medium">10 photos sheet</div>
                    </div>
                  </div>
                </div>

                {/* Direct Order Actions */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => onNavigate('upload')}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black py-3 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md btn-elevated"
                  >
                    <span>Upload Documents</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onNavigate('passport-photo')}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-3 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                  >
                    <span>Passport Studio</span>
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        {/* Asymmetrical Bento Grid of Core Printing Modules */}
        <section className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-mono-code font-bold text-amber-600 uppercase tracking-wider">
                Services & Modules
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
                Specialized Printing Solutions
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-sm">
              Tailored for official submissions, academic papers, and high-gloss portrait photography.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Bento Card 1: Passport Photo Studio (Spans 7 cols on desktop) */}
            <div
              onClick={() => onNavigate('passport-photo')}
              className="lg:col-span-7 bg-white rounded-3xl p-7 sm:p-8 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between cursor-pointer group card-elevated relative overflow-hidden"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-950 border border-amber-300/60 flex items-center justify-center font-bold">
                    <Camera className="w-6 h-6 text-amber-800" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-950 text-white text-[10px] font-mono-code font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      ISO/ICAO Standard
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight group-hover:text-amber-800 transition-colors">
                    Passport Size Photo Studio
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
                    Upload any uncropped picture. Our studio engine removes background cleanly, frames at official 32×40mm chest level, and produces a physical 10-piece glossy photo sheet.
                  </p>
                </div>

                {/* Features Checklist */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs text-slate-700">
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>White, Blue & Grey solid backdrops</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Zero color bleeding on garments</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Auto 32×40mm facial centering</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>250 GSM Ultra-Gloss photographic stock</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Print Package</span>
                  <div className="text-sm font-extrabold text-slate-950">10 Photographs Sheet</div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 group-hover:translate-x-1 transition-transform">
                  <span>Open Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Bento Card 2: A4 Photo Layout Studio (Spans 5 cols on desktop) */}
            <div
              onClick={() => onNavigate('photo-layout')}
              className="lg:col-span-5 bg-slate-900 text-white rounded-3xl p-7 sm:p-8 border border-slate-800 shadow-2xs hover:border-slate-700 transition-all flex flex-col justify-between cursor-pointer group card-elevated"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-amber-400 border border-slate-700 flex items-center justify-center font-bold">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <span className="bg-amber-400/20 text-amber-300 text-[10px] font-mono-code font-bold px-2 py-0.5 rounded border border-amber-400/40">
                    A4 100 GSM Paper
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-extrabold text-white tracking-tight group-hover:text-amber-300 transition-colors">
                    A4 Photo Layout Sheets
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Arrange mobile snapshots onto premium 100 GSM A4 paper with interactive canvas rearrangement and multi-sheet support.
                  </p>
                </div>

                {/* 4 Layout Grid Indicators */}
                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 text-left">
                    <span className="text-amber-400 font-bold font-mono-code block">9 Photos</span>
                    <span className="text-slate-400 text-[10px]">6.7 × 9.4 cm grid</span>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 text-left">
                    <span className="text-amber-400 font-bold font-mono-code block">4 Photos</span>
                    <span className="text-slate-400 text-[10px]">9 × 13 cm grid</span>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 text-left">
                    <span className="text-amber-400 font-bold font-mono-code block">2 Photos</span>
                    <span className="text-slate-400 text-[10px]">13 × 18 cm large</span>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 text-left">
                    <span className="text-amber-400 font-bold font-mono-code block">1 Full A4</span>
                    <span className="text-slate-400 text-[10px]">Poster layout</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
                <span>Configure Layouts</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </section>

        {/* Clear Transparent Rate Structure */}
        <section className="bg-white rounded-3xl p-7 sm:p-10 border border-slate-200/90 shadow-2xs space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div className="space-y-1">
              <span className="text-xs font-mono-code font-bold text-amber-600 uppercase tracking-wider">
                Official Price Card
              </span>
              <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                Clear & Transparent Page Rates
              </h2>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs text-slate-600 font-medium">
              💡 Billing is strictly based on readable document pages.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monochrome Box */}
            <div className="bg-slate-50/70 rounded-2xl p-6 border border-slate-200/80 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-950 text-white flex items-center justify-center text-xs font-bold">
                    BW
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-950 text-base">Black & White (A4)</h3>
                    <p className="text-[11px] text-slate-500">Sharp monochrome laser output</p>
                  </div>
                </div>
                <span className="bg-slate-200 text-slate-800 text-[10px] font-mono-code font-bold px-2 py-0.5 rounded">
                  Laser
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 text-left">
                  <div className="text-[11px] text-slate-500 font-medium">Single Side</div>
                  <div className="text-2xl font-extrabold text-slate-950 font-mono-code mt-0.5">₹{Math.max(5, p?.bwSingle || 5)}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">per printed page</div>
                </div>

                <div className="bg-slate-100/70 p-4 rounded-xl border border-slate-200/80 text-left">
                  <div className="text-[11px] text-slate-700 font-semibold">Both Side (Duplex)</div>
                  <div className="text-2xl font-extrabold text-slate-900 font-mono-code mt-0.5">₹{p.bwBoth || 4}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">per printed page</div>
                </div>
              </div>
            </div>

            {/* Colour Box */}
            <div className="bg-slate-50/70 rounded-2xl p-6 border border-slate-200/80 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center text-xs font-bold">
                    COL
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-950 text-base">Colour Print (A4)</h3>
                    <p className="text-[11px] text-slate-500">High-definition inkjet / laser</p>
                  </div>
                </div>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-mono-code font-bold px-2 py-0.5 rounded border border-amber-300/60">
                  Vibrant
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 text-left">
                  <div className="text-[11px] text-slate-500 font-medium">Single Side</div>
                  <div className="text-2xl font-extrabold text-slate-950 font-mono-code mt-0.5">₹{p.colorSingle || 10}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">per printed page</div>
                </div>

                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/80 text-left">
                  <div className="text-[11px] text-amber-900 font-semibold">Both Side (Duplex)</div>
                  <div className="text-2xl font-extrabold text-amber-800 font-mono-code mt-0.5">₹{p.colorBoth || 10}</div>
                  <div className="text-[10px] text-amber-700 mt-0.5">per printed page</div>
                </div>
              </div>
            </div>
          </div>

          {/* Transparent 6-Page Specimen Callout */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>Calculation Breakdown for a 6-Page PDF Document:</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-slate-500 text-[10px]">B&W Single Side</div>
                <div className="font-bold text-slate-950 font-mono-code mt-1">6 × ₹{p.bwSingle || 5} = ₹{6 * (p.bwSingle || 5)}</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-slate-700 text-[10px] font-semibold">B&W Both Side</div>
                <div className="font-bold text-slate-900 font-mono-code mt-1">6 × ₹{p.bwBoth || 4} = ₹{6 * (p.bwBoth || 4)}</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-slate-500 text-[10px]">Colour Single Side</div>
                <div className="font-bold text-slate-950 font-mono-code mt-1">6 × ₹{p.colorSingle || 10} = ₹{6 * (p.colorSingle || 10)}</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-amber-800 text-[10px] font-semibold">Colour Both Side</div>
                <div className="font-bold text-amber-900 font-mono-code mt-1">6 × ₹{p.colorBoth || 10} = ₹{6 * (p.colorBoth || 10)}</div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works - High-End Sequential Timeline */}
        <section className="space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-1">
            <span className="text-xs font-mono-code font-bold text-amber-600 uppercase tracking-wider">
              Operation Flow
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              Simple 4-Step Counter Fulfillment
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-7 h-7 rounded-lg bg-slate-950 text-white font-mono-code font-bold text-xs flex items-center justify-center">
                01
              </div>
              <h3 className="font-bold text-slate-950 text-sm">Upload Source File</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Attach your PDF, DOCX, or uncropped portrait photo directly through our encrypted portal.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-7 h-7 rounded-lg bg-slate-950 text-white font-mono-code font-bold text-xs flex items-center justify-center">
                02
              </div>
              <h3 className="font-bold text-slate-950 text-sm">Configure Parameters</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Choose color mode, single/duplex layout, and backdrop color with live calculation.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-mono-code font-bold text-xs flex items-center justify-center">
                03
              </div>
              <h3 className="font-bold text-slate-950 text-sm">Pay via Razorpay</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Complete payment instantly via UPI, Google Pay, PhonePe, Cards, or NetBanking through Razorpay.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-mono-code font-bold text-xs flex items-center justify-center">
                04
              </div>
              <h3 className="font-bold text-slate-950 text-sm">In-Store Collection</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Show your 4-digit security PIN at Riddhi Siddhi Choice Centre counter and collect prints.
              </p>
            </div>
          </div>
        </section>

        {/* Counter Location & Assurance Banner */}
        <section className="bg-slate-900 text-white rounded-3xl p-8 sm:p-10 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 text-amber-400 text-xs font-mono-code font-bold">
              <MapPin className="w-3.5 h-3.5" />
              <span>Physical Counter Pickup</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Riddhi Siddhi Choice Centre (RSCC)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {settings.address} • Daily Counter Timings: {settings.pickupTimings}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('upload')}
              className="bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold px-5 py-3 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs btn-elevated"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>Start Printing</span>
            </button>
            <button
              onClick={() => onNavigate('track')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-3 rounded-xl border border-slate-700 transition flex items-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4 text-amber-400" />
              <span>Check Existing Order</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
