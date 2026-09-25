import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Info,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Printer,
  Sparkles,
  Layers,
  HelpCircle,
  FileSpreadsheet,
  Sliders,
  Lock,
} from 'lucide-react';
import {
  CustomerDetails,
  CustomerUser,
  PageSelectionMode,
  PaperQuality,
  PaperSize,
  PrintType,
  PrintingSide,
  ShopSettings,
  UploadedFileItem,
} from '../types';
import { formatFileSize, processUploadedFile } from '../utils/fileProcessor';
import { getSelectedPageCount } from '../utils/pageCalculator';
import {
  DEFAULT_PRICING,
  getDocumentRate,
  getAdditionalSetRate,
  calculateDocumentOrderAmount,
  getAvailableQualitiesForPrintType,
} from '../utils/pricingCalculator';
import { useAuth } from '../context/AuthContext';

interface UploadPrintPageProps {
  settings: ShopSettings;
  sampleParams?: {
    totalPages: number;
    copies: number;
    printType: PrintType;
    printingSide: PrintingSide;
  };
  onProceedToPayment: (orderData: any) => void;
  loggedInCustomer?: CustomerUser | null;
}

export const UploadPrintPage: React.FC<UploadPrintPageProps> = ({
  settings,
  sampleParams,
  onProceedToPayment,
  loggedInCustomer,
}) => {
  const { currentUser, customerProfile, openAuthModal } = useAuth();
  const isCustomerLoggedIn = !!(currentUser || customerProfile || loggedInCustomer);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Printing Preferences: Paper Size, Print Type, Paper Quality (GSM), Printing Side, Copies
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [printType, setPrintType] = useState<PrintType>(sampleParams?.printType || 'BW');
  const [paperQuality, setPaperQuality] = useState<PaperQuality>('75_GSM');
  const [printingSide, setPrintingSide] = useState<PrintingSide>(sampleParams?.printingSide || 'SINGLE');
  const [copies, setCopies] = useState<number>(sampleParams?.copies || 1);

  // Customer Details Form (prefill if logged in)
  const [customer, setCustomer] = useState<CustomerDetails>({
    name: loggedInCustomer?.name || customerProfile?.name || currentUser?.displayName || '',
    mobile: loggedInCustomer?.mobile || customerProfile?.mobile || '',
    email: loggedInCustomer?.email || currentUser?.email || customerProfile?.email || '',
    specialInstructions: '',
  });

  // Sync when logged in
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

  // Enforce Rule: When Colour is selected, 75 GSM is not available (auto-switch to 100 GSM)
  useEffect(() => {
    if (printType === 'COLOUR' && paperQuality === '75_GSM') {
      setPaperQuality('100_GSM');
    }
  }, [printType, paperQuality]);

  // Handle Sample Parameters prefill from acceptance tests
  useEffect(() => {
    if (sampleParams) {
      setPrintType(sampleParams.printType);
      setPrintingSide(sampleParams.printingSide);
      setCopies(sampleParams.copies);

      // Create synthetic sample files for testing if none exist
      if (uploadedFiles.length === 0 && sampleParams.totalPages) {
        setUploadedFiles([
          {
            id: 'sample-test-file',
            file: new File(['sample'], 'Document_Sample.pdf', { type: 'application/pdf' }),
            name: `Sample_Document_${sampleParams.totalPages}p.pdf`,
            size: sampleParams.totalPages * 180000,
            type: 'application/pdf',
            pageCount: sampleParams.totalPages,
            isProcessing: false,
            moderationStatus: 'SAFE',
            moderationReason: 'Sample verified test document',
          },
        ]);
      }
    }
  }, [sampleParams]);

  // Compute Total Pages across all uploaded valid files using individual page selections
  const validFiles = uploadedFiles.filter(
    (f) => !f.error && f.moderationStatus !== 'FLAGGED' && f.pageCount > 0
  ).map((f) => ({
    ...f,
    selectedPageCount: getSelectedPageCount(f.pageCount, f.pageSelectionMode || 'ALL', f.customPageRange || ''),
  }));

  const totalPages = validFiles.reduce(
    (acc, f) => acc + (f.selectedPageCount || f.pageCount),
    0
  );

  // STRICT RULE: ONLY WHEN FILE CONTAINS MORE THAN 1 PAGE ENABLE BOTH SIDE PRINT OPTION
  const isBothSideAllowed = totalPages > 1;

  // Auto-switch to SINGLE if totalPages <= 1 and BOTH was selected
  useEffect(() => {
    if (!isBothSideAllowed && printingSide === 'BOTH') {
      setPrintingSide('SINGLE');
    }
  }, [isBothSideAllowed, printingSide]);

  // Price Calculation according to RSCC Dynamic Pricing Engine
  const pricing = settings.pricing || DEFAULT_PRICING;
  const ratePerPage = getDocumentRate(paperSize, printType, paperQuality, printingSide, pricing);
  const copyRatePerPage = getAdditionalSetRate(paperSize, printType, printingSide, pricing);

  // Set-based pricing: Set 1 @ standard rate; Sets 2+ @ discounted copy rate
  const { totalAmount, firstSetCost, additionalSetsCost, additionalSetsCount } =
    calculateDocumentOrderAmount(totalPages, copies, ratePerPage, copyRatePerPage);

  const handleFileSetsChange = (fileId: string, newSets: number) => {
    const validSets = Math.max(1, newSets);
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, sets: validSets } : f))
    );
    setCopies(validSets);
  };

  const handleGlobalSetsChange = (newSets: number) => {
    const validSets = Math.max(1, newSets);
    setCopies(validSets);
    setUploadedFiles((prev) => prev.map((f) => ({ ...f, sets: validSets })));
  };

  // Handle Drag & Drop Files
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setIsProcessingFiles(true);
    const newItems: UploadedFileItem[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const rawFile = fileList[i];
      const maxBytes = (settings.maxFileSizeMb || 50) * 1024 * 1024;

      if (rawFile.size > maxBytes) {
        newItems.push({
          id: `f-${Date.now()}-${i}`,
          file: rawFile,
          name: rawFile.name,
          size: rawFile.size,
          type: rawFile.type || 'application/octet-stream',
          pageCount: 0,
          isProcessing: false,
          error: `File size exceeds ${settings.maxFileSizeMb}MB limit.`,
          moderationStatus: 'SAFE',
        });
        continue;
      }

      // Initial loading state item
      const tempId = `f-${Date.now()}-${i}`;
      const placeholderItem: UploadedFileItem = {
        id: tempId,
        file: rawFile,
        name: rawFile.name,
        size: rawFile.size,
        type: rawFile.type || 'application/octet-stream',
        pageCount: 1,
        isProcessing: true,
        moderationStatus: 'PENDING',
      };
      newItems.push(placeholderItem);
    }

    setUploadedFiles((prev) => [...prev, ...newItems]);

    // Process each file in background (page count detection + safety check)
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      if (item.error) continue;

      try {
        const processed = await processUploadedFile(item.file);
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  pageCount: processed.pageCount,
                  previewUrl: processed.previewUrl,
                  isProcessing: false,
                  moderationStatus: processed.moderationStatus,
                  moderationReason: processed.moderationReason,
                }
              : f
          )
        );
      } catch (err: any) {
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  isProcessing: false,
                  error: 'Failed to read file pages. Defaulted to 1 page.',
                  pageCount: 1,
                  moderationStatus: 'SAFE',
                }
              : f
          )
        );
      }
    }

    setIsProcessingFiles(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updatePageSelection = (id: string, mode: PageSelectionMode, customRange?: string) => {
    setUploadedFiles((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const newRange = customRange !== undefined ? customRange : f.customPageRange || '';
        return {
          ...f,
          pageSelectionMode: mode,
          customPageRange: newRange,
          selectedPageCount: getSelectedPageCount(f.pageCount, mode, newRange),
        };
      })
    );
  };

  const validateCustomerForm = (): boolean => {
    const errors: { name?: string; mobile?: string } = {};
    if (!customer.name.trim()) {
      errors.name = 'Please enter your full name.';
    }
    if (!customer.mobile.trim() || customer.mobile.trim().length < 10) {
      errors.mobile = 'Please enter a valid 10-digit mobile number for pickup updates.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProceed = () => {
    if (settings.isAcceptingOrders === false) {
      alert(settings.pauseOrderReason || 'Currently Not Accepting Orders Due to High Demand.');
      return;
    }

    if (validFiles.length === 0) {
      alert('Please upload at least one valid document file (PDF, Word, Image, etc.).');
      fileInputRef.current?.click();
      return;
    }

    if (hasFlaggedFiles) {
      alert('Your upload contains flagged content that violates our printing policy. Please remove the flagged item to proceed.');
      return;
    }

    if (!isCustomerLoggedIn) {
      openAuthModal('login', 'Customer Login Required to Place Order', () => {
        handleProceed();
      });
      return;
    }

    if (!validateCustomerForm()) {
      return;
    }

    const orderPayload = {
      mode: 'DOCUMENT',
      paperSize,
      paperQuality,
      customer: {
        name: customer.name.trim(),
        mobile: customer.mobile.trim(),
        email: customer.email?.trim() || undefined,
      },
      files: validFiles.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        pageCount: f.pageCount,
        sets: f.sets || copies,
        pageSelectionMode: f.pageSelectionMode || 'ALL',
        customPageRange: f.customPageRange,
        selectedPageCount: f.selectedPageCount || f.pageCount,
        previewUrl: f.previewUrl,
        moderationStatus: f.moderationStatus,
        moderationReason: f.moderationReason,
      })),
      totalPages,
      copies,
      sets: copies,
      printType,
      printingSide,
      ratePerPage,
      copyRatePerPage,
      totalAmount,
      specialInstructions: customer.specialInstructions?.trim() || undefined,
    };

    onProceedToPayment(orderPayload);
  };

  const hasFlaggedFiles = uploadedFiles.some((f) => f.moderationStatus === 'FLAGGED');
  const availableQualities = getAvailableQualitiesForPrintType(printType);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Not Accepting Orders Banner */}
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
                  {settings.pauseOrderReason || 'Currently Not Accepting Orders Due to High Demand'}
                </span>
              </div>
              <p className="text-xs text-rose-200 leading-relaxed max-w-3xl">
                Our shop printing counter is experiencing peak queue demand. Document order submissions are temporarily paused so we can process existing jobs. Please visit our shop directly at {settings.address} or check back shortly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-emerald-500 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
            <Printer className="w-3.5 h-3.5" />
            <span>Document Printing</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Upload & Print Documents
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Upload your PDF, Word, PowerPoint, Excel, or Image files. Choose your paper size, print type, paper quality (GSM), and printing side for instant transparent pricing.
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 text-left shrink-0 text-xs text-slate-300 space-y-1">
          <div className="font-bold text-amber-400">RSCC Rate Card:</div>
          <div>A4 B&W 75 GSM: ₹{pricing.a4Bw75Single || 5} / ₹{pricing.a4Bw75Both || 5}</div>
          <div>A4 Colour 100 GSM: ₹{pricing.a4Color100Single || 10} / ₹{pricing.a4Color100Both || 10}</div>
          <div>A3 B&W 75 GSM: ₹{pricing.a3Bw75Single || 10} / ₹{pricing.a3Bw75Both || 20}</div>
        </div>
      </div>

      {/* Main Grid: Upload & File Manager (Left) + Options & Checkout (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Upload Area & File Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Large Drag & Drop Upload Zone */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-700" />
                Upload Your Documents
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                Max {settings.maxFileSizeMb}MB per file
              </span>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                <Upload className="w-7 h-7" />
              </div>

              <div>
                <div className="text-base font-bold text-slate-900">
                  Click to upload or drag & drop documents here
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Supports PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), and Images (PNG, JPG)
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 mt-2">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> AI Moderation
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" /> Auto Page Counter
                </span>
              </div>
            </div>
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <span>Uploaded Files</span>
                  <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    {uploadedFiles.length} file{uploadedFiles.length === 1 ? '' : 's'}
                  </span>
                </h3>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add More Files</span>
                </button>
              </div>

              <div className="space-y-3">
                {uploadedFiles.map((fileItem) => {
                  const isFlagged = fileItem.moderationStatus === 'FLAGGED';
                  const currentMode = fileItem.pageSelectionMode || 'ALL';
                  const effectiveCount = getSelectedPageCount(
                    fileItem.pageCount,
                    currentMode,
                    fileItem.customPageRange || ''
                  );

                  return (
                    <div
                      key={fileItem.id}
                      className={`p-4 rounded-2xl border transition flex flex-col gap-3.5 ${
                        isFlagged
                          ? 'bg-rose-50/70 border-rose-200'
                          : fileItem.error
                          ? 'bg-amber-50/70 border-amber-200'
                          : 'bg-slate-50/90 hover:bg-slate-50 border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isFlagged
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            <FileText className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                              {fileItem.name}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <span>{formatFileSize(fileItem.size)}</span>
                              <span>•</span>
                              <span className="font-semibold text-slate-700">
                                {fileItem.isProcessing ? (
                                  <span className="text-amber-600 flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 animate-spin" /> Counting pages...
                                  </span>
                                ) : (
                                  `${fileItem.pageCount} total page${fileItem.pageCount === 1 ? '' : 's'}`
                                )}
                              </span>

                              {isFlagged && (
                                <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                                  <AlertTriangle className="w-3 h-3" /> Flagged Content
                                </span>
                              )}
                            </div>

                            {isFlagged && fileItem.moderationReason && (
                              <p className="text-[11px] text-rose-700 font-medium pt-1">
                                {fileItem.moderationReason}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Number of Sets Required & Page count editor & Delete action */}
                        <div className="flex items-center flex-wrap gap-2.5 self-end sm:self-center">
                          {!fileItem.isProcessing && !isFlagged && (
                            <>
                              {/* Number of Sets Required */}
                              <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-lg p-1 shadow-2xs">
                                <span className="text-[11px] text-amber-950 pl-1.5 font-bold">
                                  Sets:
                                </span>
                                <div className="flex items-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleFileSetsChange(
                                        fileItem.id,
                                        Math.max(1, (fileItem.sets || copies || 1) - 1)
                                      )
                                    }
                                    className="w-5 h-5 rounded bg-white text-slate-800 hover:bg-amber-100 flex items-center justify-center font-bold text-xs border border-amber-200 cursor-pointer transition shadow-2xs"
                                    title="Decrease sets required"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    max={99}
                                    value={fileItem.sets || copies || 1}
                                    onChange={(e) =>
                                      handleFileSetsChange(
                                        fileItem.id,
                                        Math.max(1, parseInt(e.target.value) || 1)
                                      )
                                    }
                                    className="w-8 text-center text-xs font-black text-amber-950 bg-transparent focus:outline-none"
                                    title="Number of sets required"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleFileSetsChange(
                                        fileItem.id,
                                        (fileItem.sets || copies || 1) + 1
                                      )
                                    }
                                    className="w-5 h-5 rounded bg-white text-slate-800 hover:bg-amber-100 flex items-center justify-center font-bold text-xs border border-amber-200 cursor-pointer transition shadow-2xs"
                                    title="Increase sets required"
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="text-[10px] text-amber-800 pr-1 font-semibold">
                                  set{(fileItem.sets || copies || 1) > 1 ? 's' : ''}
                                </span>
                              </div>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => removeFile(fileItem.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Remove File"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Page Selection Controls */}
                      {!fileItem.isProcessing && !isFlagged && (
                        <div className="bg-white/90 rounded-xl p-3 border border-slate-200/80 space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Pages to Print:</span>
                            </div>

                            <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-950 font-bold px-2.5 py-1 rounded-lg text-[11px]">
                              <span>Printing</span>
                              <span className="bg-indigo-600 text-white px-1.5 py-0.2 rounded font-mono">
                                {effectiveCount}
                              </span>
                              <span>of {fileItem.pageCount} pages</span>
                            </div>
                          </div>

                          {/* Options: All, Odd, Even, Custom */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            <button
                              type="button"
                              onClick={() => updatePageSelection(fileItem.id, 'ALL')}
                              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                                currentMode === 'ALL'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              <span>All Pages</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => updatePageSelection(fileItem.id, 'ODD')}
                              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                                currentMode === 'ODD'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              <span>Odd Pages</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => updatePageSelection(fileItem.id, 'EVEN')}
                              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                                currentMode === 'EVEN'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              <span>Even Pages</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => updatePageSelection(fileItem.id, 'CUSTOM')}
                              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                                currentMode === 'CUSTOM'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              <span>Custom</span>
                            </button>
                          </div>

                          {/* Custom Page Input */}
                          {currentMode === 'CUSTOM' && (
                            <div className="pt-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="e.g. 1-3, 5, 8-10"
                                  value={fileItem.customPageRange || ''}
                                  onChange={(e) =>
                                    updatePageSelection(fileItem.id, 'CUSTOM', e.target.value)
                                  }
                                  className="w-full text-xs font-medium text-slate-900 px-3 py-1.5 bg-slate-50 border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                              </div>
                              <p className="text-[10px] text-slate-500">
                                Enter individual page numbers and/or ranges separated by commas (Max: {fileItem.pageCount})
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {hasFlaggedFiles && (
                <div className="bg-rose-100 border border-rose-300 rounded-xl p-4 text-rose-900 text-xs space-y-2">
                  <div className="font-bold text-sm flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-700" />
                    <span>Content Safety Policy Notice</span>
                  </div>
                  <p>
                    This file cannot be accepted for printing because it contains content that is not permitted by our printing policy.
                  </p>
                  <button
                    onClick={() => {
                      setUploadedFiles((prev) =>
                        prev.filter((f) => f.moderationStatus !== 'FLAGGED')
                      );
                      fileInputRef.current?.click();
                    }}
                    className="bg-rose-800 hover:bg-rose-900 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
                  >
                    UPLOAD ANOTHER FILE
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Customer Details Form */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-base">
                Customer Information
              </h3>
              {isCustomerLoggedIn && (
                <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Verified Account
                </span>
              )}
            </div>

            {!isCustomerLoggedIn && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black">Customer Login Required</div>
                    <div className="text-[11px] text-amber-800">You must be logged in to your account before placing your print order.</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openAuthModal('login', 'Customer Login Required to Place Order')}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-black rounded-lg transition shrink-0 cursor-pointer shadow-xs"
                >
                  Log In / Sign Up
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
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
                    formErrors.name
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-slate-300 focus:ring-emerald-500'
                  }`}
                />
                {formErrors.name && (
                  <span className="text-[11px] text-rose-600 mt-0.5 block">
                    {formErrors.name}
                  </span>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mobile Number (for Pickup Tracking) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={customer.mobile}
                  onChange={(e) => setCustomer({ ...customer, mobile: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-slate-900 text-sm focus:outline-none focus:ring-2 ${
                    formErrors.mobile
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-slate-300 focus:ring-emerald-500'
                  }`}
                />
                {formErrors.mobile && (
                  <span className="text-[11px] text-rose-600 mt-0.5 block">
                    {formErrors.mobile}
                  </span>
                )}
              </div>
            </div>

            <div className="text-xs space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. ramesh@example.com"
                  value={customer.email}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Special Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Staple top-left corner, print first page on glossy, spiral binding if available."
                  value={customer.specialInstructions}
                  onChange={(e) =>
                    setCustomer({ ...customer, specialInstructions: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Delivery Method notice */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
              <span className="font-semibold">Delivery Method:</span>
              <span className="bg-slate-200 text-slate-800 font-bold px-2.5 py-1 rounded-md text-[11px]">
                Pickup From RSCC Counter ({settings.pickupTimings || '9:00 AM - 9:00 PM'})
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Printing Options, Dynamic Price Calculator & Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xl space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Printing Preferences
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize your paper size, print type, paper quality, and side.
              </p>
            </div>

            {/* 1. PAPER SIZE DROPDOWN (A4 / A3) */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Paper Size
              </label>

              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 bg-slate-50 text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              >
                <option value="A4">A4 (Standard Document - 210 × 297 mm)</option>
                <option value="A3">A3 (Large Format Sheet - 297 × 420 mm)</option>
              </select>
            </div>

            {/* 2. PRINT TYPE DROPDOWN (Black & White / Colour) */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Print Type
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPrintType('BW')}
                  className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    printType === 'BW'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs">Black & White</div>
                    <div
                      className={`text-[11px] ${
                        printType === 'BW' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      B&W Print
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      printType === 'BW' ? 'border-amber-400 bg-amber-400' : 'border-slate-400'
                    }`}
                  >
                    {printType === 'BW' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintType('COLOUR')}
                  className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    printType === 'COLOUR'
                      ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-500/30'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-950" />
                      Colour Print
                    </div>
                    <div
                      className={`text-[11px] ${
                        printType === 'COLOUR' ? 'text-slate-900 font-semibold' : 'text-slate-500'
                      }`}
                    >
                      Vivid Laser
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      printType === 'COLOUR' ? 'border-slate-950 bg-slate-950' : 'border-slate-400'
                    }`}
                  >
                    {printType === 'COLOUR' && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </div>
                </button>
              </div>
            </div>

            {/* 3. PAPER QUALITY / GSM DROPDOWN (75 GSM / 100 GSM) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Paper Quality
                </label>
                {printType === 'COLOUR' && (
                  <span className="text-[10px] text-amber-800 bg-amber-100 font-bold px-2 py-0.5 rounded">
                    Colour requires 100 GSM
                  </span>
                )}
              </div>

              <select
                value={paperQuality}
                onChange={(e) => setPaperQuality(e.target.value as PaperQuality)}
                className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 bg-slate-50 text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              >
                {availableQualities.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. PRINTING SIDE SELECTION (Single Side / Both Side) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Printing Side
                </label>
                {!isBothSideAllowed && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                    Both-side requires &gt;1 page
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPrintingSide('SINGLE')}
                  className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    printingSide === 'SINGLE'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs">Single Side</div>
                    <div
                      className={`text-[11px] ${
                        printingSide === 'SINGLE' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      ₹{getDocumentRate(paperSize, printType, paperQuality, 'SINGLE', pricing)}/page
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      printingSide === 'SINGLE' ? 'border-amber-400 bg-amber-400' : 'border-slate-400'
                    }`}
                  >
                    {printingSide === 'SINGLE' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!isBothSideAllowed}
                  onClick={() => {
                    if (isBothSideAllowed) setPrintingSide('BOTH');
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between ${
                    !isBothSideAllowed
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                      : printingSide === 'BOTH'
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-600/20 cursor-pointer'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 cursor-pointer'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      Both Side
                    </div>
                    <div
                      className={`text-[11px] ${
                        printingSide === 'BOTH' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      ₹{getDocumentRate(paperSize, printType, paperQuality, 'BOTH', pricing)}/page
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      printingSide === 'BOTH' ? 'border-white bg-white' : 'border-slate-400'
                    }`}
                  >
                    {printingSide === 'BOTH' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-700" />}
                  </div>
                </button>
              </div>
            </div>

            {/* 5. NUMBER OF SETS REQUIRED */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Number of Sets Required
                </label>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                  {copies === 1 ? '1 Set (Standard Rate)' : `${copies} Sets (Discounted Copy Rates)`}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pl-1">
                    <div className="text-xs text-slate-800 font-bold">
                      Sets to Print:
                    </div>
                    <div className="text-[11px] text-slate-500">
                      1st set: ₹{ratePerPage}/pg • 2nd+ set: <span className="font-bold text-emerald-700">₹{copyRatePerPage}/pg</span>
                    </div>
                  </div>

                  <div className="flex items-center bg-white border border-slate-300 rounded-xl p-1 shadow-xs">
                    <button
                      type="button"
                      onClick={() => handleGlobalSetsChange(Math.max(1, copies - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-base flex items-center justify-center transition cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-10 text-center font-extrabold text-slate-900 text-sm font-mono">
                      {copies}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleGlobalSetsChange(copies + 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-base flex items-center justify-center transition cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="text-[11px] bg-amber-50/70 border border-amber-200 rounded-xl p-2 text-amber-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>
                    <strong>Multi-Set Rule:</strong> 1st set is ₹{ratePerPage}/pg, all subsequent sets count at ₹{copyRatePerPage}/pg!
                  </span>
                </div>
              </div>
            </div>

            {/* DYNAMIC ORDER SUMMARY BLOCK */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Printer className="w-4 h-4" />
                  ORDER SUMMARY
                </h3>
                <span className="text-[11px] text-slate-400">
                  {validFiles.length} file{validFiles.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Files summary list */}
              {validFiles.length > 0 ? (
                <div className="space-y-1.5 text-xs text-slate-300 max-h-28 overflow-y-auto pr-1">
                  {validFiles.map((f) => (
                    <div key={f.id} className="flex justify-between items-center text-[11px]">
                      <span className="truncate max-w-[180px]">• {f.name}</span>
                      <span className="font-mono text-slate-400">
                        {f.pageCount} pgs × {f.sets || copies} set{(f.sets || copies) > 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic">
                  No files uploaded yet. Upload document above.
                </div>
              )}

              <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Paper Size:</span>
                  <span className="font-bold text-white">{paperSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Print Type:</span>
                  <span className="font-bold text-white">
                    {printType === 'BW' ? 'Black & White' : 'Colour'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Paper Quality:</span>
                  <span className="font-bold text-white">
                    {paperQuality === '75_GSM' ? '75 GSM' : '100 GSM'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Printing Side:</span>
                  <span className="font-bold text-white">
                    {printingSide === 'BOTH' ? 'Both Side' : 'Single Side'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Pages (1 Set):</span>
                  <span className="font-bold text-white font-mono">{totalPages} pages</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sets Required:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {copies} {copies === 1 ? 'set' : 'sets'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">1st Set Rate:</span>
                  <span className="font-bold text-white font-mono">₹{ratePerPage}/page</span>
                </div>
                {copies > 1 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">2nd+ Sets Copy Rate:</span>
                    <span className="font-bold text-emerald-400 font-mono">₹{copyRatePerPage}/page</span>
                  </div>
                )}
              </div>

              {/* Exact Formula & Total Amount */}
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 space-y-1 text-[11px] font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span>• 1st Set ({totalPages} pgs × ₹{ratePerPage}):</span>
                    <span className="text-white font-bold">₹{firstSetCost}</span>
                  </div>
                  {copies > 1 && (
                    <div className="flex justify-between text-emerald-300">
                      <span>• Extra {additionalSetsCount} Set{additionalSetsCount > 1 ? 's' : ''} ({totalPages * additionalSetsCount} pgs × ₹{copyRatePerPage}):</span>
                      <span className="font-bold">+₹{additionalSetsCost}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Total Payable Amount:
                    </div>
                    <div className="text-2xl font-black text-amber-400 tracking-tight font-mono">
                      ₹{totalAmount}
                    </div>
                  </div>

                {settings.isAcceptingOrders === false ? (
                  <button
                    type="button"
                    disabled
                    className="bg-rose-950/80 border border-rose-600 text-rose-300 font-extrabold text-xs px-4 py-3 rounded-xl transition flex items-center gap-2 cursor-not-allowed"
                  >
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>NOT ACCEPTING ORDERS</span>
                  </button>
                ) : !isCustomerLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => openAuthModal('login', 'Customer Login Required to Place Order', () => handleProceed())}
                    disabled={validFiles.length === 0 || hasFlaggedFiles}
                    className="bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-white font-extrabold text-sm px-5 py-3 rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>LOG IN TO PLACE ORDER</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleProceed}
                    disabled={validFiles.length === 0 || hasFlaggedFiles}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-sm px-5 py-3 rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <span>PROCEED TO PAYMENT</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Explanatory Note */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-amber-700" />
              <span>RSCC Transparent Pricing Policy:</span>
            </div>
            <p>
              Price is strictly computed as <strong>1st Set @ ₹{ratePerPage}/pg</strong> and <strong>additional sets @ ₹{copyRatePerPage}/pg</strong> for your chosen paper size ({paperSize}) and print type ({printType === 'BW' ? 'B&W' : 'Colour'}).
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
