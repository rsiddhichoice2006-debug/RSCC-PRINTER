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
} from 'lucide-react';
import {
  CustomerDetails,
  CustomerUser,
  PhotoLayoutType,
  PhotoOrientation,
  PhotoSlotItem,
  ShopSettings,
  UploadedFileItem,
} from '../types';
import { PHOTO_LAYOUTS, calculateRequiredSheets, generateSheetSlots } from '../utils/photoLayouts';
import { formatFileSize, processUploadedFile } from '../utils/fileProcessor';

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
    name: loggedInCustomer?.name || '',
    mobile: loggedInCustomer?.mobile || '',
    email: loggedInCustomer?.email || '',
    specialInstructions: '',
  });

  // Sync if customer logs in
  useEffect(() => {
    if (loggedInCustomer) {
      setCustomer((prev) => ({
        ...prev,
        name: prev.name || loggedInCustomer.name,
        mobile: prev.mobile || loggedInCustomer.mobile,
        email: prev.email || loggedInCustomer.email || '',
      }));
    }
  }, [loggedInCustomer]);
  const [customerErrors, setCustomerErrors] = useState<{ name?: string; mobile?: string }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentLayoutConfig = PHOTO_LAYOUTS[selectedLayout];
  const requiredSheets = calculateRequiredSheets(uploadedPhotos.length, selectedLayout);

  // Keep activeSheetIndex in valid range
  if (activeSheetIndex >= requiredSheets && requiredSheets > 0) {
    setActiveSheetIndex(requiredSheets - 1);
  }

  const currentSheetSlots = generateSheetSlots(uploadedPhotos, selectedLayout, activeSheetIndex);

  const ratePerSheet = settings.pricing.photoSheet || 15;
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
    if (uploadedPhotos.length === 0) {
      alert('Please upload at least one photo before proceeding.');
      return;
    }

    if (!validateCustomer()) {
      return;
    }

    const orderPayload = {
      mode: 'PHOTO',
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
      specialInstructions: customer.specialInstructions?.trim() || undefined,
    };

    onProceedToPayment(orderPayload);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
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
            Choose your layout, upload photos, and preview them live on realistic A4 printing sheets. Printed on high-gloss photo paper.
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 text-center shrink-0 min-w-[160px]">
          <div className="text-xs text-slate-400 font-medium">Photo Print Rate</div>
          <div className="text-2xl font-black text-amber-400">₹{ratePerSheet}</div>
          <div className="text-[11px] text-slate-400">per A4 Sheet</div>
        </div>
      </div>

      {/* Step 1: Layout Selection Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              1. Select A4 Photo Layout
            </h2>
            <p className="text-xs text-slate-600">
              Choose how many photos you want arranged on each A4 sheet.
            </p>
          </div>
        </div>

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
                    {/* Visual Miniature A4 Sheet representation */}
                    <div className="w-24 h-32 mx-auto bg-slate-950 border border-slate-700 rounded-lg p-1.5 shadow-md flex flex-col justify-between relative overflow-hidden">
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

                    <pre className="inline-block text-left text-[8px] opacity-85 text-amber-300/90 font-mono tracking-tighter">{config.asciiPreview}</pre>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">
                      {config.name}
                    </h3>
                    <div className="text-xs font-bold text-indigo-700 mt-0.5">
                      {config.dimensionsText}
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

      {/* Main Studio Grid: Upload Area & Live A4 Sheet Preview */}
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
                  <button
                    onClick={() => setUploadedPhotos([])}
                    className="text-rose-600 hover:text-rose-700 text-xs"
                  >
                    Clear All
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {uploadedPhotos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={photo.previewUrl}
                          alt={photo.name}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-300 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            #{idx + 1} {photo.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {formatFileSize(photo.size)}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => removePhoto(photo.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Remove photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fit mode selector */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
              <span className="font-semibold">Photo Fit Style:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFitMode('cover')}
                  className={`px-2.5 py-1 rounded-md font-medium text-xs ${
                    fitMode === 'cover'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Fill Slot (Cover)
                </button>
                <button
                  onClick={() => setFitMode('contain')}
                  className={`px-2.5 py-1 rounded-md font-medium text-xs ${
                    fitMode === 'contain'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Keep Whole (Contain)
                </button>
              </div>
            </div>
          </div>

          {/* Customer Details Form */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-black text-slate-900 text-base">
              Customer Information
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Patil"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-slate-900 text-sm focus:outline-none focus:ring-2 ${
                    customerErrors.name
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                />
                {customerErrors.name && (
                  <span className="text-[11px] text-rose-600 mt-0.5 block">
                    {customerErrors.name}
                  </span>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mobile Number (for Order Tracking) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={customer.mobile}
                  onChange={(e) => setCustomer({ ...customer, mobile: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-slate-900 text-sm focus:outline-none focus:ring-2 ${
                    customerErrors.mobile
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                />
                {customerErrors.mobile && (
                  <span className="text-[11px] text-rose-600 mt-0.5 block">
                    {customerErrors.mobile}
                  </span>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Special Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Please leave white border around each photo."
                  value={customer.specialInstructions}
                  onChange={(e) => setCustomer({ ...customer, specialInstructions: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live A4 Visual Canvas & Pricing Card (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-slate-800 space-y-6">
            {/* Sheet Toolbar & Pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg text-white">
                    Live A4 Print Preview
                  </span>
                  <span className="bg-indigo-900 text-indigo-200 text-xs font-bold px-2.5 py-0.5 rounded-md border border-indigo-700">
                    A4 (210 × 297 mm)
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Drag & drop or swap photo slots to rearrange photos.
                </p>
              </div>

              {/* Multi-sheet Pagination */}
              {requiredSheets > 1 && (
                <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
                  <button
                    disabled={activeSheetIndex === 0}
                    onClick={() => setActiveSheetIndex(activeSheetIndex - 1)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold px-2 text-amber-400">
                    Sheet {activeSheetIndex + 1} of {requiredSheets}
                  </span>
                  <button
                    disabled={activeSheetIndex >= requiredSheets - 1}
                    onClick={() => setActiveSheetIndex(activeSheetIndex + 1)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Realistic A4 Physical Sheet Canvas Preview */}
            <div className="flex justify-center items-center py-4 bg-slate-950/60 rounded-2xl p-4 overflow-hidden">
              <div
                className={`bg-white text-slate-900 shadow-2xl rounded-sm p-4 sm:p-6 transition-all duration-300 relative border border-slate-200 ${
                  selectedLayout === '1_PHOTO' && photoOrientation === 'LANDSCAPE'
                    ? 'w-full max-w-[560px] aspect-[297/210]'
                    : 'w-full max-w-[420px] aspect-[210/297]'
                }`}
                style={{
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1)',
                }}
              >
                {/* A4 Printable Boundary Marker */}
                <div className="w-full h-full border border-dashed border-slate-300 p-2 sm:p-3 flex flex-col justify-between relative">
                  {/* Grid Layout Container */}
                  <div
                    className={`grid gap-2 sm:gap-3 w-full h-full ${
                      selectedLayout === '9_PHOTOS'
                        ? 'grid-cols-3 grid-rows-3'
                        : selectedLayout === '4_PHOTOS'
                        ? 'grid-cols-2 grid-rows-2'
                        : selectedLayout === '2_PHOTOS'
                        ? 'grid-cols-1 grid-rows-2'
                        : 'grid-cols-1 grid-rows-1'
                    }`}
                  >
                    {currentSheetSlots.map((slot) => {
                      const isOccupied = !!slot.previewUrl;

                      return (
                        <div
                          key={slot.slotIndex}
                          draggable={isOccupied}
                          onDragStart={() => setDraggedSlotIndex(slot.slotIndex)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDropOnSlot(slot.slotIndex)}
                          className={`relative rounded-md overflow-hidden transition flex items-center justify-center ${
                            isOccupied
                              ? 'border border-slate-400/80 bg-slate-100 shadow-xs cursor-move hover:ring-2 hover:ring-indigo-500'
                              : 'border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400'
                          }`}
                        >
                          {isOccupied ? (
                            <>
                              <img
                                src={slot.previewUrl}
                                alt={slot.fileName || 'Photo'}
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
                    <span>RSCC High-Gloss A4 Photo Sheet</span>
                    <span>{currentLayoutConfig.dimensionsText}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Calculation & Checkout Box */}
            <div className="bg-slate-800/90 rounded-2xl p-5 border border-slate-700 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-white text-sm">
                    {currentLayoutConfig.name}
                  </div>
                  <div className="text-slate-400">
                    {uploadedPhotos.length} photos uploaded • <strong>{requiredSheets} A4 sheet{requiredSheets > 1 ? 's' : ''}</strong> required
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
                    {requiredSheets} sheet{requiredSheets > 1 ? 's' : ''} × {copies} cop{copies > 1 ? 'ies' : 'y'} × ₹{ratePerSheet}/sheet
                  </div>
                  <div className="text-2xl font-black text-amber-400">
                    Total: ₹{totalAmount}
                  </div>
                </div>

                <button
                  onClick={handleProceed}
                  disabled={uploadedPhotos.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-sm px-6 py-3 rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <span>PROCEED TO PAYMENT</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
