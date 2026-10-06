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
  MapPin,
  Eye,
  Columns,
  Maximize2,
  Minimize2,
  Scissors,
  SplitSquareVertical,
  X,
  FileCheck,
} from 'lucide-react';
import {
  CustomerDetails,
  CustomerUser,
  PageSelectionMode,
  PaperQuality,
  PaperSize,
  PrintType,
  PrintingSide,
  PagesPerSheet,
  NupOrientation,
  ShopSettings,
  UploadedFileItem,
} from '../types';
import { formatFileSize, processUploadedFile, fileToDataUrl, isExcelFile, isWebPFile, convertWebPToJpg } from '../utils/fileProcessor';
import { getSelectedPageCount } from '../utils/pageCalculator';
import {
  getSelectedPagesList,
  getPageSelectionSummary,
  extractSelectedPagesFromPdf,
  formatTrimmedPdfFilename,
} from '../utils/pdfExtractor';
import {
  generateNupPdf,
  calculateEffectiveSheets,
} from '../utils/nupProcessor';
import { DocumentPageView } from '../components/DocumentPageView';
import { saveFileToStorage } from '../utils/fileStorage';
import { inferMimeType } from '../utils/fileFormatHelper';
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
  const [isExtractingPdf, setIsExtractingPdf] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Printing Preferences: Paper Size, Print Type, Paper Quality (GSM), Printing Side, Copies
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [printType, setPrintType] = useState<PrintType>(sampleParams?.printType || 'BW');
  const [paperQuality, setPaperQuality] = useState<PaperQuality>('75_GSM');
  const [printingSide, setPrintingSide] = useState<PrintingSide>(sampleParams?.printingSide || 'SINGLE');
  const [copies, setCopies] = useState<number>(sampleParams?.copies || 1);

  // Pages Per Sheet / Multi-Page N-Up Layout: 1 (Standard 1-Up) | 2 (Both on Same Side / Half-and-Half) | 4 (Quad Grid)
  const [pagesPerSheet, setPagesPerSheet] = useState<PagesPerSheet>(1);
  const [nupOrientation, setNupOrientation] = useState<NupOrientation>('SIDE_BY_SIDE');
  const [activePreviewSheet, setActivePreviewSheet] = useState<number>(1);
  const [previewMode, setPreviewMode] = useState<'SHEET' | 'PDF'>('SHEET');
  const [selectedPreviewFileId, setSelectedPreviewFileId] = useState<string | null>(null);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState<boolean>(false);
  const [liveNupPdfUrl, setLiveNupPdfUrl] = useState<string | null>(null);
  const [isGeneratingNupPreview, setIsGeneratingNupPreview] = useState<boolean>(false);

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
  const [excelBlockedWarning, setExcelBlockedWarning] = useState<string | null>(null);
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

  // Effective printed impressions based on pages per sheet (1-up, 2-up, 4-up)
  const effectivePrintPages = pagesPerSheet > 1
    ? Math.max(1, Math.ceil(totalPages / pagesPerSheet))
    : totalPages;

  const totalPhysicalSheets = printingSide === 'BOTH'
    ? Math.max(1, Math.ceil(effectivePrintPages / 2))
    : effectivePrintPages;

  // STRICT RULE: ONLY WHEN EFFECTIVE PRINTED PAGE SIDES EXCEED 1 ENABLE BOTH SIDE PRINT OPTION
  const isBothSideAllowed = effectivePrintPages > 1;

  // Auto-switch to SINGLE if effective printed pages <= 1 and BOTH was selected
  useEffect(() => {
    if (!isBothSideAllowed && printingSide === 'BOTH') {
      setPrintingSide('SINGLE');
    }
  }, [isBothSideAllowed, printingSide]);

  // Clamp active preview sheet within valid range
  useEffect(() => {
    if (activePreviewSheet > effectivePrintPages) {
      setActivePreviewSheet(Math.max(1, effectivePrintPages));
    }
  }, [effectivePrintPages, activePreviewSheet]);

  // Active file being inspected in Document Print Preview
  const activePreviewFile =
    validFiles.find((f) => f.id === selectedPreviewFileId) || validFiles[0];

  // Generate live compiled N-Up PDF for preview when a PDF is uploaded
  useEffect(() => {
    let isCancelled = false;

    async function updateNupPreview() {
      const targetDoc =
        activePreviewFile &&
        (activePreviewFile.type === 'application/pdf' ||
          activePreviewFile.name?.toLowerCase().endsWith('.pdf') ||
          (activePreviewFile.previewUrl && activePreviewFile.previewUrl.startsWith('data:application/pdf')))
          ? activePreviewFile
          : validFiles.find(
              (f) =>
                f &&
                (f.type === 'application/pdf' ||
                  f.name?.toLowerCase().endsWith('.pdf') ||
                  (f.previewUrl && f.previewUrl.startsWith('data:application/pdf')))
            );

      if (!targetDoc) {
        setLiveNupPdfUrl(null);
        return;
      }

      const src = targetDoc.file || targetDoc.previewUrl;
      if (!src) return;

      setIsGeneratingNupPreview(true);
      try {
        const selectedPages = getSelectedPagesList(
          targetDoc.pageCount,
          targetDoc.pageSelectionMode || 'ALL',
          targetDoc.customPageRange || ''
        );

        const res = await generateNupPdf({
          input: src,
          pagesPerSheet,
          selectedPages,
          paperSize,
          orientation: nupOrientation,
        });

        if (!isCancelled) {
          setLiveNupPdfUrl(res.dataUrl);
        }
      } catch (err) {
        console.warn('Could not generate live N-up preview PDF:', err);
      } finally {
        if (!isCancelled) {
          setIsGeneratingNupPreview(false);
        }
      }
    }

    if (validFiles.length > 0) {
      updateNupPreview();
    } else {
      setLiveNupPdfUrl(null);
    }

    return () => {
      isCancelled = true;
    };
  }, [validFiles.length, selectedPreviewFileId, pagesPerSheet, nupOrientation, paperSize]);

  // Price Calculation according to RSCC Dynamic Pricing Engine
  const pricing = settings.pricing || DEFAULT_PRICING;
  const ratePerPage = getDocumentRate(paperSize, printType, paperQuality, printingSide, pricing);
  const copyRatePerPage = getAdditionalSetRate(paperSize, printType, printingSide, pricing);

  // Set-based pricing: Set 1 @ standard rate; Sets 2+ @ discounted copy rate
  const { totalAmount, firstSetCost, additionalSetsCost, additionalSetsCount } =
    calculateDocumentOrderAmount(effectivePrintPages, copies, ratePerPage, copyRatePerPage);

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
    let excelFilesDetected = 0;

    for (let i = 0; i < fileList.length; i++) {
      let rawFile = fileList[i];

      // Prohibit Excel spreadsheet uploads
      if (isExcelFile(rawFile)) {
        excelFilesDetected++;
        newItems.push({
          id: `f-${Date.now()}-${i}`,
          file: rawFile,
          name: rawFile.name,
          size: rawFile.size,
          type: rawFile.type || 'application/vnd.ms-excel',
          pageCount: 0,
          isProcessing: false,
          error: 'Excel files (.xlsx, .xls, .csv) are not supported. Please export or save your spreadsheet as a PDF or image before uploading.',
          moderationStatus: 'SAFE',
        });
        continue;
      }

      const maxBytes = (settings.maxFileSizeMb || 50) * 1024 * 1024;

      if (rawFile.size > maxBytes) {
        newItems.push({
          id: `f-${Date.now()}-${i}`,
          file: rawFile,
          name: rawFile.name,
          size: rawFile.size,
          type: inferMimeType(rawFile.name, rawFile.type),
          pageCount: 0,
          isProcessing: false,
          error: `File size exceeds ${settings.maxFileSizeMb}MB limit.`,
          moderationStatus: 'SAFE',
        });
        continue;
      }

      // Initial loading state item (preserve exact customer format as uploaded)
      const tempId = `f-${Date.now()}-${i}`;
      const placeholderItem: UploadedFileItem = {
        id: tempId,
        file: rawFile,
        name: rawFile.name,
        size: rawFile.size,
        type: inferMimeType(rawFile.name, rawFile.type),
        pageCount: 1,
        isProcessing: true,
        moderationStatus: 'PENDING',
      };
      newItems.push(placeholderItem);
    }

    if (excelFilesDetected > 0) {
      setExcelBlockedWarning(
        'Excel spreadsheets (.xlsx, .xls, .csv) cannot be uploaded directly for document printing. Please open Excel, export or save the file as a PDF (File > Save As / Export to PDF) or image, and upload that.'
      );
    }

    setUploadedFiles((prev) => [...prev, ...newItems]);

    // Process each file in background (page count detection + safety check)
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      if (item.error) continue;

      try {
        const processed = await processUploadedFile(item.file);
        if (processed.previewUrl) {
          saveFileToStorage(item.id, processed.previewUrl, { name: item.name, type: item.type }).catch(() => {});
          fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: item.name,
              fileType: item.type,
              dataUrl: processed.previewUrl,
              fileId: item.id,
              fileIndex: i,
            }),
          }).catch(() => {});
        }
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  pageCount: processed.pageCount,
                  previewUrl: processed.previewUrl,
                  isPasswordProtected: processed.isPasswordProtected,
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

  const handleProceed = async () => {
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

    setIsExtractingPdf(true);

    try {
      // Process each file: If customer selected specific pages (Odd, Even, Custom like 1, 2)
      // for a PDF, extract ONLY those selected pages into a new PDF!
      // Password-protected PDFs are NEVER altered to prevent file corruption.
      const finalizedFiles = await Promise.all(
        validFiles.map(async (f, fileIdx) => {
          const currentMode = f.pageSelectionMode || 'ALL';
          const isLocked = Boolean(f.isPasswordProtected);
          const isPdf =
            f.type === 'application/pdf' ||
            f.name?.toLowerCase().endsWith('.pdf') ||
            (f.previewUrl && f.previewUrl.startsWith('data:application/pdf'));

          const selectedPages = getSelectedPagesList(
            f.pageCount,
            currentMode,
            f.customPageRange || ''
          );

          const summary = getPageSelectionSummary(
            currentMode,
            f.customPageRange || '',
            selectedPages.length,
            f.pageCount
          );

          // Strictly prohibit trimming or N-up on locked/encrypted PDFs to prevent corrupting ciphertext
          const needsNupOrTrim =
            isPdf &&
            !isLocked &&
            (pagesPerSheet > 1 ||
              (currentMode !== 'ALL' && selectedPages.length > 0 && selectedPages.length < f.pageCount));

          if (needsNupOrTrim) {
            try {
              const srcData = f.file || f.previewUrl;
              if (srcData) {
                // If N-Up is selected (e.g. 2 pages per sheet), generate composite N-up PDF
                if (pagesPerSheet > 1) {
                  const nupResult = await generateNupPdf({
                    input: srcData,
                    pagesPerSheet,
                    selectedPages,
                    paperSize,
                    orientation: nupOrientation,
                  });

                  const cleanBase = (f.name || 'document').replace(/\.pdf$/i, '');
                  const nupFilename = `${cleanBase}_${pagesPerSheet}in1_layout.pdf`;
                  const nupSummary = `${summary} • ${pagesPerSheet} Pages on 1 Side (${nupOrientation === 'SIDE_BY_SIDE' ? 'Side-by-Side' : 'Top & Bottom'})`;

                  // Cache in IndexedDB and server disk
                  if (nupResult.dataUrl) {
                    saveFileToStorage(f.id, nupResult.dataUrl, {
                      name: nupFilename,
                      type: 'application/pdf',
                    }).catch(() => {});
                    try {
                      await fetch('/api/upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          filename: nupFilename,
                          fileType: 'application/pdf',
                          dataUrl: nupResult.dataUrl,
                          fileId: f.id,
                        }),
                      });
                    } catch {}
                  }

                  return {
                    id: f.id,
                    name: nupFilename,
                    size: nupResult.bytes.byteLength,
                    type: 'application/pdf',
                    pageCount: nupResult.sheetCount,
                    originalPageCount: f.pageCount,
                    sets: f.sets || copies,
                    pageSelectionMode: currentMode,
                    customPageRange: f.customPageRange,
                    selectedPageCount: nupResult.sheetCount,
                    selectedPagesList: selectedPages,
                    selectedPagesSummary: nupSummary,
                    trimmedPdfCreated: true,
                    pagesPerSheet,
                    nupOrientation,
                    previewUrl: nupResult.dataUrl,
                    isPasswordProtected: false,
                    password: f.password,
                    moderationStatus: f.moderationStatus,
                    moderationReason: f.moderationReason,
                  };
                }

                // Otherwise standard trimming for selected pages
                const extracted = await extractSelectedPagesFromPdf(srcData, selectedPages);
                const trimmedFilename = formatTrimmedPdfFilename(
                  f.name,
                  currentMode,
                  f.customPageRange
                );

                // Cache in IndexedDB and server disk
                if (extracted.dataUrl) {
                  saveFileToStorage(f.id, extracted.dataUrl, {
                    name: trimmedFilename,
                    type: 'application/pdf',
                  }).catch(() => {});
                  try {
                    await fetch('/api/upload', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        filename: trimmedFilename,
                        fileType: 'application/pdf',
                        dataUrl: extracted.dataUrl,
                        fileId: f.id,
                      }),
                    });
                  } catch {}
                }

                return {
                  id: f.id,
                  name: trimmedFilename,
                  size: extracted.bytes.byteLength,
                  type: 'application/pdf',
                  pageCount: extracted.pageCount,
                  originalPageCount: f.pageCount,
                  sets: f.sets || copies,
                  pageSelectionMode: currentMode,
                  customPageRange: f.customPageRange,
                  selectedPageCount: extracted.pageCount,
                  selectedPagesList: selectedPages,
                  selectedPagesSummary: summary,
                  trimmedPdfCreated: true,
                  pagesPerSheet: 1,
                  previewUrl: extracted.dataUrl,
                  isPasswordProtected: false,
                  password: f.password,
                  moderationStatus: f.moderationStatus,
                  moderationReason: f.moderationReason,
                };
              }
            } catch (extractErr) {
              console.error('Could not compile trimmed/N-Up PDF for staff portal:', extractErr);
            }
          }

          // Default / All Pages (PDF, JPG, PNG, DOCX, etc. in exact original format)
          let finalPreviewUrl = f.previewUrl;
          if (!finalPreviewUrl && f.file) {
            try {
              finalPreviewUrl = await fileToDataUrl(f.file);
            } catch (readErr) {
              console.warn('Could not read file data URL:', readErr);
            }
          }

          // Exact original size in bytes - never compressed or reduced below 1 KB
          const originalBytesSize =
            (f.file && f.file.size > 0 ? f.file.size : 0) ||
            (f.size && f.size > 0 ? f.size : 0) ||
            (finalPreviewUrl ? Math.round((finalPreviewUrl.length * 3) / 4) : 1024);

          // Pre-upload file to server disk storage and IndexedDB so all devices have immediate real binary access
          if (finalPreviewUrl && finalPreviewUrl.startsWith('data:')) {
            try {
              // Also cache in browser IndexedDB
              saveFileToStorage(f.id, finalPreviewUrl, {
                name: f.name || f.file?.name,
                type: f.type || f.file?.type,
              }).catch(() => {});

              // Upload to server disk
              await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  filename: f.name || f.file?.name,
                  fileType: f.type || f.file?.type,
                  dataUrl: finalPreviewUrl,
                  fileId: f.id,
                }),
              }).catch(() => {});
            } catch {}
          }

          return {
            id: f.id,
            name: f.file?.name || f.name,
            size: originalBytesSize,
            type: inferMimeType(f.file?.name || f.name, f.file?.type || f.type),
            pageCount: f.pageCount,
            originalPageCount: f.pageCount,
            sets: f.sets || copies,
            pageSelectionMode: currentMode,
            customPageRange: f.customPageRange,
            selectedPageCount: f.selectedPageCount || f.pageCount,
            selectedPagesList: selectedPages,
            selectedPagesSummary: summary,
            trimmedPdfCreated: false,
            pagesPerSheet,
            nupOrientation,
            previewUrl: finalPreviewUrl,
            isPasswordProtected: isLocked,
            password: f.password,
            moderationStatus: f.moderationStatus,
            moderationReason: f.moderationReason,
          };
        })
      );

      let enhancedInstructions = (customer.specialInstructions || '').trim();
      const passwordNotes = finalizedFiles
        .filter((f) => f.password && f.password.trim())
        .map((f) => `[Password for ${f.name}: ${f.password?.trim()}]`)
        .join(' ');
      if (passwordNotes) {
        enhancedInstructions = enhancedInstructions
          ? `${enhancedInstructions} • ${passwordNotes}`
          : passwordNotes;
      }

      const orderPayload = {
        mode: 'DOCUMENT',
        paperSize,
        paperQuality,
        pagesPerSheet,
        nupOrientation,
        customer: {
          name: customer.name.trim(),
          mobile: customer.mobile.trim(),
          email: customer.email?.trim() || undefined,
        },
        files: finalizedFiles,
        totalPages,
        totalSheets: totalPhysicalSheets,
        copies,
        sets: copies,
        printType,
        printingSide,
        ratePerPage,
        copyRatePerPage,
        totalAmount,
        pricing,
        specialInstructions: enhancedInstructions || undefined,
      };

      onProceedToPayment(orderPayload);
    } catch (err: any) {
      console.error('Failed to prepare order payload:', err);
      alert('An error occurred while preparing your document pages. Please try again.');
    } finally {
      setIsExtractingPdf(false);
    }
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

            {/* Excel Upload Prohibited Alert Banner */}
            {excelBlockedWarning && (
              <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3 shadow-sm animate-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-amber-950">
                      Excel Spreadsheet Not Supported
                    </h4>
                    <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                      {excelBlockedWarning}
                    </p>
                    <p className="text-[11px] text-amber-800 font-semibold mt-2">
                      💡 Quick tip: In Microsoft Excel or Google Sheets, click <strong>File &gt; Save As / Download &gt; PDF Document (.pdf)</strong>, then upload the generated PDF here for exact print alignment.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExcelBlockedWarning(null)}
                  className="text-amber-700 hover:text-amber-950 p-1.5 rounded-lg hover:bg-amber-100 transition shrink-0 cursor-pointer"
                  title="Dismiss warning"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

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
                accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt"
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
                  Supports PDF, Word (.docx), PowerPoint (.pptx), and Images (PNG, JPG, WebP auto-converted to JPG).
                </p>
                <p className="text-[11px] text-amber-700 font-medium mt-1">
                  🚫 Excel spreadsheets (.xlsx, .xls) are not supported — please export to PDF first.
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
                              {fileItem?.name || 'File'}
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

                              {fileItem.isPasswordProtected && (
                                <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                                  🔒 Password-Protected PDF
                                </span>
                              )}
                            </div>

                            {fileItem.isPasswordProtected && (
                              <div className="pt-1.5 flex flex-wrap items-center gap-2">
                                <label className="text-[11px] font-bold text-amber-900 shrink-0">
                                  Password (e.g. e-Aadhaar/bank statement):
                                </label>
                                <input
                                  type="text"
                                  placeholder="Enter password (optional)"
                                  value={fileItem.password || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setUploadedFiles((prev) =>
                                      prev.map((f) => (f.id === fileItem.id ? { ...f, password: val } : f))
                                    );
                                  }}
                                  className="px-2.5 py-1 text-xs bg-white border border-amber-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 w-52 font-mono"
                                />
                              </div>
                            )}

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
                            <div className="pt-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="e.g. 1, 2 or 1-3, 5, 8"
                                  value={fileItem.customPageRange || ''}
                                  onChange={(e) =>
                                    updatePageSelection(fileItem.id, 'CUSTOM', e.target.value)
                                  }
                                  className="w-full text-xs font-medium text-slate-900 px-3 py-2 bg-slate-50 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                                />
                              </div>

                              {/* Quick Page Selection Chips */}
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                                  Quick Select:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updatePageSelection(fileItem.id, 'CUSTOM', '1')}
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-200 transition cursor-pointer"
                                >
                                  Page 1 only
                                </button>
                                {fileItem.pageCount >= 2 && (
                                  <button
                                    type="button"
                                    onClick={() => updatePageSelection(fileItem.id, 'CUSTOM', '1, 2')}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-200 transition cursor-pointer"
                                  >
                                    Pages 1, 2
                                  </button>
                                )}
                                {fileItem.pageCount >= 3 && (
                                  <button
                                    type="button"
                                    onClick={() => updatePageSelection(fileItem.id, 'CUSTOM', '1-3')}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-200 transition cursor-pointer"
                                  >
                                    Pages 1-3
                                  </button>
                                )}
                                {fileItem.pageCount >= 5 && (
                                  <button
                                    type="button"
                                    onClick={() => updatePageSelection(fileItem.id, 'CUSTOM', '1-5')}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-200 transition cursor-pointer"
                                  >
                                    Pages 1-5
                                  </button>
                                )}
                              </div>

                              <p className="text-[10px] text-slate-500">
                                Enter individual page numbers and/or ranges separated by commas (e.g. 1, 2 or 1-5, 8). Max: {fileItem.pageCount} pages.
                              </p>
                            </div>
                          )}

                          {/* Staff Portal PDF Notice */}
                          {currentMode !== 'ALL' && (
                            <div className="bg-indigo-50/90 border border-indigo-200 rounded-xl p-2.5 text-[11px] text-indigo-950 flex items-start gap-2 shadow-2xs">
                              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                              <div className="leading-tight space-y-0.5">
                                <span className="font-bold text-indigo-900 block">
                                  ✂️ Staff Portal PDF Filter Active:
                                </span>
                                <span className="text-slate-700">
                                  The shop counter staff will receive and print a clean PDF containing <strong>ONLY the {effectiveCount} selected pages</strong>. All other pages will be automatically excluded from the staff's print file.
                                </span>
                              </div>
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

          {/* LIVE DOCUMENT PRINT PREVIEW SECTION */}
          {validFiles.length > 0 && (
            <div className="bg-slate-950 text-white rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-2xl space-y-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h3 className="font-black text-white text-base tracking-tight flex items-center gap-2">
                      <Printer className="w-4 h-4 text-amber-400" />
                      <span>Live Print Sheet Preview</span>
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-slate-800 text-amber-300 px-2.5 py-0.5 rounded-md border border-slate-700">
                      {pagesPerSheet === 2 ? '2 Pages on 1 Side' : '1 Page / Sheet'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Simulated {paperSize} {pagesPerSheet === 2 && nupOrientation === 'SIDE_BY_SIDE' ? 'Landscape' : 'Portrait'} Sheet • {printType === 'BW' ? 'Black & White' : 'Colour'} Print • {paperQuality === '75_GSM' ? '75 GSM' : '100 GSM Paper'}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                  {/* View Mode Switcher */}
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('SHEET')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        previewMode === 'SHEET'
                          ? 'bg-amber-400 text-slate-950 shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="View simulated physical printed sheet"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Sheet View</span>
                    </button>
                    {liveNupPdfUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewMode('PDF')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          previewMode === 'PDF'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        title="View interactive compiled PDF"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>PDF Viewer</span>
                      </button>
                    )}
                  </div>

                  {/* Fullscreen Button */}
                  <button
                    type="button"
                    onClick={() => setShowFullscreenPreview(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                    title="Open Fullscreen Preview"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Fullscreen</span>
                  </button>

                  {liveNupPdfUrl && (
                    <a
                      href={liveNupPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                      title="Open full compiled PDF in new window"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View PDF</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Multi-file selector pills if customer uploaded multiple documents */}
              {validFiles.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  <span className="text-slate-400 font-medium text-[11px] shrink-0">Inspecting Document:</span>
                  {validFiles.map((vf, idx) => (
                    <button
                      key={vf.id}
                      type="button"
                      onClick={() => {
                        setSelectedPreviewFileId(vf.id);
                        setActivePreviewSheet(1);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition shrink-0 cursor-pointer flex items-center gap-1 ${
                        (selectedPreviewFileId === vf.id || (!selectedPreviewFileId && idx === 0))
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      <span className="max-w-[120px] truncate">{vf?.name || 'File'}</span>
                      <span className="opacity-75">({vf?.pageCount || 1} pgs)</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Notice Banner when 2 Pages on 1 Side is Active */}
              {pagesPerSheet === 2 && (
                <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-2xl p-3 text-xs text-emerald-200 flex items-start gap-2.5 shadow-inner">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-white text-[12px]">
                      2-in-1 Half Sheet Layout Active
                    </div>
                    <div className="text-[11px] text-emerald-300 leading-relaxed">
                      Half page contains the 1st page, other half contains the 2nd page on the <strong>exact same side</strong> of this sheet.
                      You save 50% paper & only pay for <strong>{effectivePrintPages} printed page side{effectivePrintPages > 1 ? 's' : ''}</strong>!
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Physical Sheet Container */}
              <div className="flex flex-col items-center justify-center p-3 sm:p-5 bg-slate-900/90 rounded-2xl border border-slate-800/80 min-h-[360px]">
                {previewMode === 'PDF' && liveNupPdfUrl ? (
                  <div className="w-full max-w-2xl h-[440px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col">
                    <div className="bg-slate-800 text-slate-300 px-3 py-1.5 text-xs font-mono flex items-center justify-between border-b border-slate-700">
                      <span>Live Compiled 2-in-1 PDF Stream</span>
                      <span className="text-[10px] text-amber-300">Ready to Print</span>
                    </div>
                    <iframe
                      src={`${liveNupPdfUrl}#toolbar=0&navpanes=0`}
                      title="Live Document Print Preview"
                      className="w-full h-full rounded-b-xl bg-white"
                    />
                  </div>
                ) : pagesPerSheet === 2 ? (
                  nupOrientation === 'SIDE_BY_SIDE' ? (
                    /* 2-UP SIDE BY SIDE (LANDSCAPE SHEET) */
                    <div className="w-full max-w-xl aspect-[1.414/1] bg-white rounded-xl shadow-2xl p-3 sm:p-4 text-slate-900 relative overflow-hidden flex flex-col justify-between border border-slate-200">
                      {/* Top Sheet Header Strip */}
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono pb-1 border-b border-slate-100">
                        <span>RSCC Studio Print • {paperSize} Landscape Sheet {activePreviewSheet} of {effectivePrintPages}</span>
                        <span className="font-bold text-slate-600">2-in-1 Side-by-Side</span>
                      </div>

                      {/* Split Halves Container */}
                      <div className="grid grid-cols-2 gap-2 flex-1 pt-2 relative">
                        {/* Center Dividing Dotted Line */}
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none z-10">
                          <div className="h-full border-r-2 border-dashed border-slate-300 relative flex items-center justify-center">
                            <span className="bg-slate-100 text-slate-500 rounded-full p-1 border border-slate-200 shadow-2xs">
                              <Scissors className="w-3 h-3 text-slate-500" />
                            </span>
                          </div>
                        </div>

                        {/* Left Half (1st Page of Pair) */}
                        <div className="bg-slate-50/90 rounded-lg p-2 border border-slate-200/90 flex flex-col justify-between relative shadow-inner overflow-hidden min-h-[170px]">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                            <span className="bg-indigo-600 text-white font-extrabold text-[9px] sm:text-[10px] px-2 py-0.5 rounded shadow-2xs">
                              Page {(activePreviewSheet - 1) * 2 + 1}
                            </span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                              Left Half
                            </span>
                          </div>

                          {/* Render Actual Uploaded Document Page */}
                          <div className="flex-1 w-full my-1 overflow-hidden rounded bg-white border border-slate-200 shadow-2xs flex items-center justify-center min-h-[140px] sm:min-h-[180px]">
                            <DocumentPageView
                              file={activePreviewFile?.file}
                              previewUrl={activePreviewFile?.previewUrl}
                              fileName={activePreviewFile?.name}
                              pageNumber={(activePreviewSheet - 1) * 2 + 1}
                              printType={printType}
                              showBadge={false}
                              className="w-full h-full"
                            />
                          </div>

                          <div className="text-[8px] text-slate-400 text-center font-mono pt-1 border-t border-slate-200">
                            Half Page 1 • {paperSize} Left
                          </div>
                        </div>

                        {/* Right Half (2nd Page of Pair) */}
                        <div className="bg-slate-50/90 rounded-lg p-2 border border-slate-200/90 flex flex-col justify-between relative shadow-inner overflow-hidden min-h-[170px]">
                          {(activePreviewSheet - 1) * 2 + 2 <= (activePreviewFile?.selectedPageCount || activePreviewFile?.pageCount || totalPages) ? (
                            <>
                              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                <span className="bg-indigo-600 text-white font-extrabold text-[9px] sm:text-[10px] px-2 py-0.5 rounded shadow-2xs">
                                  Page {(activePreviewSheet - 1) * 2 + 2}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                  Right Half
                                </span>
                              </div>

                              {/* Render Actual Uploaded Document Page */}
                              <div className="flex-1 w-full my-1 overflow-hidden rounded bg-white border border-slate-200 shadow-2xs flex items-center justify-center min-h-[140px] sm:min-h-[180px]">
                                <DocumentPageView
                                  file={activePreviewFile?.file}
                                  previewUrl={activePreviewFile?.previewUrl}
                                  fileName={activePreviewFile?.name}
                                  pageNumber={(activePreviewSheet - 1) * 2 + 2}
                                  printType={printType}
                                  showBadge={false}
                                  className="w-full h-full"
                                />
                              </div>

                              <div className="text-[8px] text-slate-400 text-center font-mono pt-1 border-t border-slate-200">
                                Half Page 2 • {paperSize} Right
                              </div>
                            </>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-3 text-slate-400 bg-slate-100/50 rounded border border-dashed border-slate-300">
                              <span className="text-xs font-bold text-slate-500">Blank Half</span>
                              <span className="text-[9px] text-slate-400">Document ends on odd page</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Sheet Footer */}
                      <div className="text-[9px] text-slate-400 text-center font-mono pt-1 border-t border-slate-100">
                        Both pages printed together on 1 physical sheet side • RSCC Choice Centre
                      </div>
                    </div>
                  ) : (
                    /* 2-UP TOP & BOTTOM (PORTRAIT SHEET) */
                    <div className="w-full max-w-sm aspect-[1/1.414] bg-white rounded-xl shadow-2xl p-3 sm:p-4 text-slate-900 relative overflow-hidden flex flex-col justify-between border border-slate-200">
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono pb-1 border-b border-slate-100">
                        <span>RSCC Print • {paperSize} Portrait Sheet {activePreviewSheet}</span>
                        <span className="font-bold text-slate-600">2-in-1 Top/Bottom</span>
                      </div>

                      <div className="grid grid-rows-2 gap-2 flex-1 py-1.5 relative">
                        {/* Horizontal Dividing Dotted Line */}
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-10">
                          <div className="w-full border-t-2 border-dashed border-slate-300 relative flex items-center justify-center">
                            <span className="bg-slate-100 text-slate-500 rounded-full p-1 border border-slate-200">
                              <Scissors className="w-3 h-3 text-slate-500" />
                            </span>
                          </div>
                        </div>

                        {/* Top Half */}
                        <div className="bg-slate-50/90 rounded-lg p-2 border border-slate-200/90 flex flex-col justify-between shadow-inner overflow-hidden min-h-[110px]">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                            <span className="bg-indigo-600 text-white font-extrabold text-[9px] px-2 py-0.5 rounded">
                              Page {(activePreviewSheet - 1) * 2 + 1}
                            </span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Top Half</span>
                          </div>

                          <div className="flex-1 w-full my-0.5 overflow-hidden rounded bg-white border border-slate-200 shadow-2xs flex items-center justify-center min-h-[90px] sm:min-h-[110px]">
                            <DocumentPageView
                              file={activePreviewFile?.file}
                              previewUrl={activePreviewFile?.previewUrl}
                              fileName={activePreviewFile?.name}
                              pageNumber={(activePreviewSheet - 1) * 2 + 1}
                              printType={printType}
                              showBadge={false}
                              className="w-full h-full"
                            />
                          </div>

                          <div className="text-[8px] text-slate-400 text-center font-mono pt-0.5 border-t border-slate-100">
                            Half Page 1 • Top
                          </div>
                        </div>

                        {/* Bottom Half */}
                        <div className="bg-slate-50/90 rounded-lg p-2 border border-slate-200/90 flex flex-col justify-between shadow-inner overflow-hidden min-h-[110px]">
                          {(activePreviewSheet - 1) * 2 + 2 <= (activePreviewFile?.selectedPageCount || activePreviewFile?.pageCount || totalPages) ? (
                            <>
                              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                <span className="bg-indigo-600 text-white font-extrabold text-[9px] px-2 py-0.5 rounded">
                                  Page {(activePreviewSheet - 1) * 2 + 2}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase">Bottom Half</span>
                              </div>

                              <div className="flex-1 w-full my-0.5 overflow-hidden rounded bg-white border border-slate-200 shadow-2xs flex items-center justify-center min-h-[90px] sm:min-h-[110px]">
                                <DocumentPageView
                                  file={activePreviewFile?.file}
                                  previewUrl={activePreviewFile?.previewUrl}
                                  fileName={activePreviewFile?.name}
                                  pageNumber={(activePreviewSheet - 1) * 2 + 2}
                                  printType={printType}
                                  showBadge={false}
                                  className="w-full h-full"
                                />
                              </div>

                              <div className="text-[8px] text-slate-400 text-center font-mono pt-0.5 border-t border-slate-100">
                                Half Page 2 • Bottom
                              </div>
                            </>
                          ) : (
                            <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400 bg-slate-100/50 rounded border border-dashed border-slate-300">
                              Blank Half
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-[9px] text-slate-400 text-center font-mono pt-1 border-t border-slate-100">
                        Both pages printed together on 1 physical sheet
                      </div>
                    </div>
                  )
                ) : (
                  /* 1-UP STANDARD FULL PAGE PREVIEW */
                  <div className="w-full max-w-sm aspect-[1/1.414] bg-white rounded-xl shadow-2xl p-3 sm:p-4 text-slate-900 relative overflow-hidden flex flex-col justify-between border border-slate-200">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pb-2 border-b border-slate-100">
                      <span>RSCC Standard Print • {paperSize} Portrait</span>
                      <span className="bg-slate-900 text-white font-bold px-2 py-0.5 rounded">
                        Page {activePreviewSheet} of {totalPages}
                      </span>
                    </div>

                    {/* Render Actual Uploaded Document Page */}
                    <div className="flex-1 w-full my-2 overflow-hidden rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center justify-center min-h-[260px] sm:min-h-[340px]">
                      <DocumentPageView
                        file={activePreviewFile?.file}
                        previewUrl={activePreviewFile?.previewUrl}
                        fileName={activePreviewFile?.name}
                        pageNumber={activePreviewSheet}
                        printType={printType}
                        showBadge={false}
                        className="w-full h-full"
                      />
                    </div>

                    <div className="text-[10px] text-slate-400 text-center font-mono pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span>1 Page Per Sheet (Standard 1-Up)</span>
                      <span>Sheet {activePreviewSheet}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sheet Switcher & Layout Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  {effectivePrintPages > 1 && (
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => setActivePreviewSheet((prev) => Math.max(1, prev - 1))}
                        disabled={activePreviewSheet <= 1}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-bold text-xs transition cursor-pointer"
                      >
                        ← Prev Sheet
                      </button>
                      <span className="text-xs font-bold text-slate-300 px-2 font-mono">
                        Sheet {activePreviewSheet} of {effectivePrintPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActivePreviewSheet((prev) => Math.min(effectivePrintPages, prev + 1))}
                        disabled={activePreviewSheet >= effectivePrintPages}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-bold text-xs transition cursor-pointer"
                      >
                        Next Sheet →
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick orientation toggle if 2-up is selected */}
                {pagesPerSheet === 2 && (
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
                    <span className="text-[11px] text-slate-400 pl-1.5 font-medium">Layout:</span>
                    <button
                      type="button"
                      onClick={() => setNupOrientation('SIDE_BY_SIDE')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                        nupOrientation === 'SIDE_BY_SIDE'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Columns className="w-3 h-3" />
                      <span>Side-by-Side</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNupOrientation('TOP_BOTTOM')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                        nupOrientation === 'TOP_BOTTOM'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <SplitSquareVertical className="w-3 h-3" />
                      <span>Top/Bottom</span>
                    </button>
                  </div>
                )}
              </div>
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
            <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                  <MapPin className="w-3.5 h-3.5 text-amber-700" />
                  <span>Fulfillment Method:</span>
                </span>
                <span className="bg-amber-200/90 text-amber-950 font-black px-2.5 py-0.5 rounded-md text-[11px]">
                  Store Counter Pickup
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-tight">
                ⚠️ We have not currently started home delivery services — doorstep delivery will be started soon! Please collect your prints from our shop counter ({settings.address}).
              </p>
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

            {/* 5. PAGES PER SHEET (LAYOUT) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Pages Per Sheet (Layout)
                </label>
                {pagesPerSheet === 2 && (
                  <span className="text-[10px] text-emerald-800 bg-emerald-100 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    ✨ 2-in-1: Save 50% Paper & Cost
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPagesPerSheet(1);
                    setActivePreviewSheet(1);
                  }}
                  className={`p-3 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    pagesPerSheet === 1
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>1 Page / Sheet</span>
                    </div>
                    <div className={`text-[11px] ${pagesPerSheet === 1 ? 'text-slate-300' : 'text-slate-500'}`}>
                      Standard 1-Up Full Page
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      pagesPerSheet === 1 ? 'border-amber-400 bg-amber-400' : 'border-slate-400'
                    }`}
                  >
                    {pagesPerSheet === 1 && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPagesPerSheet(2);
                    setActivePreviewSheet(1);
                  }}
                  className={`p-3 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    pagesPerSheet === 2
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-600/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <Columns className="w-3.5 h-3.5 text-amber-300" />
                      <span>2 Pages on 1 Side</span>
                    </div>
                    <div className={`text-[11px] ${pagesPerSheet === 2 ? 'text-emerald-100' : 'text-slate-500'}`}>
                      Half 1st & Half 2nd Page
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      pagesPerSheet === 2 ? 'border-white bg-white' : 'border-slate-400'
                    }`}
                  >
                    {pagesPerSheet === 2 && <div className="w-1.5 h-1.5 rounded-full bg-emerald-700" />}
                  </div>
                </button>
              </div>

              {/* 2-in-1 Arrangement Options */}
              {pagesPerSheet === 2 && (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-emerald-950">
                    <span className="font-bold">2-in-1 Page Arrangement:</span>
                    <span className="text-emerald-800 font-medium">Both pages on same sheet side</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setNupOrientation('SIDE_BY_SIDE')}
                      className={`py-2 px-3 rounded-xl border text-center font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        nupOrientation === 'SIDE_BY_SIDE'
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-emerald-100 border-emerald-200'
                      }`}
                    >
                      <Columns className="w-3.5 h-3.5" />
                      <span>Side-by-Side</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNupOrientation('TOP_BOTTOM')}
                      className={`py-2 px-3 rounded-xl border text-center font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        nupOrientation === 'TOP_BOTTOM'
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-emerald-100 border-emerald-200'
                      }`}
                    >
                      <SplitSquareVertical className="w-3.5 h-3.5" />
                      <span>Top & Bottom</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-emerald-800 leading-tight">
                    ✨ <strong>Both Pages on 1 Side:</strong> The 1st page is printed on one half, and the 2nd page on the other half of the single sheet side.
                  </p>
                </div>
              )}
            </div>

            {/* 6. NUMBER OF SETS REQUIRED */}
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
                      <span className="truncate max-w-[180px]">• {f?.name || 'File'}</span>
                      <span className="font-mono text-slate-400">
                        {f?.pageCount || 1} pgs × {f?.sets || copies} set{(f?.sets || copies) > 1 ? 's' : ''}
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
                  <span className="text-slate-400">Pages Per Sheet:</span>
                  <span className="font-bold text-amber-300">
                    {pagesPerSheet === 2
                      ? `2-in-1 (${nupOrientation === 'SIDE_BY_SIDE' ? 'Side-by-Side' : 'Top/Bottom'})`
                      : '1 Page / Sheet'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Document Pages:</span>
                  <span className="font-bold text-white font-mono">{totalPages} pages</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Printed Page Sides:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {effectivePrintPages} side{effectivePrintPages > 1 ? 's' : ''} ({totalPhysicalSheets} sheet{totalPhysicalSheets > 1 ? 's' : ''})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sets Required:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {copies} {copies === 1 ? 'set' : 'sets'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">1st Set Rate:</span>
                  <span className="font-bold text-white font-mono">₹{ratePerPage}/printed side</span>
                </div>
                {copies > 1 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">2nd+ Sets Copy Rate:</span>
                    <span className="font-bold text-emerald-400 font-mono">₹{copyRatePerPage}/printed side</span>
                  </div>
                )}
              </div>

              {/* Exact Formula & Total Amount */}
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 space-y-1 text-[11px] font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span>• 1st Set ({effectivePrintPages} printed side{effectivePrintPages > 1 ? 's' : ''} × ₹{ratePerPage}):</span>
                    <span className="text-white font-bold">₹{firstSetCost}</span>
                  </div>
                  {copies > 1 && (
                    <div className="flex justify-between text-emerald-300">
                      <span>• Extra {additionalSetsCount} Set{additionalSetsCount > 1 ? 's' : ''} ({effectivePrintPages * additionalSetsCount} sides × ₹{copyRatePerPage}):</span>
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
                    disabled={validFiles.length === 0 || hasFlaggedFiles || isExtractingPdf}
                    className="bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-white font-extrabold text-sm px-5 py-3 rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>LOG IN TO PLACE ORDER</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleProceed}
                    disabled={validFiles.length === 0 || hasFlaggedFiles || isExtractingPdf}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-sm px-5 py-3 rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    {isExtractingPdf ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>PREPARING SELECTED PAGES...</span>
                      </>
                    ) : (
                      <>
                        <span>PROCEED TO PAYMENT</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
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
              Price is strictly computed as <strong>1st Set @ ₹{ratePerPage}/printed side</strong> and <strong>additional sets @ ₹{copyRatePerPage}/printed side</strong> for your chosen paper size ({paperSize}) and print type ({printType === 'BW' ? 'B&W' : 'Colour'}).
            </p>
          </div>
        </div>
        </div>
      </div>

      {/* FULLSCREEN PRINT PREVIEW MODAL */}
      {showFullscreenPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 animate-in fade-in duration-200">
          {/* Modal Header */}
          <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-2xl border border-slate-800 text-white shadow-xl flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <div className="font-black text-sm sm:text-base flex items-center gap-2 flex-wrap">
                  <span>Full Screen Print Sheet Preview</span>
                  <span className="text-[10px] font-bold bg-slate-800 text-amber-400 border border-slate-700 px-2 py-0.5 rounded">
                    {pagesPerSheet === 2 ? '2 Pages on 1 Side' : '1 Page / Sheet'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {paperSize} {pagesPerSheet === 2 && nupOrientation === 'SIDE_BY_SIDE' ? 'Landscape' : 'Portrait'} • {printType === 'BW' ? 'Black & White' : 'Colour'} Print • {paperQuality === '75_GSM' ? '75 GSM' : '100 GSM'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Fullscreen View Mode Toggle */}
              {liveNupPdfUrl && (
                <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('SHEET')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                      previewMode === 'SHEET'
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Sheet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('PDF')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                      previewMode === 'PDF'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                </div>
              )}

              {liveNupPdfUrl && (
                <a
                  href={liveNupPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Open PDF</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowFullscreenPreview(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title="Close Fullscreen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Sheet Canvas Body */}
          <div className="flex-1 flex items-center justify-center p-2 sm:p-6 overflow-auto">
            {previewMode === 'PDF' && liveNupPdfUrl ? (
              <div className="w-full max-w-4xl h-[70vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
                <iframe
                  src={`${liveNupPdfUrl}#toolbar=0&navpanes=0`}
                  title="PDF Print Preview"
                  className="w-full h-full rounded-2xl bg-white"
                />
              </div>
            ) : pagesPerSheet === 2 ? (
              <div className="w-full max-w-3xl aspect-[1.414/1] bg-white rounded-2xl shadow-2xl p-6 text-slate-900 relative overflow-hidden flex flex-col justify-between border-2 border-slate-300">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono pb-2 border-b border-slate-200">
                  <span>RSCC Professional Print Simulator • {paperSize} Landscape Sheet {activePreviewSheet} of {effectivePrintPages}</span>
                  <span className="font-bold text-slate-800">2-in-1 Side-by-Side</span>
                </div>

                <div className="grid grid-cols-2 gap-4 flex-1 py-3 relative">
                  {/* Center Dividing Dotted Line */}
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none z-10">
                    <div className="h-full border-r-2 border-dashed border-slate-300 relative flex items-center justify-center">
                      <span className="bg-slate-100 text-slate-600 rounded-full p-1.5 border border-slate-300 shadow-xs">
                        <Scissors className="w-4 h-4" />
                      </span>
                    </div>
                  </div>

                  {/* Left Half (1st Page) */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-200">
                      <span className="bg-indigo-600 text-white font-extrabold text-xs px-2.5 py-1 rounded shadow-xs">
                        Page {(activePreviewSheet - 1) * 2 + 1}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Left Half Page
                      </span>
                    </div>

                    <div className="flex-1 w-full my-1 overflow-hidden rounded bg-white border border-slate-200 shadow-xs flex items-center justify-center min-h-[220px]">
                      <DocumentPageView
                        file={activePreviewFile?.file}
                        previewUrl={activePreviewFile?.previewUrl}
                        fileName={activePreviewFile?.name}
                        pageNumber={(activePreviewSheet - 1) * 2 + 1}
                        printType={printType}
                        showBadge={false}
                        className="w-full h-full"
                      />
                    </div>

                    <div className="text-[10px] text-slate-400 text-center font-mono pt-2 border-t border-slate-200">
                      Half Page 1 of Sheet {activePreviewSheet}
                    </div>
                  </div>

                  {/* Right Half (2nd Page) */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col justify-between overflow-hidden">
                    {(activePreviewSheet - 1) * 2 + 2 <= (activePreviewFile?.selectedPageCount || activePreviewFile?.pageCount || totalPages) ? (
                      <>
                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-200">
                          <span className="bg-indigo-600 text-white font-extrabold text-xs px-2.5 py-1 rounded shadow-xs">
                            Page {(activePreviewSheet - 1) * 2 + 2}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Right Half Page
                          </span>
                        </div>

                        <div className="flex-1 w-full my-1 overflow-hidden rounded bg-white border border-slate-200 shadow-xs flex items-center justify-center min-h-[220px]">
                          <DocumentPageView
                            file={activePreviewFile?.file}
                            previewUrl={activePreviewFile?.previewUrl}
                            fileName={activePreviewFile?.name}
                            pageNumber={(activePreviewSheet - 1) * 2 + 2}
                            printType={printType}
                            showBadge={false}
                            className="w-full h-full"
                          />
                        </div>

                        <div className="text-[10px] text-slate-400 text-center font-mono pt-2 border-t border-slate-200">
                          Half Page 2 of Sheet {activePreviewSheet}
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100/50 rounded border border-dashed border-slate-300">
                        <span className="text-sm font-bold text-slate-600">Blank Half</span>
                        <span className="text-xs">Document ends on odd page</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 text-center font-mono pt-2 border-t border-slate-200">
                  Both pages printed together on 1 physical sheet side • RSCC Digital Printing
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md aspect-[1/1.414] bg-white rounded-2xl shadow-2xl p-6 text-slate-900 relative overflow-hidden flex flex-col justify-between border-2 border-slate-300">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono pb-2 border-b border-slate-200">
                  <span>Standard 1-Up Print • {paperSize}</span>
                  <span className="bg-slate-900 text-white font-bold px-2.5 py-0.5 rounded">
                    Page {activePreviewSheet} of {totalPages}
                  </span>
                </div>

                <div className="flex-1 w-full my-4 overflow-hidden rounded bg-white border border-slate-200 shadow-xs flex items-center justify-center min-h-[350px]">
                  <DocumentPageView
                    file={activePreviewFile?.file}
                    previewUrl={activePreviewFile?.previewUrl}
                    fileName={activePreviewFile?.name}
                    pageNumber={activePreviewSheet}
                    printType={printType}
                    showBadge={false}
                    className="w-full h-full"
                  />
                </div>

                <div className="text-xs text-slate-400 text-center font-mono pt-2 border-t border-slate-200">
                  Full Page Output
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
            <div className="text-xs text-slate-300 font-medium">
              {pagesPerSheet === 2 ? (
                <span>
                  💡 <strong>2-in-1 Mode:</strong> Page 1 is on the left half, and Page 2 is on the right half of the <strong>same side</strong>.
                </span>
              ) : (
                <span>Standard single page per sheet print.</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {effectivePrintPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActivePreviewSheet((prev) => Math.max(1, prev - 1))}
                    disabled={activePreviewSheet <= 1}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-bold text-xs cursor-pointer transition"
                  >
                    ← Prev Sheet
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-300">
                    Sheet {activePreviewSheet} of {effectivePrintPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePreviewSheet((prev) => Math.min(effectivePrintPages, prev + 1))}
                    disabled={activePreviewSheet >= effectivePrintPages}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-bold text-xs cursor-pointer transition"
                  >
                    Next Sheet →
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowFullscreenPreview(false)}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer shadow-md"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
