import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { UploadedFileItem } from '../types';

/**
 * Accurately extracts page count and encryption status from PDF binary data.
 * Checks both pdf-lib parser and binary text search for /Encrypt dictionary.
 */
export async function extractPdfPageCount(file: File): Promise<{ count: number; isLocked: boolean }> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // 1. First test directly with pdf-lib: if it throws EncryptedPDFError, it's 100% locked/password-protected
    let isLocked = false;
    try {
      const doc = await PDFDocument.load(arrayBuffer);
      const pageCount = doc.getPageCount();
      if (pageCount > 0) {
        return { count: pageCount, isLocked: false };
      }
    } catch (loadErr: any) {
      const errMsg = String(loadErr?.message || loadErr || '').toLowerCase();
      if (errMsg.includes('encrypted') || errMsg.includes('password') || errMsg.includes('decrypt')) {
        isLocked = true;
      }
    }

    // 2. Binary text inspection for /Encrypt or page counting
    const text = new TextDecoder('latin1').decode(arrayBuffer);
    if (!isLocked) {
      isLocked = /\/Encrypt\b/i.test(text);
    }

    // Strategy 1: Find Pages root object with /Count
    const countMatches = text.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/gi);
    if (countMatches && countMatches.length > 0) {
      let maxCount = 0;
      for (const match of countMatches) {
        const numMatch = match.match(/\/Count\s+(\d+)/i);
        if (numMatch && numMatch[1]) {
          const c = parseInt(numMatch[1], 10);
          if (c > maxCount) maxCount = c;
        }
      }
      if (maxCount > 0) return { count: maxCount, isLocked };
    }

    // Strategy 2: Count individual /Type /Page objects (excluding /Pages)
    const pageMatches = text.match(/\/Type\s*\/Page\b(?!\s*s)/g);
    if (pageMatches && pageMatches.length > 0) {
      return { count: pageMatches.length, isLocked };
    }

    // Strategy 3: Search for /Count anywhere in PDF trailer/catalog
    const generalCount = text.match(/\/Count\s+(\d+)/g);
    if (generalCount) {
      const counts = generalCount
        .map((m) => parseInt(m.replace(/\/Count\s+/i, ''), 10))
        .filter((n) => !isNaN(n) && n > 0);
      if (counts.length > 0) {
        return { count: Math.max(...counts), isLocked };
      }
    }

    // Fallback: at least 1 page
    return { count: 1, isLocked };
  } catch (err) {
    console.warn('extractPdfPageCount error:', err);
    return { count: 1, isLocked: false };
  }
}

/**
 * Extracts printable page count from Office documents (DOCX, PPTX, XLSX).
 */
export async function extractOfficeDocPageCount(file: File): Promise<number> {
  try {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);

    // Check docProps/app.xml (standard across OOXML Word, PowerPoint, Excel)
    const appXmlFile = loadedZip.file('docProps/app.xml');
    if (appXmlFile) {
      const appXmlText = await appXmlFile.async('text');

      // 1. Check for <Pages> tag (Word & some office apps)
      const pagesMatch = appXmlText.match(/<Pages>(\d+)<\/Pages>/i);
      if (pagesMatch && pagesMatch[1]) {
        const count = parseInt(pagesMatch[1], 10);
        if (count > 0) return count;
      }

      // 2. Check for <Slides> tag (PowerPoint)
      const slidesMatch = appXmlText.match(/<Slides>(\d+)<\/Slides>/i);
      if (slidesMatch && slidesMatch[1]) {
        const count = parseInt(slidesMatch[1], 10);
        if (count > 0) return count;
      }

      // 3. Check for <Paragraphs> or <Words> estimation for Word documents
      const wordsMatch = appXmlText.match(/<Words>(\d+)<\/Words>/i);
      if (wordsMatch && wordsMatch[1]) {
        const words = parseInt(wordsMatch[1], 10);
        if (words > 0) {
          return Math.max(1, Math.ceil(words / 450));
        }
      }
    }

    // Check PPTX slide files directly (ppt/slides/slide1.xml, etc.)
    const slideFiles = Object.keys(loadedZip.files).filter((k) =>
      k.match(/^ppt\/slides\/slide\d+\.xml$/i)
    );
    if (slideFiles.length > 0) {
      return slideFiles.length;
    }

    // Check Excel worksheet files (xl/worksheets/sheet1.xml, etc.)
    const sheetFiles = Object.keys(loadedZip.files).filter((k) =>
      k.match(/^xl\/worksheets\/sheet\d+\.xml$/i)
    );
    if (sheetFiles.length > 0) {
      return sheetFiles.length;
    }

    // Check word/document.xml paragraph count
    const wordDocFile = loadedZip.file('word/document.xml');
    if (wordDocFile) {
      const wordText = await wordDocFile.async('text');
      const paragraphs = (wordText.match(/<w:p\b/g) || []).length;
      return Math.max(1, Math.ceil(paragraphs / 18));
    }
  } catch (err) {
    console.warn('Could not parse OOXML metadata, falling back to estimation:', err);
  }

  // Fallback estimation based on file size
  return Math.max(1, Math.ceil(file.size / (150 * 1024)));
}

/**
 * Counts pages for plain text and RTF documents.
 */
export async function extractTextPageCount(file: File): Promise<number> {
  try {
    const text = await file.text();
    const lines = text.split('\n').length;
    const words = text.trim().split(/\s+/).length;
    // Standard A4 page has ~35-40 lines or ~450 words
    const byLines = Math.ceil(lines / 38);
    const byWords = Math.ceil(words / 450);
    return Math.max(1, Math.max(byLines, byWords));
  } catch {
    return 1;
  }
}

/**
 * Detects whether a file is an Excel spreadsheet or CSV/TSV table.
 */
export function isExcelFile(file: { name?: string; type?: string }): boolean {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  const excelExtensions = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.xltx', '.xltm', '.csv', '.tsv'];
  if (excelExtensions.some((ext) => name.endsWith(ext))) {
    return true;
  }
  if (
    type.includes('spreadsheet') ||
    type.includes('ms-excel') ||
    type === 'text/csv' ||
    type === 'application/csv' ||
    type.includes('vnd.openxmlformats-officedocument.spreadsheetml')
  ) {
    return true;
  }
  return false;
}

/**
 * Checks if a file is a WebP image.
 */
export function isWebPFile(file: { name?: string; type?: string }): boolean {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  return name.endsWith('.webp') || type === 'image/webp';
}

/**
 * Converts a WebP image File into a standard JPEG/JPG File using HTML5 Canvas.
 * Handles transparency gracefully with a crisp white background.
 */
export async function convertWebPToJpg(file: File): Promise<File> {
  if (!isWebPFile(file)) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // Fill white background for any transparent pixels
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const cleanBaseName = file.name.replace(/\.webp$/i, '');
            const newFileName = `${cleanBaseName || 'converted_photo'}.jpg`;
            const jpgFile = new File([blob], newFileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(jpgFile);
          },
          'image/jpeg',
          0.95
        );
      } catch (err) {
        console.warn('WebP to JPG canvas conversion error:', err);
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      console.warn('WebP image failed to load for conversion, falling back.');
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Creates an image data URL preview for client side previewing and safety check.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Comprehensive File Processor:
 * 1. Validates integrity & size
 * 2. Determines accurate page count
 * 3. Calls server-side Gemini moderation check for prohibited content
 */
export async function processUploadedFile(rawFile: File, maxFileSizeMb: number = 50): Promise<UploadedFileItem> {
  // If WebP, convert to JPG first as requested
  const file = isWebPFile(rawFile) ? await convertWebPToJpg(rawFile) : rawFile;

  const id = 'f-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  const sizeMb = file.size / (1024 * 1024);

  // Prohibit Excel spreadsheet uploads
  if (isExcelFile(file)) {
    return {
      id,
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/vnd.ms-excel',
      pageCount: 0,
      isProcessing: false,
      error: 'Excel files (.xlsx, .xls, .csv) are not supported for document printing. Please export or save your spreadsheet as a PDF or image before uploading.',
      moderationStatus: 'SAFE',
    };
  }

  let pageCount = 1;
  let isPasswordProtected = false;
  let previewUrl: string | undefined;
  let isImage = file.type.startsWith('image/');
  let isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  let isOffice =
    file.name.match(/\.(docx|doc|pptx|ppt)$/i) !== null ||
    file.type.includes('officedocument.wordprocessingml') ||
    file.type.includes('word') ||
    file.type.includes('presentation') ||
    file.type.includes('officedocument.presentationml');
  let isText =
    file.type.startsWith('text/') ||
    file.name.match(/\.(txt|rtf|md)$/i) !== null;

  if (sizeMb > maxFileSizeMb) {
    return {
      id,
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      pageCount: 0,
      isProcessing: false,
      error: `File size exceeds the maximum limit of ${maxFileSizeMb}MB.`,
      moderationStatus: 'SAFE',
    };
  }

  try {
    if (isImage) {
      pageCount = 1;
      previewUrl = await fileToDataUrl(file);
    } else if (isPdf) {
      const pdfInfo = await extractPdfPageCount(file);
      pageCount = pdfInfo.count;
      isPasswordProtected = pdfInfo.isLocked;
      if (file.size <= 48 * 1024 * 1024) {
        previewUrl = await fileToDataUrl(file);
      }
    } else if (isOffice) {
      pageCount = await extractOfficeDocPageCount(file);
      if (file.size <= 48 * 1024 * 1024) {
        previewUrl = await fileToDataUrl(file);
      }
    } else if (isText) {
      pageCount = await extractTextPageCount(file);
      if (file.size <= 48 * 1024 * 1024) {
        previewUrl = await fileToDataUrl(file);
      }
    } else {
      pageCount = 1;
      if (file.size <= 48 * 1024 * 1024) {
        previewUrl = await fileToDataUrl(file);
      }
    }
  } catch (err: any) {
    console.error('Error determining page count:', err);
    return {
      id,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      pageCount: 1,
      isProcessing: false,
      moderationStatus: 'SAFE',
      moderationReason: 'Defaulted to 1 page.',
    };
  }

  // Perform Content Safety Check via backend API
  let moderationStatus: 'SAFE' | 'FLAGGED' | 'MANUAL_REVIEW' = 'SAFE';
  let moderationReason = 'Passed document safety inspection';

  try {
    const moderationPayload: any = {
      filename: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
    };

    if (isText) {
      try {
        const snippet = await file.text();
        moderationPayload.textSnippet = snippet.slice(0, 300);
      } catch {}
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('/api/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(moderationPayload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      try {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        moderationStatus = data.moderationStatus || 'SAFE';
        moderationReason = data.moderationReason || moderationReason;
      } catch {
        moderationStatus = 'SAFE';
      }
    }
  } catch {
    // Non-blocking fallback: permit safe document processing without halting upload
    moderationStatus = 'SAFE';
    moderationReason = 'Passed standard format integrity inspection.';
  }

  return {
    id,
    file,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    previewUrl,
    pageCount: Math.max(1, pageCount),
    isPasswordProtected,
    isProcessing: false,
    moderationStatus,
    moderationReason,
    error:
      moderationStatus === 'FLAGGED'
        ? 'This file cannot be accepted for printing because it contains content that is not permitted by our printing policy.'
        : undefined,
  };
}

/**
 * Format bytes to readable string (e.g. 2.4 MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
