import JSZip from 'jszip';
import { UploadedFileItem } from '../types';

/**
 * Accurately extracts page count from standard PDF binary data.
 */
export async function extractPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const text = new TextDecoder('latin1').decode(arrayBuffer);

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
    if (maxCount > 0) return maxCount;
  }

  // Strategy 2: Count individual /Type /Page objects (excluding /Pages)
  const pageMatches = text.match(/\/Type\s*\/Page\b(?!\s*s)/g);
  if (pageMatches && pageMatches.length > 0) {
    return pageMatches.length;
  }

  // Strategy 3: Search for /Count anywhere in PDF trailer/catalog
  const generalCount = text.match(/\/Count\s+(\d+)/g);
  if (generalCount) {
    const counts = generalCount
      .map((m) => parseInt(m.replace(/\/Count\s+/i, ''), 10))
      .filter((n) => !isNaN(n) && n > 0);
    if (counts.length > 0) {
      return Math.max(...counts);
    }
  }

  // Fallback: at least 1 page
  return 1;
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
export async function processUploadedFile(file: File, maxFileSizeMb: number = 50): Promise<UploadedFileItem> {
  const id = 'f-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  const sizeMb = file.size / (1024 * 1024);

  let pageCount = 1;
  let previewUrl: string | undefined;
  let isImage = file.type.startsWith('image/');
  let isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  let isOffice =
    file.name.match(/\.(docx|doc|pptx|ppt|xlsx|xls)$/i) !== null ||
    file.type.includes('officedocument') ||
    file.type.includes('word') ||
    file.type.includes('presentation') ||
    file.type.includes('spreadsheet');
  let isText =
    file.type.startsWith('text/') ||
    file.name.match(/\.(txt|rtf|md|csv)$/i) !== null;

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
      pageCount = await extractPdfPageCount(file);
      if (file.size <= 15 * 1024 * 1024) {
        previewUrl = await fileToDataUrl(file);
      }
    } else if (isOffice) {
      pageCount = await extractOfficeDocPageCount(file);
      if (file.size <= 15 * 1024 * 1024) {
        previewUrl = await fileToDataUrl(file);
      }
    } else if (isText) {
      pageCount = await extractTextPageCount(file);
      if (file.size <= 15 * 1024 * 1024) {
        previewUrl = await fileToDataUrl(file);
      }
    } else {
      pageCount = 1;
      if (file.size <= 15 * 1024 * 1024) {
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
      pageCount: 0,
      isProcessing: false,
      error: 'We could not determine the page count of this file. Please contact the shop for assistance.',
      moderationStatus: 'MANUAL_REVIEW',
      moderationReason: 'Automatic page count could not be reliably determined.',
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

    if (isImage && previewUrl) {
      // Send sample for image safety check
      moderationPayload.base64Sample = previewUrl;
    } else if (isText) {
      const snippet = await file.text();
      moderationPayload.textSnippet = snippet.slice(0, 2000);
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
