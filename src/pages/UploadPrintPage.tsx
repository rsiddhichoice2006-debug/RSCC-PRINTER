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
} from 'lucide-react';
import {
  CustomerDetails,
  CustomerUser,
  PrintType,
  PrintingSide,
  ShopSettings,
  UploadedFileItem,
} from '../types';
import { formatFileSize, processUploadedFile } from '../utils/fileProcessor';

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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Printing Preferences
  const [printType, setPrintType] = useState<PrintType>(sampleParams?.printType || 'BW');
  const [printingSide, setPrintingSide] = useState<PrintingSide>(sampleParams?.printingSide || 'SINGLE');
  const [copies, setCopies] = useState<number>(sampleParams?.copies || 1);

  // Customer Details Form (prefill if logged in)
  const [customer, setCustomer] = useState<CustomerDetails>({
    name: loggedInCustomer?.name || '',
    mobile: loggedInCustomer?.mobile || '',
    email: loggedInCustomer?.email || '',
    specialInstructions: '',
  });

  // Sync when logged in
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
  const [formErrors, setFormErrors] = useState<{ name?: string; mobile?: string }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Compute Total Pages across all uploaded valid files
  const validFiles = uploadedFiles.filter(
    (f) => !f.error && f.moderationStatus !== 'FLAGGED' && f.pageCount > 0
  );
  const totalPages = validFiles.reduce((acc, f) => acc + f.pageCount, 0);

  // STRICT RULE: ONLY WHEN FILE CONTAINS MORE THAN 1 PAGE ENABLE BOTH SIDE PRINT OPTION
  const isBothSideAllowed = totalPages > 1;

  // Auto-switch to SINGLE if totalPages <= 1 and BOTH was selected
  useEffect(() => {
    if (!isBothSideAllowed && printingSide === 'BOTH') {
      setPrintingSide('SINGLE');
    }
  }, [isBothSideAllowed, printingSide]);

  // Price Calculation according to RSCC Business Rules
  const p = settings.pricing;
  let ratePerPage = 0;
  if (printType === 'BW') {
    ratePerPage = printingSide === 'BOTH' ? p.bwBoth : p.bwSingle;
  } else {
    ratePerPage = printingSide === 'BOTH' ? p.colorBoth : p.colorSingle;
  }

  // Formula: Total = Number of Pages × Copies × Rate
  // NEVER divide page count by 2 for duplex printing
  const totalAmount = (totalPages > 0 ? totalPages : 0) * copies * ratePerPage;

  // Handle Drag & Drop Files
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setIsProcessingFiles(true);
    const newItems: UploadedFileItem[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const processed = await processUploadedFile(f, settings.maxFileSizeMb);
      newItems.push(processed);
    }

    setUploadedFiles((prev) => [...prev, ...newItems]);
    setIsProcessingFiles(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
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
    if (validFiles.length === 0) {
      alert('Please upload at least one valid printable document.');
      return;
    }

    const hasFlagged = uploadedFiles.some((f) => f.moderationStatus === 'FLAGGED');
    if (hasFlagged) {
      alert('One or more files cannot be accepted due to policy violations. Please remove them.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    const orderPayload = {
      mode: 'DOCUMENT',
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
        moderationStatus: f.moderationStatus,
        moderationReason: f.moderationReason,
      })),
      totalPages,
      copies,
      printType,
      printingSide,
      ratePerPage,
      totalAmount,
      specialInstructions: customer.specialInstructions?.trim() || undefined,
    };

    onProceedToPayment(orderPayload);
  };

  const hasFlaggedFiles = uploadedFiles.some((f) => f.moderationStatus === 'FLAGGED');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
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
            Upload your PDF, Word, PowerPoint, Excel, or Image files. Our system automatically detects the page count, runs content safety checks, and applies instant pricing.
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 text-left shrink-0 text-xs text-slate-300 space-y-1">
          <div className="font-bold text-amber-400">RSCC Rate Card:</div>
          <div>B&W Single: ₹{p.bwSingle} | Both: ₹{p.bwBoth}</div>
          <div>Colour Single: ₹{p.colorSingle} | Both: ₹{p.colorBoth}</div>
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
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition space-y-3 group ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                  : 'border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto group-hover:scale-110 transition shadow-xs">
                <Upload className="w-7 h-7" />
              </div>

              <div>
                <div className="text-base font-bold text-slate-900">
                  Click or Drag & Drop Documents Here
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Supported formats: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, RTF, JPG, PNG
                </p>
              </div>

              <button
                type="button"
                className="bg-slate-900 group-hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Browse Files from Phone / Computer</span>
              </button>
            </div>

            {isProcessingFiles && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-blue-900">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                <div>
                  <div className="font-bold">Analyzing files & counting pages...</div>
                  <div className="text-[11px] text-blue-700">Checking document integrity and content safety.</div>
                </div>
              </div>
            )}
          </div>

          {/* Uploaded Files Table / List */}
          {uploadedFiles.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Uploaded Documents ({uploadedFiles.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Total Detected Pages: <strong className="text-emerald-700 font-bold">{totalPages}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another File</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {uploadedFiles.map((fileItem, idx) => {
                  const isFlagged = fileItem.moderationStatus === 'FLAGGED';
                  const hasError = !!fileItem.error && !isFlagged;

                  return (
                    <div
                      key={fileItem.id}
                      className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isFlagged
                          ? 'bg-rose-50 border-rose-300 text-rose-950'
                          : hasError
                          ? 'bg-amber-50 border-amber-300 text-amber-950'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                            isFlagged
                              ? 'bg-rose-200 text-rose-800'
                              : hasError
                              ? 'bg-amber-200 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          #{idx + 1}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="font-bold text-sm truncate">
                            {fileItem.name}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{formatFileSize(fileItem.size)}</span>
                            <span>•</span>
                            <span className="uppercase font-mono text-[11px]">
                              {fileItem.type.split('/')[1] || 'DOC'}
                            </span>
                          </div>

                          {/* Flagged or Error Message */}
                          {isFlagged ? (
                            <div className="flex items-center gap-1.5 text-xs text-rose-700 font-semibold pt-1">
                              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>{fileItem.error || 'Prohibited content detected by safety filter.'}</span>
                            </div>
                          ) : hasError ? (
                            <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold pt-1">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>{fileItem.error}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold pt-0.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Safety Check: Verified Safe for Print</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Side: Page Count Badge & Delete */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                        {!isFlagged && !hasError && (
                          <div className="text-right">
                            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-xs px-2.5 py-1 rounded-lg">
                              {fileItem.pageCount} {fileItem.pageCount === 1 ? 'Page' : 'Pages'}
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => removeFile(fileItem.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Policy Warning Banner if files are flagged */}
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
                    className="bg-rose-800 hover:bg-rose-900 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition"
                  >
                    UPLOAD ANOTHER FILE
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Customer Details Form */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-black text-slate-900 text-base">
              Customer Information
            </h3>

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
                  Mobile Number (for Tracking) <span className="text-rose-500">*</span>
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
                  placeholder="e.g. Print first 2 pages in colour, staple top-left, spiral binding if available."
                  value={customer.specialInstructions}
                  onChange={(e) =>
                    setCustomer({ ...customer, specialInstructions: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Delivery Option notice */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
              <span className="font-semibold">Delivery Method:</span>
              <span className="bg-slate-200 text-slate-800 font-bold px-2.5 py-1 rounded-md text-[11px]">
                Pickup From RSCC Shop
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Printing Options, Price Calculator & Order Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xl space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Printing Preferences
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize your print type, side, and copies.
              </p>
            </div>

            {/* 1. PRINT TYPE */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Print Type
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPrintType('BW')}
                  className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between ${
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
                      ₹{p.bwSingle} / ₹{p.bwBoth}
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
                  className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between ${
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
                      ₹{p.colorSingle} / ₹{p.colorBoth}
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

            {/* 2. PRINTING SIDE (WITH STRICT ONLY WHEN >1 PAGE CONDITIONAL ENFORCEMENT) */}
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
                  className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between ${
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
                      ₹{printType === 'BW' ? p.bwSingle : p.colorSingle}/page
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
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-600/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
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
                      ₹{printType === 'BW' ? p.bwBoth : p.colorBoth}/page
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

            {/* 3. NUMBER OF COPIES */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Number of Copies
              </label>

              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                <span className="text-xs text-slate-600 font-medium pl-2">
                  Total sets to print:
                </span>
                <div className="flex items-center bg-white border border-slate-300 rounded-xl p-1 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setCopies(Math.max(1, copies - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-base flex items-center justify-center transition"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-extrabold text-slate-900 text-sm">
                    {copies}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCopies(copies + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-base flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* ORDER SUMMARY BLOCK */}
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
                      <span className="font-mono text-slate-400">{f.pageCount} pgs</span>
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
                  <span className="text-slate-400">Total Pages:</span>
                  <span className="font-bold text-white">{totalPages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Copies:</span>
                  <span className="font-bold text-white">{copies}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Print Type:</span>
                  <span className="font-bold text-white">{printType === 'BW' ? 'Black & White' : 'Colour'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Printing Side:</span>
                  <span className="font-bold text-white">{printingSide === 'BOTH' ? 'Both Side' : 'Single Side'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rate:</span>
                  <span className="font-bold text-amber-400">₹{ratePerPage}/page</span>
                </div>
              </div>

              {/* Exact Formula & Total Amount */}
              <div className="pt-3 border-t border-slate-800 flex items-end justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {totalPages} pgs × {copies} cps × ₹{ratePerPage}
                  </div>
                  <div className="text-2xl font-black text-amber-400 tracking-tight">
                    Total: ₹{totalAmount}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleProceed}
                  disabled={validFiles.length === 0 || hasFlaggedFiles}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-sm px-5 py-3 rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <span>PROCEED TO PAYMENT</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Explanatory Note */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-amber-700" />
                <span>Pricing Logic Note:</span>
              </div>
              <p>
                Price is strictly calculated based on the <strong>total number of pages</strong> in your document. Both-side printing does not halve the chargeable pages — instead, it gives you a lower rate per page (₹4 instead of ₹5 for B&W).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
