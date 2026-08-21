import React, { useState, useRef, useEffect } from 'react';
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
  Sliders,
  RotateCcw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Scissors,
  Printer,
  Grid,
  RefreshCw,
  Lock,
  Info,
  Crop,
} from 'lucide-react';
import {
  CustomerDetails,
  CustomerUser,
  PassportServiceType,
  ShopSettings,
} from '../types';
import { DEFAULT_PRICING } from '../utils/pricingCalculator';
import { useAuth } from '../context/AuthContext';
import {
  PASSPORT_BG_COLORS,
  generatePassportPhoto,
  generatePrintSheetDataUrl,
  clearPassportCache,
} from '../utils/photoProcessor';

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
  const { currentUser, customerProfile } = useAuth();
  const [serviceType, setServiceType] = useState<PassportServiceType>('STANDARD_PASSPORT');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string>('');
  
  // Background selection: 'white' | 'blue' | 'red' | 'light_blue' | 'gray'
  const [selectedBgColor, setSelectedBgColor] = useState<'white' | 'blue' | 'red' | 'light_blue' | 'gray'>('white');
  
  // Studio matting edge precision mode
  const [edgeStrictness, setEdgeStrictness] = useState<'normal' | 'tight' | 'smooth'>('normal');
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);
  const [showAdvancedTuning, setShowAdvancedTuning] = useState<boolean>(false);

  // Processed passport photo & print sheet data URLs
  const [processedPhotoUrl, setProcessedPhotoUrl] = useState<string>('');
  const [printSheetUrl, setPrintSheetUrl] = useState<string>('');
  
  // View mode: 'single' (1x passport preview) vs 'sheet' (10x print layout preview)
  const [previewMode, setPreviewMode] = useState<'single' | 'sheet'>('single');
  const [showOriginalComparison, setShowOriginalComparison] = useState<boolean>(false);
  const [isFullscreenSheet, setIsFullscreenSheet] = useState<boolean>(false);

  const [quantity, setQuantity] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');

  const [customer, setCustomer] = useState<CustomerDetails>({
    name: loggedInCustomer?.name || customerProfile?.name || currentUser?.displayName || '',
    mobile: loggedInCustomer?.mobile || customerProfile?.mobile || '',
    email: loggedInCustomer?.email || currentUser?.email || customerProfile?.email || '',
    specialInstructions: '',
  });

  useEffect(() => {
    const activeName = loggedInCustomer?.name || customerProfile?.name || currentUser?.displayName || '';
    const activeMobile = loggedInCustomer?.mobile || customerProfile?.mobile || '';
    const activeEmail = loggedInCustomer?.email || currentUser?.email || customerProfile?.email || '';

    setCustomer((prev) => ({
      ...prev,
      name: prev.name || activeName,
      mobile: prev.mobile || activeMobile,
      email: prev.email || activeEmail,
    }));
  }, [loggedInCustomer, currentUser, customerProfile]);

  const [formErrors, setFormErrors] = useState<{ name?: string; mobile?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pricing = settings.pricing || DEFAULT_PRICING;
  const standardRate = pricing.passportStandard || 50;
  const mixedRate = pricing.passportMixed || 60;

  const currentRate = serviceType === 'STANDARD_PASSPORT' ? standardRate : mixedRate;
  const totalAmount = currentRate * quantity;

  // Process photo whenever original image, selected background color, or studio tuning changes
  useEffect(() => {
    if (!originalPreview) return;

    let isMounted = true;
    const processImage = async () => {
      setIsProcessing(true);
      try {
        const bgConfig = PASSPORT_BG_COLORS.find((b) => b.id === selectedBgColor) || PASSPORT_BG_COLORS[0];
        
        // 1. Generate 35x45mm chest-level cropped passport photo with seamless studio background
        const passportDataUrl = await generatePassportPhoto(originalPreview, {
          bgColor: selectedBgColor,
          customHex: bgConfig.hex,
          edgeStrictness,
          brightness,
          contrast,
        });

        if (!isMounted) return;
        setProcessedPhotoUrl(passportDataUrl);

        // 2. Generate 10-photo 4x6 inch high-gloss print sheet
        const sheetDataUrl = await generatePrintSheetDataUrl(
          passportDataUrl,
          serviceType,
          bgConfig.hex
        );

        if (!isMounted) return;
        setPrintSheetUrl(sheetDataUrl);
      } catch (err: any) {
        console.error('Error processing passport photo:', err);
      } finally {
        if (isMounted) setIsProcessing(false);
      }
    };

    processImage();

    return () => {
      isMounted = false;
    };
  }, [originalPreview, selectedBgColor, serviceType, edgeStrictness, brightness, contrast]);

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

    const reader = new FileReader();
    reader.onload = (event) => {
      clearPassportCache();
      setOriginalPreview(event.target?.result as string);
      setPhotoFile(file);
    };
    reader.onerror = () => {
      setUploadError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    clearPassportCache();
    setPhotoFile(null);
    setOriginalPreview('');
    setProcessedPhotoUrl('');
    setPrintSheetUrl('');
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

    if (!photoFile || !processedPhotoUrl) {
      setUploadError('Please upload your photo to proceed.');
      fileInputRef.current?.click();
      return;
    }

    if (!validateForm()) {
      return;
    }

    const bgName = PASSPORT_BG_COLORS.find((b) => b.id === selectedBgColor)?.name || 'White';
    const serviceName =
      serviceType === 'STANDARD_PASSPORT'
        ? `Standard Passport Photos (10 Photos – ₹${standardRate}, ${bgName} BG)`
        : `Mixed Size Photos (10 Photos – ₹${mixedRate}, ${bgName} BG)`;

    // Use processed photo URL for order so shop admin prints the exact background & chest crop
    const orderPayload = {
      mode: 'PASSPORT_PHOTO',
      paperQuality: '100_GSM',
      passportService: serviceType,
      passportBgColor: selectedBgColor,
      customer: {
        name: customer.name.trim(),
        mobile: customer.mobile.trim(),
        email: customer.email?.trim() || undefined,
      },
      files: [
        {
          id: 'photo-' + Date.now(),
          name: `Passport_${selectedBgColor.toUpperCase()}_${photoFile.name}`,
          size: photoFile.size,
          type: 'image/jpeg',
          pageCount: 1,
          moderationStatus: 'SAFE',
          previewUrl: processedPhotoUrl,
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
            <span>Studio Background & Framing</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Passport Size Photo Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Upload any uncropped photo — our studio engine automatically crops, centers, and frames at official ISO/ICAO chest level with seamless studio background replacement and zero color bleeding.
          </p>
        </div>

        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-left shrink-0 text-xs text-slate-300 space-y-2 shadow-md min-w-[240px]">
          <div className="font-bold text-amber-400 text-xs uppercase tracking-wide">Official Photo Rates:</div>
          <div className="text-white font-medium flex justify-between items-center gap-4 bg-slate-900/60 p-2 rounded-lg">
            <span>Standard (10 Photos):</span>
            <span className="font-black text-emerald-400 text-sm">₹{standardRate}</span>
          </div>
          <div className="text-white font-medium flex justify-between items-center gap-4 bg-slate-900/60 p-2 rounded-lg">
            <span>Mixed Size (10 Photos):</span>
            <span className="font-black text-indigo-400 text-sm">₹{mixedRate}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload & Live Previews (Left 7 cols) + Options & Checkout (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* STEP 1: BACKGROUND COLOR SELECTION */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                  1
                </span>
                <h2 className="text-base font-black text-slate-900">
                  Select Background Color
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-500">
                Official Studio Shades
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PASSPORT_BG_COLORS.map((bg) => {
                const isSelected = selectedBgColor === bg.id;
                return (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setSelectedBgColor(bg.id)}
                    className={`p-3.5 rounded-2xl border-2 text-left transition relative cursor-pointer flex flex-col justify-between space-y-2.5 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {/* Color Swatch Circle */}
                      <div
                        className="w-7 h-7 rounded-full border shadow-inner flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: bg.hex,
                          borderColor: bg.id === 'white' ? '#CBD5E1' : bg.hex,
                        }}
                      >
                        {isSelected && (
                          <Check
                            className={`w-3.5 h-3.5 font-black ${
                              bg.id === 'white' || bg.id === 'gray' ? 'text-slate-900' : 'text-white'
                            }`}
                          />
                        )}
                      </div>

                      {isSelected && (
                        <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="font-extrabold text-xs text-slate-900">
                        {bg.name}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-1">
                        {bg.description.split('(')[0]}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Zero Color Bleeding & Protection Badge */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-emerald-900 leading-relaxed">
                <span className="font-bold">Zero Bleeding Guarantee:</span> Face, skin tone, hair, clothes, white shirts, suits, and collars are completely preserved. Background color is blended seamlessly behind the person with no leftover patches.
              </div>
            </div>
          </div>

          {/* STEP 2: PHOTO UPLOAD & LIVE VISUAL PREVIEW */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                  2
                </span>
                <h2 className="text-base font-black text-slate-900">
                  Upload Photo & Live Visual Preview
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-500">
                Auto Chest Crop & Matting
              </span>
            </div>

            {/* Photo Guidelines & Uncropped Image Instruction Notice */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-2.5 text-left">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-xs uppercase tracking-wide">
                <Crop className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Important Photo Guidelines — Please Read Before Uploading</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] text-amber-950">
                <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-xl border border-amber-200/60 shadow-2xs">
                  <div className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    1
                  </div>
                  <div>
                    <strong className="font-bold text-amber-950 block">Upload Uncropped Photo:</strong>
                    <span className="text-amber-900">Please upload the full, uncropped original picture showing the person with breathing space above the head and beside shoulders.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-xl border border-amber-200/60 shadow-2xs">
                  <div className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    2
                  </div>
                  <div>
                    <strong className="font-bold text-emerald-950 block">We Crop It Automatically:</strong>
                    <span className="text-emerald-900">Do not crop the photo yourself. Our studio system automatically detects facial landmarks and crops it to official ISO/ICAO (35×45mm) chest-level standard.</span>
                  </div>
                </div>
              </div>
            </div>

            {!originalPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/70 hover:bg-indigo-50/20 rounded-2xl p-8 text-center cursor-pointer transition space-y-3 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto group-hover:scale-105 transition shadow-xs">
                  <Upload className="w-8 h-8" />
                </div>

                <div>
                  <div className="text-base font-bold text-slate-900">
                    Click to Upload Uncropped Portrait / Original Photo
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Please upload the raw, uncropped photograph. We will automatically crop, align, and frame the photo to official passport specifications.
                  </p>
                </div>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 bg-slate-900 group-hover:bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs"
                >
                  <Camera className="w-4 h-4" />
                  <span>Choose Uncropped Photo</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File Details bar */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {photoFile?.name || 'Uploaded Photo'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {photoFile ? `${(photoFile.size / (1024 * 1024)).toFixed(2)} MB` : ''} • {PASSPORT_BG_COLORS.find(b => b.id === selectedBgColor)?.name} Background
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-slate-700 hover:text-slate-900 font-bold px-3 py-1.5 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                    >
                      Change Photo
                    </button>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
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

                {/* VIEW MODE TABS: Single Passport Photo vs 10x Print Sheet */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('single')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                        previewMode === 'single'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Passport Photo Preview (1x)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewMode('sheet')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                        previewMode === 'sheet'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Preview for Printing (10x Sheet)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvancedTuning(!showAdvancedTuning)}
                    className="text-xs text-indigo-700 font-bold px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{showAdvancedTuning ? 'Hide Studio Tuning' : 'Fine-Tune Matting'}</span>
                  </button>
                </div>

                {/* ADVANCED STUDIO MATTING CONTROLS */}
                {showAdvancedTuning && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Studio Matting & Edge Precision</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEdgeStrictness('normal');
                          setBrightness(0);
                          setContrast(0);
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                      >
                        Reset Defaults
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Edge Precision:
                        </label>
                        <div className="flex rounded-lg overflow-hidden border border-slate-300">
                          {(['smooth', 'normal', 'tight'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                clearPassportCache();
                                setEdgeStrictness(mode);
                              }}
                              className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase transition ${
                                edgeStrictness === mode
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                          <span>Studio Brightness:</span>
                          <span className="font-mono">{brightness > 0 ? `+${brightness}` : brightness}</span>
                        </div>
                        <input
                          type="range"
                          min="-30"
                          max="30"
                          value={brightness}
                          onChange={(e) => setBrightness(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                          <span>Photo Contrast:</span>
                          <span className="font-mono">{contrast > 0 ? `+${contrast}` : contrast}</span>
                        </div>
                        <input
                          type="range"
                          min="-30"
                          max="30"
                          value={contrast}
                          onChange={(e) => setContrast(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* PREVIEW CONTAINER */}
                {isProcessing || !processedPhotoUrl || (previewMode === 'sheet' && !printSheetUrl) ? (
                  <div className="h-72 bg-slate-900 rounded-2xl flex flex-col items-center justify-center space-y-3 text-white border border-slate-800">
                    <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <div className="text-xs font-bold text-amber-300">
                      Processing Background & Framing Chest Level...
                    </div>
                  </div>
                ) : previewMode === 'single' ? (
                  /* SINGLE PASSPORT PHOTO PREVIEW (35mm x 45mm ISO standard) */
                  <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span className="font-black text-amber-400 uppercase tracking-wider">
                          Final Passport Output (35 × 45 mm)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowOriginalComparison(!showOriginalComparison)}
                        className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg transition font-medium cursor-pointer"
                      >
                        {showOriginalComparison ? 'Show Studio Background' : 'Compare with Original'}
                      </button>
                    </div>

                    {/* Passport Card Display with cutting guides and dimensions */}
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                      <div className="relative">
                        {/* 35mm x 45mm frame */}
                        <div className="w-52 h-[267px] sm:w-60 sm:h-[308px] bg-white rounded-md p-1.5 shadow-2xl border border-slate-300 relative overflow-hidden group">
                          {(showOriginalComparison ? originalPreview : processedPhotoUrl) ? (
                            <img
                              src={showOriginalComparison ? originalPreview : processedPhotoUrl}
                              alt="Passport Photo Preview"
                              className="w-full h-full object-cover rounded-xs"
                            />
                          ) : null}

                          {/* Subtle studio photo gloss overlay */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />

                          {/* Dimension labels */}
                          <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
                            35×45 mm
                          </div>
                        </div>

                        {/* Outer dimension guide markers */}
                        <div className="absolute -bottom-5 inset-x-0 text-center text-[10px] text-slate-400 font-mono">
                          Width: 35 mm (3.5 cm)
                        </div>
                      </div>

                      <div className="pt-3 text-center space-y-1">
                        <div className="text-xs font-bold text-slate-200">
                          Framed at chest level with {PASSPORT_BG_COLORS.find(b => b.id === selectedBgColor)?.name} Background
                        </div>
                        <div className="text-[11px] text-emerald-400 font-medium flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Pristine Background Matting • Face & Clothing 100% Preserved</span>
                        </div>
                      </div>
                    </div>

                    {/* Formal Studio Quality & Hard-Copy Notice */}
                    <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-start gap-3 text-left">
                      <div className="p-1.5 bg-indigo-950 text-indigo-400 rounded-lg shrink-0 mt-0.5 border border-indigo-800/50">
                        <Info className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-slate-200 tracking-wide flex items-center gap-2">
                          <span>Quality & Print Notice</span>
                          <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-semibold px-1.5 py-0.5 rounded border border-indigo-500/30">
                            Physical Hard Copy
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-400">
                          <strong className="text-slate-300 font-medium">Please Note:</strong> The digital preview displayed above is intended solely for layout, framing, and composition verification. Your final physical copy will be processed and printed in professional, studio-quality resolution with a high-definition laboratory finish on 250 GSM photographic stock.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 10X PRINT SHEET PREVIEW (Realistic 4x6 Glossy Paper) */
                  <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Printer className="w-4 h-4 text-emerald-400" />
                        <span className="font-black text-emerald-400 uppercase tracking-wider">
                          Full 4×6" Glossy Print Sheet (10 Photos)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsFullscreenSheet(true)}
                        className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Zoom Full Sheet</span>
                      </button>
                    </div>

                    <div className="bg-slate-950 p-3 sm:p-4 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden">
                      <div className="relative max-w-full rounded-xl overflow-hidden shadow-2xl border border-slate-600 bg-white group cursor-zoom-in" onClick={() => setIsFullscreenSheet(true)}>
                        {printSheetUrl ? (
                          <img
                            src={printSheetUrl}
                            alt="4x6 Print Sheet"
                            className="w-full max-h-[340px] object-contain"
                          />
                        ) : null}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="bg-slate-900/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5">
                            <ZoomIn className="w-4 h-4 text-amber-400" />
                            Click to Inspect Full Print Resolution
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-center text-[11px] text-slate-400">
                      Printed on ultra-glossy 250 GSM photographic stock with micro-perforated cutting border marks.
                    </div>

                    {/* Formal Studio Quality & Hard-Copy Notice */}
                    <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-start gap-3 text-left">
                      <div className="p-1.5 bg-indigo-950 text-indigo-400 rounded-lg shrink-0 mt-0.5 border border-indigo-800/50">
                        <Info className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-slate-200 tracking-wide flex items-center gap-2">
                          <span>Quality & Print Notice</span>
                          <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-semibold px-1.5 py-0.5 rounded border border-indigo-500/30">
                            Physical Hard Copy
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-400">
                          <strong className="text-slate-300 font-medium">Please Note:</strong> The digital preview displayed above is intended solely for layout, framing, and composition verification. Your final physical copy will be processed and printed in professional, studio-quality resolution with a high-definition laboratory finish on 250 GSM photographic stock.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Service Type, Pricing & Checkout Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Service Configuration Box */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900">
                Photo Set Options
              </h2>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                10 Photos Per Set
              </span>
            </div>

            {/* Service Type Switcher */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Layout Option:
              </label>

              <div className="grid grid-cols-1 gap-2.5">
                <div
                  onClick={() => setServiceType('STANDARD_PASSPORT')}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition flex items-center justify-between ${
                    serviceType === 'STANDARD_PASSPORT'
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-sm text-slate-900">
                      10 × Standard Passport (35 × 45 mm)
                    </div>
                    <div className="text-xs text-slate-500">
                      Standard size for all official government & bank forms
                    </div>
                  </div>
                  <div className="text-base font-black text-emerald-700">
                    ₹{standardRate}
                  </div>
                </div>

                <div
                  onClick={() => setServiceType('MIXED_PASSPORT')}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition flex items-center justify-between ${
                    serviceType === 'MIXED_PASSPORT'
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-sm text-slate-900">
                      Mixed Set (6 Passport + 4 Stamp Size)
                    </div>
                    <div className="text-xs text-slate-500">
                      6 Passport (35×45mm) + 4 Stamp (25×30mm)
                    </div>
                  </div>
                  <div className="text-base font-black text-indigo-700">
                    ₹{mixedRate}
                  </div>
                </div>
              </div>
            </div>

            {/* Quantity / Sets Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Number of Sets (10 Photos / Set):
              </label>
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuantity(q)}
                    className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs transition border cursor-pointer ${
                      quantity === q
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {q} Set ({q * 10} pcs)
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Details Form */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                Customer Information
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={customer.name}
                  onChange={(e) => {
                    setCustomer({ ...customer, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition ${
                    formErrors.name ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  value={customer.mobile}
                  onChange={(e) => {
                    setCustomer({ ...customer, mobile: e.target.value.replace(/\D/g, '') });
                    if (formErrors.mobile) setFormErrors({ ...formErrors, mobile: undefined });
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium font-mono text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition ${
                    formErrors.mobile ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                  }`}
                />
                {formErrors.mobile && (
                  <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.mobile}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Special Notes / Instructions (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Extra white border, Urgent delivery"
                  value={customer.specialInstructions || ''}
                  onChange={(e) =>
                    setCustomer({ ...customer, specialInstructions: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            {/* Price Summary & Checkout Action */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Selected Background:</span>
                <span className="font-bold text-slate-900">
                  {PASSPORT_BG_COLORS.find((b) => b.id === selectedBgColor)?.name}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Rate per Set (10 Photos):</span>
                <span className="font-bold text-slate-900">₹{currentRate}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Total Photos:</span>
                <span className="font-bold text-slate-900">{quantity * 10} Photos</span>
              </div>

              <div className="border-t border-slate-200 pt-2.5 flex justify-between items-center text-sm font-black text-slate-900">
                <span>Total Amount:</span>
                <span className="text-emerald-700 text-lg">₹{totalAmount}</span>
              </div>

              <button
                type="button"
                onClick={handleProceed}
                disabled={settings.isAcceptingOrders === false || isProcessing}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Payment (₹{totalAmount})</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>PIN-protected counter pickup at {settings.shopName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FULLSCREEN PRINT SHEET INSPECTION MODAL */}
      {isFullscreenSheet && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-4xl w-full p-6 border border-slate-800 space-y-4 relative text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                <Printer className="w-4 h-4" />
                <span>High-Resolution 4×6" Print Sheet Inspection (300 DPI)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreenSheet(false)}
                className="text-slate-400 hover:text-white font-bold p-1 text-sm cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl flex items-center justify-center border border-slate-800 max-h-[75vh] overflow-auto">
              {printSheetUrl ? (
                <img
                  src={printSheetUrl}
                  alt="4x6 Print Sheet High Resolution"
                  className="max-h-[68vh] object-contain rounded-lg shadow-2xl"
                />
              ) : null}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Layout: {serviceType === 'STANDARD_PASSPORT' ? '10 Standard Passport (35×45mm)' : '6 Passport + 4 Stamp'}</span>
              <button
                type="button"
                onClick={() => setIsFullscreenSheet(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl"
              >
                Back to Customizer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
