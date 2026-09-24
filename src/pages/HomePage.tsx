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
import { AcceptanceCalculatorWidget } from '../components/AcceptanceCalculatorWidget';
import { RsccLogo } from '../components/RsccLogo';

interface HomePageProps {
  settings: ShopSettings;
  onNavigate: (page: string, params?: any) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ settings, onNavigate }) => {
  const p = settings.pricing;

  // Quick interactive hero estimator state
  const [quickPages, setQuickPages] = useState<number>(5);
  const [quickPrintType, setQuickPrintType] = useState<'bw' | 'color'>('bw');
  const [quickSide, setQuickSide] = useState<'single' | 'both'>('single');

  const calculateQuickEstimate = () => {
    const rate =
      quickPrintType === 'bw'
        ? quickSide === 'single'
          ? p.bwSingle
          : p.bwBoth
        : quickSide === 'single'
        ? p.colorSingle
        : p.colorBoth;
    return quickPages * rate;
  };

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
              {/* Studio Status Pill */}
              <div className="inline-flex items-center gap-2 bg-slate-900/90 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-full font-medium shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-slate-200">Choice Centre Print Lab</span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-400 font-mono-code font-bold">Counter Open</span>
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

              {/* Proof Strip */}
              <div className="pt-4 grid grid-cols-3 gap-4 border-t border-slate-900 text-xs">
                <div>
                  <div className="text-white font-bold font-mono-code text-sm sm:text-base">1200 DPI</div>
                  <div className="text-slate-400 text-[11px]">Laser Precision</div>
                </div>
                <div>
                  <div className="text-white font-bold font-mono-code text-sm sm:text-base">250 GSM</div>
                  <div className="text-slate-400 text-[11px]">Lab Glossy Stock</div>
                </div>
                <div>
                  <div className="text-white font-bold font-mono-code text-sm sm:text-base">Instant PIN</div>
                  <div className="text-slate-400 text-[11px]">Secure Collection</div>
                </div>
              </div>
            </div>

            {/* Right Col (5 cols): Interactive Quick Estimator Card */}
            <div className="lg:col-span-5">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-left relative">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] text-amber-400 font-mono-code uppercase tracking-wider font-semibold">
                      Live Estimator
                    </span>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Calculate Print Cost
                    </h3>
                  </div>
                  <span className="bg-slate-800 text-slate-300 text-[11px] font-mono-code px-2.5 py-1 rounded-lg border border-slate-700">
                    A4 Size
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Page Count Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Document Page Count:</span>
                      <span className="font-bold text-white font-mono-code bg-slate-800 px-2 py-0.5 rounded">
                        {quickPages} {quickPages === 1 ? 'Page' : 'Pages'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={quickPages}
                      onChange={(e) => setQuickPages(parseInt(e.target.value) || 1)}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>

                  {/* Print Color Mode */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 block">Print Mode:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setQuickPrintType('bw')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                          quickPrintType === 'bw'
                            ? 'bg-slate-800 text-white border-amber-400/80 shadow-xs'
                            : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span>Black & White</span>
                        <span className="text-[10px] font-mono-code text-slate-400">₹{p.bwSingle}/pg</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuickPrintType('color')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                          quickPrintType === 'color'
                            ? 'bg-slate-800 text-white border-amber-400/80 shadow-xs'
                            : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span>Colour Print</span>
                        <span className="text-[10px] font-mono-code text-amber-400">₹{p.colorSingle}/pg</span>
                      </button>
                    </div>
                  </div>

                  {/* Sides Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 block">Layout Side:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setQuickSide('single')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                          quickSide === 'single'
                            ? 'bg-slate-800 text-white border-amber-400/80 shadow-xs'
                            : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span>Single Side</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuickSide('both')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                          quickSide === 'both'
                            ? 'bg-slate-800 text-white border-amber-400/80 shadow-xs'
                            : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span>Both Side (Duplex)</span>
                        <span className="text-[9px] bg-emerald-950 text-emerald-300 font-bold px-1.5 py-0.5 rounded">
                          Save
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Estimate Result Box */}
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Estimated Amount</span>
                    <div className="text-2xl font-extrabold text-white font-mono-code">
                      ₹{calculateQuickEstimate()}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      onNavigate('upload', {
                        sample: {
                          pages: quickPages,
                          printType: quickPrintType,
                          sides: quickSide,
                        },
                      })
                    }
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs btn-elevated"
                  >
                    <span>Print This</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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
                    Upload any uncropped picture. Our studio engine removes background cleanly, frames at official 35×45mm chest level, and produces a physical 10-piece glossy photo sheet.
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
                    <span>Auto ISO 35×45mm facial centering</span>
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
                    A4 Photo Sheet
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-extrabold text-white tracking-tight group-hover:text-amber-300 transition-colors">
                    A4 Photo Layout Sheets
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Arrange mobile snapshots onto premium A4 photographic paper with interactive canvas rearrangement and multi-sheet support.
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

            {/* Bento Card 3: Standard Office & Document Printing (Full width 12 cols) */}
            <div
              onClick={() => onNavigate('upload')}
              className="lg:col-span-12 bg-white rounded-3xl p-7 sm:p-8 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6 cursor-pointer group card-elevated"
            >
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-900 border border-slate-200">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-950 tracking-tight group-hover:text-slate-800">
                      General Document Printing (PDF, DOCX, PPTX)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Standard laser monochrome & vibrant colour printing for contracts, legal forms, college projects, and certificates.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 shrink-0">
                <div className="text-left md:text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Base Pricing</span>
                  <span className="text-base font-extrabold text-slate-950 font-mono-code">
                    B&W ₹{p.bwBoth} / Colour ₹{p.colorBoth}
                  </span>
                </div>
                <button
                  type="button"
                  className="bg-slate-950 group-hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-2"
                >
                  <span>Upload Document</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
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
                  <div className="text-2xl font-extrabold text-slate-950 font-mono-code mt-0.5">₹{p.bwSingle}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">per printed page</div>
                </div>

                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/80 text-left">
                  <div className="text-[11px] text-emerald-900 font-semibold">Both Side (Duplex)</div>
                  <div className="text-2xl font-extrabold text-emerald-800 font-mono-code mt-0.5">₹{p.bwBoth}</div>
                  <div className="text-[10px] text-emerald-700 mt-0.5">per printed page</div>
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
                  <div className="text-2xl font-extrabold text-slate-950 font-mono-code mt-0.5">₹{p.colorSingle}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">per printed page</div>
                </div>

                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/80 text-left">
                  <div className="text-[11px] text-amber-900 font-semibold">Both Side (Duplex)</div>
                  <div className="text-2xl font-extrabold text-amber-800 font-mono-code mt-0.5">₹{p.colorBoth}</div>
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
                <div className="font-bold text-slate-950 font-mono-code mt-1">6 × ₹5 = ₹30</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-emerald-800 text-[10px] font-semibold">B&W Both Side</div>
                <div className="font-bold text-emerald-700 font-mono-code mt-1">6 × ₹4 = ₹24</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-slate-500 text-[10px]">Colour Single Side</div>
                <div className="font-bold text-slate-950 font-mono-code mt-1">6 × ₹10 = ₹60</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-amber-800 text-[10px] font-semibold">Colour Both Side</div>
                <div className="font-bold text-amber-700 font-mono-code mt-1">6 × ₹7.50 = ₹45</div>
              </div>
            </div>
          </div>
        </section>

        {/* Embedded Acceptance Calculator Widget */}
        <AcceptanceCalculatorWidget
          pricing={settings.pricing}
          onApplySample={(params) => {
            onNavigate('upload', { sample: params });
          }}
        />

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
