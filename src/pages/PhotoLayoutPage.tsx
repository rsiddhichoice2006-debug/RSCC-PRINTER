import React, { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Move,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Info,
  ArrowRight,
  Plus,
  RefreshCw,
  Eye,
  AlertCircle,
  ShieldAlert,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  CustomerDetails,
  CustomerUser,
  PaperSize,
  PhotoLayoutType,
  PhotoOrientation,
  PhotoSlotItem,
  ShopSettings,
  UploadedFileItem,
} from '../types';
import { PHOTO_LAYOUTS, calculateRequiredSheets, generateSheetSlots } from '../utils/photoLayouts';
import { formatFileSize, processUploadedFile } from '../utils/fileProcessor';
import { useAuth } from '../context/AuthContext';

interface PhotoLayoutPageProps {
  settings: ShopSettings;
  onProceedToPayment: (orderData: any) => void;
  loggedInCustomer?: CustomerUser | null;
}

export const PhotoLayoutPage: React.FC<PhotoLayoutPageProps> = ({
  settings,
  onProceedToPayment,
  loggedInCustomer,
}) => {
  const { currentUser, customerProfile } = useAuth();
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [selectedLayout, setSelectedLayout] = useState<PhotoLayoutType>('4_PHOTOS');
  const [photoOrientation, setPhotoOrientation] = useState<PhotoOrientation>('PORTRAIT');
  const [uploadedPhotos, setUploadedPhotos] = useState<
    { id: string; file: File; name: string; size: number; previewUrl: string }[]
  >([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [copies, setCopies] = useState<number>(1);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');

  // Customer Details Form (auto-prefill if logged in)
  const [customer, setCustomer] = useState<CustomerDetails>({
    name: loggedInCustomer?.name || customerProfile?.name || currentUser?.displayName || '',
    mobile: loggedInCustomer?.mobile || customerProfile?.mobile || '',
    email: loggedInCustomer?.email || currentUser?.email || customerProfile?.email || '',
    specialInstructions: '',
  });

  // Sync if customer logs in
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
  const [customerErrors, setCustomerErrors] = useState<{ name?: string; mobile?: string }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentLayoutConfig = PHOTO_LAYOUTS[selectedLayout];
  const requiredSheets = calculateRequiredSheets(uploadedPhotos.length, selectedLayout);

  // Keep activeSheetIndex in valid range
  if (activeSheetIndex >= requiredSheets && requiredSheets > 0) {
    setActiveSheetIndex(requiredSheets - 1);
  }

  const currentSheetSlots = generateSheetSlots(uploadedPhotos, selectedLayout, activeSheetIndex);

  // Pricing: A4 = ₹10 / page
  const ratePerSheet = settings.pricing?.a4Color100Single || 10;

  const totalAmount = requiredSheets * copies * ratePerSheet;

  // Handle Image Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newPhotos: { id: string; file: File; name: string; size: number; previewUrl: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;

      const processed = await processUploadedFile(f, settings.maxFileSizeMb);
      if (processed.previewUrl && processed.moderationStatus !== 'FLAGGED') {
        newPhotos.push({
          id: processed.id,
          file: f,
          name: f.name,
          size: f.size,
          previewUrl: processed.previewUrl,
        });
      }
    }

    setUploadedPhotos((prev) => [...prev, ...newPhotos]);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (photoId: string) => {
    setUploadedPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  // Swap / Move Photo between slots in the current sheet
  const handleDropOnSlot = (targetSlotIndex: number) => {
    if (draggedSlotIndex === null || draggedSlotIndex === targetSlotIndex) return;

    const capacity = currentLayoutConfig.photoCount;
    const globalSourceIdx = activeSheetIndex * capacity + draggedSlotIndex;
    const globalTargetIdx = activeSheetIndex * capacity + targetSlotIndex;

    setUploadedPhotos((prev) => {
      const list = [...prev];
      if (globalSourceIdx < list.length && globalTargetIdx < list.length) {
        // Swap
        const temp = list[globalSourceIdx];
        list[globalSourceIdx] = list[globalTargetIdx];
        list[globalTargetIdx] = temp;
      } else if (globalSourceIdx < list.length && globalTargetIdx >= list.length) {
        // Move to empty slot
        const [moved] = list.splice(globalSourceIdx, 1);
        list.push(moved);
      }
      return list;
    });

    setDraggedSlotIndex(null);
  };

  const validateCustomer = (): boolean => {
    const errs: { name?: string; mobile?: string } = {};
    if (!customer.name.trim()) errs.name = 'Please enter your full name';
    if (!customer.mobile.trim() || customer.mobile.trim().length < 10) {
      errs.mobile = 'Please enter a valid 10-digit mobile number';
    }
    setCustomerErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleProceed = () => {
    if (settings.isAcceptingOrders === false) {
      alert(settings.pauseOrderReason || 'Currently Not Accepting Orders Due to High Demand. Please check back later.');
      return;
    }

    if (uploadedPhotos.length === 0) {
      alert('Please upload at least one photo before proceeding.');
      return;
    }

    if (!validateCustomer()) {
      return;
    }

    const orderPayload = {
      mode: 'PHOTO',
      paperSize,
      photoLayout: selectedLayout,
      photoOrientation,
      customer: {
        name: customer.name.trim(),
        mobile: customer.mobile.trim(),
        email: customer.email?.trim() || undefined,
      },
      files: uploadedPhotos.map((p) => ({
        id: p.id,
        name: p.name,
        size: p.size,
        type: p.file.type || 'image/jpeg',
        pageCount: 1,
        moderationStatus: 'SAFE',
        previewUrl: p.previewUrl,
      })),
      totalPages: uploadedPhotos.length,
      totalSheets: requiredSheets,
      copies,
      printType: 'COLOUR',
      printingSide: 'SINGLE',
      ratePerPage: ratePerSheet,
      totalAmount,
      specialInstructions: customer.specialInstructions?.trim()
        ? `[${paperSize} Photo Print - ₹${ratePerSheet}/page] ${customer.specialInstructions.trim()}`
        : `Paper: ${paperSize} Photo Paper (₹${ratePerSheet}/page) | Layout: ${selectedLayout}`,
    };

    onProceedToPayment(orderPayload);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Not Accepting Orders Banner */}
      {settings.isAcceptingOrders === false && (
        <div className="bg-rose-950/90 border-2 border-rose-500 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
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
                  {settings.pauseOrderReason || 'Currently Not Accepting Orders Due to High Demand'}
                </span>
              </div>
              <p className="text-xs text-rose-200 leading-relaxed max-w-3xl">
                Our photo printing studio is experiencing peak queue demand. Photo print orders are temporarily paused so we can process existing jobs. Please visit our shop directly at {settings.address} or check back shortly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
            <ImageIcon className="w-3.5 h-3.5" />
            <span>RSCC Photo Printing Studio</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            A4 Photo Printing Layouts
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Choose your layout, upload photos, and preview them live on realistic high-gloss A4 photographic sheets at just ₹{ratePerSheet} per page.
          </p>
        </div>

        {/* Rate Badge in Header */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shrink-0 text-left space-y-1 shadow-md">
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
            Standard Paper Size & Rate:
          </div>
          <div className="text-sm font-black text-amber-400">
            A4 High-Gloss Photo Paper
          </div>
          <div className="text-xs text-slate-200 font-bold">
            ₹{ratePerSheet} per sheet (210 × 297 mm)
          </div>
        </div>
      </div>

      {/* Step 1: Layout Selection Cards */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>1. Choose Photo Layout</span>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                A4 Photo Paper (₹{ratePerSheet}/page)
              </span>
            </h2>
            <p className="text-xs text-slate-600">
              Select how many photos you want arranged on each A4 glossy sheet.
            </p>
          </div>
        </div>

        {/* Layout Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(PHOTO_LAYOUTS) as PhotoLayoutType[]).map((layoutKey) => {
            const config = PHOTO_LAYOUTS[layoutKey];
            const isSelected = selectedLayout === layoutKey;

            return (
              <div
                key={layoutKey}
                onClick={() => setSelectedLayout(layoutKey)}
                className={`rounded-2xl p-5 border transition cursor-pointer flex flex-col justify-between relative ${
                  isSelected
                    ? 'bg-indigo-50/70 border-indigo-600 shadow-md ring-2 ring-indigo-500/30'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 bg-indigo-600 text-white rounded-full p-1 shadow">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}

                <div className="space-y-3">
                  {/* Visual Grid Thumbnail with Vector Miniature & ASCII Blueprint */}
                  <div className="bg-slate-900 rounded-xl p-3.5 text-center text-[10px] font-mono text-amber-300 leading-tight select-none shadow-inner border border-slate-800 space-y-2">
                    {/* Visual Miniature Sheet representation */}
                    <div className="mx-auto bg-slate-950 border border-slate-700 rounded-lg p-1.5 shadow-md flex flex-col justify-between relative overflow-hidden w-24 h-32">
                      {layoutKey === '1_PHOTO' && (
                        <div className="w-full h-full rounded border border-dashed border-amber-400/70 bg-amber-400/10 flex flex-col items-center justify-center text-amber-300 text-[9px] font-bold p-1">
                          <ImageIcon className="w-5 h-5 text-amber-400 mb-0.5" />
                          <span>Full A4</span>
                          <span className="text-[7px] text-slate-400">1 Photo</span>
                        </div>
                      )}

                      {layoutKey === '2_PHOTOS' && (
                        <div className="w-full h-full flex flex-col gap-1">
                          <div className="flex-1 rounded border border-dashed border-cyan-400/70 bg-cyan-400/10 flex items-center justify-center text-cyan-300 text-[8px] font-bold">
                            5×7"
                          </div>
                          <div className="flex-1 rounded border border-dashed border-cyan-400/70 bg-cyan-400/10 flex items-center justify-center text-cyan-300 text-[8px] font-bold">
                            5×7"
                          </div>
                        </div>
                      )}

                      {layoutKey === '4_PHOTOS' && (
                        <div className="w-full h-full grid grid-cols-2 gap-1">
                          {[1, 2, 3, 4].map((n) => (
                            <div key={n} className="rounded border border-dashed border-indigo-400/70 bg-indigo-400/10 flex items-center justify-center text-indigo-300 text-[8px] font-bold">
                              4×6"
                            </div>
                          ))}
                        </div>
                      )}

                      {layoutKey === '9_PHOTOS' && (
                        <div className="w-full h-full grid grid-cols-3 gap-0.5">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                            <div key={n} className="rounded border border-dashed border-emerald-400/70 bg-emerald-400/10 flex items-center justify-center text-emerald-300 text-[6px] font-bold">
                              {n}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <pre className="inline-block text-left text-[8px] opacity-85 text-amber-300/90 font-mono tracking-tighter">
                      {config.asciiPreview}
                    </pre>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">
                      {config.name} (A4)
                    </h3>
                    <div className="text-xs font-bold text-indigo-700 mt-0.5">
                      {config.dimensionsText} • Rate: ₹{ratePerSheet}/sheet
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {config.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLayout(layoutKey);
                    }}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    {isSelected ? 'Selected Layout' : 'Select Layout'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Full Page Orientation Toggle (if 1_PHOTO selected) */}
      {selectedLayout === '1_PHOTO' && (
        <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-700">
            <span className="font-bold text-slate-900">Orientation for Full A4 Page:</span> Select portrait or landscape print.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPhotoOrientation('PORTRAIT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                photoOrientation === 'PORTRAIT'
                  ? 'bg-slate-900 text-white shadow'
                  : 'bg-white text-slate-700 border border-slate-300'
              }`}
            >
              Portrait (210 × 297 mm)
            </button>
            <button
              onClick={() => setPhotoOrientation('LANDSCAPE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                photoOrientation === 'LANDSCAPE'
                  ? 'bg-slate-900 text-white shadow'
                  : 'bg-white text-slate-700 border border-slate-300'
              }`}
            >
              Landscape (297 × 210 mm)
            </button>
          </div>
        </div>
      )}

      {/* Main Studio Grid: Upload Area & Live Sheet Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Photo Uploader & Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">
                2. Upload Photos ({uploadedPhotos.length})
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                JPG, PNG, WEBP
              </span>
            </div>

            {/* Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/70 hover:bg-indigo-50/40 rounded-2xl p-6 text-center cursor-pointer transition space-y-2 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto group-hover:scale-110 transition">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-slate-900">
                Click to Upload Photos from Phone or PC
              </div>
              <div className="text-xs text-slate-500">
                You can select multiple photos at once
              </div>
            </div>

            {isUploading && (
              <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 font-medium py-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing photos...</span>
              </div>
            )}

            {/* Uploaded Photos Thumbnails List */}
            {uploadedPhotos.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                  <span>Uploaded Images ({uploadedPhotos.length})</span>
                  <span className="text-[11px] text-slate-400">
                    Drag slots on the sheet to reorder
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                  {uploadedPhotos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="relative group rounded-lg overflow-hidden border border-slate-300 aspect-square bg-white shadow-2xs"
                    >
                      <img
                        src={photo.previewUrl}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-1 left-1 bg-slate-900/80 text-white text-[9px] font-bold px-1 rounded">
                        #{idx + 1}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhoto(photo.id);
                        }}
                        className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition shadow"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Customer Details Form */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900">
              3. Customer Information
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
                    customerErrors.name ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {customerErrors.name && (
                  <p className="text-[11px] text-rose-600 mt-1">{customerErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mobile Number (for pickup SMS) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  value={customer.mobile}
                  onChange={(e) => setCustomer({ ...customer, mobile: e.target.value.replace(/\D/g, '') })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                    customerErrors.mobile ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {customerErrors.mobile && (
                  <p className="text-[11px] text-rose-600 mt-1">{customerErrors.mobile}</p>
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
                  Special Cutting / Printing Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Leave white border / cut individually"
                  value={customer.specialInstructions || ''}
                  onChange={(e) => setCustomer({ ...customer, specialInstructions: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Sheet Preview Canvas (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                    Live Realistic Canvas
                  </span>
                  <span className="font-extrabold text-sm text-slate-200">
                    {paperSize} Photo Sheet Preview
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Showing Sheet {activeSheetIndex + 1} of {Math.max(1, requiredSheets)} • Rate: ₹{ratePerSheet}/sheet
                </div>
              </div>

              {/* Fit Mode Toggle & Sheet Navigation */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFitMode(fitMode === 'cover' ? 'contain' : 'cover')}
                  className="bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition"
                  title="Toggle image crop mode"
                >
                  Fit: <span className="font-bold text-amber-400 capitalize">{fitMode}</span>
                </button>

                {requiredSheets > 1 && (
                  <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
                    <button
                      disabled={activeSheetIndex === 0}
                      onClick={() => setActiveSheetIndex((i) => Math.max(0, i - 1))}
                      className="p-1 rounded hover:bg-slate-700 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold px-1 text-slate-300">
                      {activeSheetIndex + 1}/{requiredSheets}
                    </span>
                    <button
                      disabled={activeSheetIndex >= requiredSheets - 1}
                      onClick={() => setActiveSheetIndex((i) => Math.min(requiredSheets - 1, i + 1))}
                      className="p-1 rounded hover:bg-slate-700 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Realistic Sheet Frame */}
            <div className="flex justify-center p-2 sm:p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
              <div
                className={`w-full max-w-lg bg-white text-slate-900 rounded-xl shadow-2xl p-4 transition-all duration-300 relative ${
                  paperSize === 'A3' ? 'aspect-[297/420]' : 'aspect-[210/297]'
                }`}
              >
                {/* Visual Paper Gloss Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/20 pointer-events-none rounded-xl"></div>

                <div className="w-full h-full flex flex-col justify-between">
                  {/* Sheet Grid based on Layout */}
                  <div
                    className={`w-full h-full grid gap-2 ${
                      selectedLayout === '1_PHOTO'
                        ? 'grid-cols-1 grid-rows-1'
                        : selectedLayout === '2_PHOTOS'
                        ? 'grid-cols-1 grid-rows-2'
                        : selectedLayout === '4_PHOTOS'
                        ? 'grid-cols-2 grid-rows-2'
                        : 'grid-cols-3 grid-rows-3'
                    }`}
                  >
                    {currentSheetSlots.map((slot) => {
                      const hasPhoto = !!slot.previewUrl;
                      return (
                        <div
                          key={slot.slotIndex}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDropOnSlot(slot.slotIndex)}
                          draggable={hasPhoto}
                          onDragStart={() => setDraggedSlotIndex(slot.slotIndex)}
                          className={`rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden relative transition-all ${
                            hasPhoto
                              ? 'border-slate-300 bg-slate-50 cursor-grab active:cursor-grabbing hover:border-indigo-500 shadow-2xs'
                              : 'border-slate-200 bg-slate-50/50'
                          }`}
                        >
                          {hasPhoto && slot.previewUrl ? (
                            <>
                              <img
                                src={slot.previewUrl}
                                alt={slot.fileName || `Photo ${slot.slotIndex + 1}`}
                                className={`w-full h-full ${
                                  fitMode === 'cover' ? 'object-cover' : 'object-contain'
                                }`}
                              />
                              {/* Slot Tag Badge */}
                              <div className="absolute top-1 left-1 bg-slate-950/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-xs">
                                Slot {slot.slotIndex + 1}
                              </div>
                            </>
                          ) : (
                            <div className="text-center p-2 space-y-1">
                              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center mx-auto">
                                {slot.slotIndex + 1}
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                Empty Slot
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Printable Footer Notice on Sheet */}
                  <div className="pt-2 text-[9px] text-slate-400 flex items-center justify-between border-t border-slate-200 mt-2 select-none">
                    <span>RSCC High-Gloss {paperSize} Photo Sheet</span>
                    <span>{paperSize === 'A4' ? '210 × 297 mm' : '297 × 420 mm'} • {currentLayoutConfig.dimensionsText}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Calculation & Checkout Box */}
            <div className="bg-slate-800/90 rounded-2xl p-5 border border-slate-700 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-white text-sm">
                    {currentLayoutConfig.name} ({paperSize} Photo Sheet)
                  </div>
                  <div className="text-slate-400">
                    {uploadedPhotos.length} photos uploaded • <strong>{requiredSheets} {paperSize} sheet{requiredSheets > 1 ? 's' : ''}</strong> required
                  </div>
                </div>

                {/* Copies Counter */}
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-300">Copies:</span>
                  <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-1">
                    <button
                      onClick={() => setCopies(Math.max(1, copies - 1))}
                      className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center transition"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-bold text-white text-sm">
                      {copies}
                    </span>
                    <button
                      onClick={() => setCopies(copies + 1)}
                      className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Total Calculation Display */}
              <div className="pt-3 border-t border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400">
                    {requiredSheets} {paperSize} sheet{requiredSheets > 1 ? 's' : ''} × {copies} cop{copies > 1 ? 'ies' : 'y'} × ₹{ratePerSheet}/sheet
                  </div>
                  <div className="text-2xl font-black text-amber-400">
                    Total: ₹{totalAmount}
                  </div>
                </div>

                {settings.isAcceptingOrders === false ? (
                  <button
                    type="button"
                    disabled
                    className="bg-rose-950/80 border border-rose-600 text-rose-300 font-extrabold text-xs px-4 py-3 rounded-xl transition shadow flex items-center gap-2 cursor-not-allowed text-left max-w-xs"
                  >
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>NOT ACCEPTING ORDERS (HIGH DEMAND)</span>
                  </button>
                ) : (
                  <button
                    onClick={handleProceed}
                    disabled={uploadedPhotos.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-sm px-6 py-3 rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <span>PROCEED TO UPI PAYMENT • ₹{totalAmount}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
