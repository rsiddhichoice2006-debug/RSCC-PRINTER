import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  Trash2,
  Image as ImageIcon,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Layers,
  ArrowRight,
  ShieldAlert,
  Sun,
  Eye,
  Smile,
} from 'lucide-react';
import {
  CustomerDetails,
  CustomerUser,
  PassportServiceType,
  ShopSettings,
} from '../types';
import { DEFAULT_PRICING } from '../utils/pricingCalculator';

interface PassportPhotoPageProps {
  settings: ShopSettings;
  onProceedToPayment: (orderData: any) => void;
  loggedInCustomer?: CustomerUser | null;
}

export const PassportPhotoPage: React.FC<PassportPhotoPageProps> = ({
  settings,
  onProceedToPayment,
  loggedInCustomer,
}) => {
  const [serviceType, setServiceType] = useState<PassportServiceType>('STANDARD_PASSPORT');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [activeGuideTab, setActiveGuideTab] = useState<'visual' | 'specifications' | 'checklist'>('visual');

  const [customer, setCustomer] = useState<CustomerDetails>({
    name: loggedInCustomer?.name || '',
    mobile: loggedInCustomer?.mobile || '',
    email: loggedInCustomer?.email || '',
    specialInstructions: '',
  });
  const [formErrors, setFormErrors] = useState<{ name?: string; mobile?: string }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const pricing = settings.pricing || DEFAULT_PRICING;
  const standardRate = pricing.passportStandard || 50;
  const mixedRate = pricing.passportMixed || 60;

  // Effective rate per set
  const currentRate = serviceType === 'STANDARD_PASSPORT' ? standardRate : mixedRate;
  const totalAmount = currentRate * quantity;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setUploadError('');
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
      setUploadError('Please upload a valid image file (JPG, JPEG, PNG, or WEBP).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError('Photo file size exceeds 20MB limit. Please choose a smaller original image.');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string);
      setPhotoFile(file);
      setIsProcessing(false);
    };
    reader.onerror = () => {
      setUploadError('Failed to read image file.');
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = (): boolean => {
    const errs: { name?: string; mobile?: string } = {};
    if (!customer.name.trim()) errs.name = 'Please enter your full name';
    if (!customer.mobile.trim() || customer.mobile.trim().length < 10) {
      errs.mobile = 'Please enter a valid 10-digit mobile number';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleProceed = () => {
    if (settings.isAcceptingOrders === false) {
      alert(settings.pauseOrderReason || 'Currently Not Accepting Orders Due to High Demand.');
      return;
    }

    if (!photoFile || !photoPreview) {
      setUploadError('Please upload your photo to proceed.');
      fileInputRef.current?.click();
      return;
    }

    if (!validateForm()) {
      return;
    }

    const serviceName =
      serviceType === 'STANDARD_PASSPORT'
        ? `Standard Passport Photos (10 Photos – ₹${standardRate})`
        : `Mixed Size Photos (10 Photos – ₹${mixedRate})`;

    const orderPayload = {
      mode: 'PASSPORT_PHOTO',
      paperQuality: '100_GSM',
      passportService: serviceType,
      customer: {
        name: customer.name.trim(),
        mobile: customer.mobile.trim(),
        email: customer.email?.trim() || undefined,
      },
      files: [
        {
          id: 'photo-' + Date.now(),
          name: photoFile.name,
          size: photoFile.size,
          type: photoFile.type,
          pageCount: 1,
          moderationStatus: 'SAFE',
          previewUrl: photoPreview,
        },
      ],
      totalPages: 1,
      totalSheets: quantity,
      copies: quantity,
      printType: 'COLOUR',
      printingSide: 'SINGLE',
      ratePerPage: currentRate,
      totalAmount,
      specialInstructions: customer.specialInstructions?.trim()
        ? `[${serviceName}] ${customer.specialInstructions.trim()}`
        : `Service: ${serviceName}`,
    };

    onProceedToPayment(orderPayload);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* High Demand Pause Banner */}
      {settings.isAcceptingOrders === false && (
        <div className="bg-rose-950/90 border-2 border-rose-500 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-600 flex items-center justify-center shrink-0 shadow-md">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Orders Temporarily Paused
                </span>
                <span className="font-extrabold text-base sm:text-lg text-rose-100">
                  {settings.pauseOrderReason || 'High Queue Demand'}
                </span>
              </div>
              <p className="text-xs text-rose-200 leading-relaxed max-w-3xl">
                Online order placement is temporarily on hold to clear pending jobs. Counter printing is available at {settings.address}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
            <Camera className="w-3.5 h-3.5" />
            <span>Dedicated Photo Studio</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Passport Size Photo Printing
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            High-gloss photograph printing on premium photo sheets with 10 photos per set, crisp borders, and studio-grade colour calibration.
          </p>
        </div>

        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-left shrink-0 text-xs text-slate-300 space-y-2 shadow-md min-w-[220px]">
          <div className="font-bold text-amber-400 text-xs uppercase tracking-wide">Official Photo Rates:</div>
          <div className="text-white font-medium flex justify-between items-center gap-4 bg-slate-900/60 p-2 rounded-lg">
            <span>Standard Passport (10 Photos):</span>
            <span className="font-black text-emerald-400 text-sm">₹{standardRate}</span>
          </div>
          <div className="text-white font-medium flex justify-between items-center gap-4 bg-slate-900/60 p-2 rounded-lg">
            <span>Mixed Size (10 Photos):</span>
            <span className="font-black text-indigo-400 text-sm">₹{mixedRate}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload & Guide (Left) + Options & Checkout (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Photo Upload, Live Preview & Image Guide (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. PHOTO UPLOAD & LIVE PREVIEW BOX */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Camera className="w-5 h-5 text-slate-700" />
                Upload Your Photograph
              </h2>
              <span className="text-xs font-bold text-slate-500">
                Supports JPG, JPEG, PNG, WEBP (Max 20MB)
              </span>
            </div>

            {!photoPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30 rounded-2xl p-8 text-center cursor-pointer transition space-y-3 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto group-hover:scale-110 transition shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>

                <div>
                  <div className="text-base font-bold text-slate-900">
                    Click to Upload Passport Photo
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Select a clear front-facing photograph from your phone or computer.
                  </p>
                </div>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 bg-slate-900 group-hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Choose Photo File</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {photoFile?.name || 'Uploaded Photo'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {photoFile ? `${(photoFile.size / (1024 * 1024)).toFixed(2)} MB` : ''} • Ready for Printing (10 Photos)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-slate-700 hover:text-slate-900 font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                    >
                      Change
                    </button>
                    <button
                      onClick={handleRemovePhoto}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg,image/webp"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Live Sheet Layout Preview (10 Photos) */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Live Sheet Preview (10 Photos on Glossy Paper)
                    </span>
                    <span className="text-[11px] text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded font-mono">
                      {serviceType === 'STANDARD_PASSPORT' ? '10 Standard (35×45mm)' : '6 Passport + 4 Stamp = 10 Pcs'}
                    </span>
                  </div>

                  {/* Render 10 Photo Grid */}
                  <div className="bg-white p-3.5 rounded-xl shadow-inner flex items-center justify-center min-h-[220px]">
                    {serviceType === 'STANDARD_PASSPORT' ? (
                      <div className="w-full max-w-md">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 text-center">
                          10 × Standard Passport Photos (35 × 45 mm)
                        </div>
                        {/* 5 columns x 2 rows grid for 10 photos */}
                        <div className="grid grid-cols-5 gap-2">
                          {Array.from({ length: 10 }).map((_, idx) => (
                            <div
                              key={idx}
                              className="aspect-[3.5/4.5] bg-slate-100 border border-slate-300 rounded overflow-hidden relative shadow-2xs group"
                            >
                              <img
                                src={photoPreview}
                                alt={`Passport copy ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute bottom-0 inset-x-0 bg-slate-900/60 text-[7px] text-white text-center py-0.2">
                                #{idx + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full max-w-md space-y-3">
                        {/* 6 Passport */}
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5">
                            6 × Passport Size (35 × 45 mm):
                          </div>
                          <div className="grid grid-cols-6 gap-1.5">
                            {Array.from({ length: 6 }).map((_, idx) => (
                              <div
                                key={idx}
                                className="aspect-[3.5/4.5] bg-slate-100 border border-slate-300 rounded overflow-hidden shadow-2xs relative"
                              >
                                <img
                                  src={photoPreview}
                                  alt={`Passport ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-0 inset-x-0 bg-slate-900/60 text-[6px] text-white text-center">
                                  P{idx + 1}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 4 Stamp */}
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5">
                            4 × Stamp Size (25 × 30 mm):
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {Array.from({ length: 4 }).map((_, idx) => (
                              <div
                                key={idx}
                                className="aspect-[2.5/3] bg-slate-100 border border-slate-300 rounded overflow-hidden shadow-2xs relative"
                              >
                                <img
                                  src={photoPreview}
                                  alt={`Stamp ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-0 inset-x-0 bg-indigo-900/70 text-[7px] text-white text-center">
                                  Stamp #{idx + 1}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="text-center text-[10px] text-indigo-700 font-bold bg-indigo-50 py-1 rounded-md border border-indigo-100">
                          Total: 10 Mixed Photos on Single High-Gloss Sheet
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. VISUAL UPLOAD GUIDE (Do's & Don'ts) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-500" />
                Visual Passport Photo Guide
              </h2>
              <span className="text-[11px] font-bold text-slate-500">
                Official Guidelines
              </span>
            </div>

            {/* Guide Tabs */}
            <div className="flex border-b border-slate-200 gap-2">
              <button
                type="button"
                onClick={() => setActiveGuideTab('visual')}
                className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
                  activeGuideTab === 'visual'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Visual Do's & Don'ts
              </button>
              <button
                type="button"
                onClick={() => setActiveGuideTab('specifications')}
                className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
                  activeGuideTab === 'specifications'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Size Specifications
              </button>
              <button
                type="button"
                onClick={() => setActiveGuideTab('checklist')}
                className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
                  activeGuideTab === 'checklist'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Quick Checklist
              </button>
            </div>

            {/* TAB 1: VISUAL DO'S & DON'TS */}
            {activeGuideTab === 'visual' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* DO's Column */}
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>DO's (Accepted Photos)</span>
                    </div>

                    <div className="space-y-2 text-xs text-emerald-950">
                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Front-Facing Pose:</strong> Look straight at the camera with both ears and shoulders visible.
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Plain Light Background:</strong> Use plain white, off-white, or light blue backdrop.
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Even Lighting:</strong> Natural lighting without shadows on face or background.
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Neutral Expression:</strong> Mouth closed, eyes open, looking directly into the camera lens.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DONT's Column */}
                  <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>DON'Ts (Rejected Photos)</span>
                    </div>

                    <div className="space-y-2 text-xs text-rose-950">
                      <div className="flex items-start gap-2">
                        <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>No Side Angles or Selfies:</strong> Tilted head, angular poses, or wide-angle selfie distortions will be rejected.
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>No Busy or Dark Backgrounds:</strong> Outdoor sceneries, wall patterns, or dark rooms are not allowed.
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>No Caps or Sunglasses:</strong> Hats, caps, sunglasses, or heavy tinted glasses are strictly prohibited.
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>No Blurry Screenshots:</strong> Avoid low-res phone screenshots, heavy beauty filters, or cropped group pictures.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SPECIFICATIONS */}
            {activeGuideTab === 'specifications' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 text-sm">Standard Passport Size (10 Photos)</div>
                  <div className="text-amber-700 font-mono font-bold">35 mm × 45 mm</div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Official format for Indian Passport, Government exams, Aadhaar card, PAN card & driving license.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 text-sm">Stamp Size Photo (in Mixed Set)</div>
                  <div className="text-indigo-700 font-mono font-bold">25 mm × 30 mm</div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Compact size required for school/college ID cards, library registrations, and official forms.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: CHECKLIST */}
            {activeGuideTab === 'checklist' && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Photo taken recently (within the last 6 months).</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Background is solid white, off-white, or light grey.</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Full face visible from top of hair to bottom of chin.</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>High quality photographic paper (100+ GSM Glossy).</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Service Selection (Standard 10 / Mixed 10) & Checkout Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* SERVICE SELECTION CARDS */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Select Photo Option
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Printed on premium high-gloss photographic paper (10 photos per set)
              </p>
            </div>

            {/* Service Option Cards - Only Standard (10 Photos) and Mixed (10 Photos) */}
            <div className="space-y-3">
              {/* Option 1: Standard Passport Size Photos - ₹50 (10 Photos) */}
              <button
                type="button"
                onClick={() => setServiceType('STANDARD_PASSPORT')}
                className={`w-full p-4 rounded-xl border-2 text-left transition relative cursor-pointer ${
                  serviceType === 'STANDARD_PASSPORT'
                    ? 'border-emerald-600 bg-emerald-50/60 shadow-md ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded border border-emerald-300 uppercase">
                    10 Photos Set
                  </span>
                  <span className="text-base font-black text-emerald-700">
                    ₹{standardRate}
                  </span>
                </div>
                <div className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Passport Size Photo – ₹{standardRate}
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  10 standard 35×45mm passport photographs printed on high-gloss photographic sheet with cutting guidelines.
                </p>
              </button>

              {/* Option 2: Mixed Size Photos - ₹60 (10 Photos) */}
              <button
                type="button"
                onClick={() => setServiceType('MIXED_SIZE')}
                className={`w-full p-4 rounded-xl border-2 text-left transition relative cursor-pointer ${
                  serviceType === 'MIXED_SIZE'
                    ? 'border-indigo-600 bg-indigo-50/60 shadow-md ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="bg-indigo-100 text-indigo-900 text-[10px] font-black px-2 py-0.5 rounded border border-indigo-300 uppercase">
                    10 Photos Combo
                  </span>
                  <span className="text-base font-black text-indigo-700">
                    ₹{mixedRate}
                  </span>
                </div>
                <div className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Mixed Size Photos – ₹{mixedRate}
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Combined set of 10 photos: 6 standard passport photos (35×45mm) + 4 compact stamp size photos (25×30mm) on glossy photo paper.
                </p>
              </button>
            </div>

            {/* Quantity Selector */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Number of Sets (10 Photos each):
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center transition"
                >
                  -
                </button>
                <span className="font-black text-sm text-slate-900 min-w-[20px] text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center transition"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* CUSTOMER DETAILS & CHECKOUT CARD */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Customer Information
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Sharma"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                    formErrors.name ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-[11px] text-rose-600 mt-1">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mobile Number (for pickup SMS & tracking) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  value={customer.mobile}
                  onChange={(e) => setCustomer({ ...customer, mobile: e.target.value.replace(/\D/g, '') })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                    formErrors.mobile ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {formErrors.mobile && (
                  <p className="text-[11px] text-rose-600 mt-1">{formErrors.mobile}</p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={customer.email || ''}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Special Notes / Background Preference
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Please crop for blue background / urgent pickup"
                  value={customer.specialInstructions || ''}
                  onChange={(e) => setCustomer({ ...customer, specialInstructions: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>
            </div>

            {/* Pricing Summary Box */}
            <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Selected Service:</span>
                <span className="font-bold text-white">
                  {serviceType === 'STANDARD_PASSPORT' ? 'Standard 10 Photos' : 'Mixed 10 Photos'}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Rate per Set:</span>
                <span className="font-mono text-amber-400">₹{currentRate}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Sets ({quantity}):</span>
                <span className="font-mono text-white">× {quantity}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-black">
                <span className="text-amber-400">Total Payable:</span>
                <span className="text-xl text-emerald-400">₹{totalAmount}</span>
              </div>
            </div>

            {/* Proceed to Payment Button */}
            <button
              onClick={handleProceed}
              disabled={isProcessing || !photoPreview}
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>PROCEED TO UPI PAYMENT • ₹{totalAmount}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
