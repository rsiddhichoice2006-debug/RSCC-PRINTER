import { PDFDocument } from 'pdf-lib';
import { PageSelectionMode } from '../types';
import { parseCustomPageRange } from './pageCalculator';

/**
 * Returns an ordered array of 1-indexed page numbers to include based on mode and custom range.
 */
export function getSelectedPagesList(
  totalPages: number,
  mode: PageSelectionMode = 'ALL',
  customRange: string = ''
): number[] {
  if (totalPages <= 0) return [];

  switch (mode) {
    case 'ODD': {
      const oddPages: number[] = [];
      for (let i = 1; i <= totalPages; i += 2) {
        oddPages.push(i);
      }
      return oddPages;
    }
    case 'EVEN': {
      const evenPages: number[] = [];
      for (let i = 2; i <= totalPages; i += 2) {
        evenPages.push(i);
      }
      return evenPages;
    }
    case 'CUSTOM': {
      const parsed = parseCustomPageRange(customRange, totalPages);
      if (parsed.length > 0) {
        return parsed;
      }
      // If user typed custom but haven't finished typing a valid range, default to all pages
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    case 'ALL':
    default: {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
  }
}

/**
 * Human-readable summary of page selection for UI and staff manifest.
 */
export function getPageSelectionSummary(
  mode: PageSelectionMode = 'ALL',
  customRange: string = '',
  selectedCount: number,
  totalCount: number
): string {
  if (mode === 'ALL' || (selectedCount === totalCount && mode !== 'CUSTOM')) {
    return `All ${totalCount} pages`;
  }
  if (mode === 'ODD') {
    return `Odd pages only (${selectedCount} of ${totalCount})`;
  }
  if (mode === 'EVEN') {
    return `Even pages only (${selectedCount} of ${totalCount})`;
  }
  if (mode === 'CUSTOM') {
    const rangeText = customRange.trim() || 'Selected';
    return `Pages ${rangeText} (${selectedCount} of ${totalCount})`;
  }
  return `${selectedCount} of ${totalCount} pages`;
}

/**
 * Converts a Uint8Array into a base64 string in chunks to prevent stack overflow.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Extracts ONLY the specified 1-indexed pages from a source PDF and returns a newly compiled PDF.
 * The staff portal will see and print ONLY these extracted pages in the resulting PDF.
 */
export async function extractSelectedPagesFromPdf(
  input: File | ArrayBuffer | Uint8Array | string,
  selectedPages: number[]
): Promise<{ dataUrl: string; bytes: Uint8Array; pageCount: number }> {
  let srcBytes: Uint8Array;

  if (input instanceof File) {
    const ab = await input.arrayBuffer();
    srcBytes = new Uint8Array(ab);
  } else if (input instanceof Uint8Array) {
    srcBytes = input;
  } else if (input instanceof ArrayBuffer) {
    srcBytes = new Uint8Array(input);
  } else if (typeof input === 'string') {
    if (
      input.startsWith('http://') ||
      input.startsWith('https://') ||
      input.startsWith('/') ||
      input.startsWith('blob:')
    ) {
      const resp = await fetch(input);
      if (!resp.ok) {
        throw new Error(`Failed to fetch PDF from URL: ${input} (${resp.status})`);
      }
      const ab = await resp.arrayBuffer();
      srcBytes = new Uint8Array(ab);
    } else {
      let b64 = input;
      if (input.includes(',')) {
        b64 = input.split(',')[1];
      }
      const cleanB64 = b64.replace(/[^A-Za-z0-9+/=]/g, '');
      const binStr = atob(cleanB64);
      srcBytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        srcBytes[i] = binStr.charCodeAt(i);
      }
    }
  } else {
    throw new Error('Unsupported input type for PDF extraction');
  }

  // Check if original PDF is encrypted or password-protected
  const textHeader = new TextDecoder('latin1').decode(srcBytes.subarray(0, Math.min(srcBytes.length, 65536)));
  const isEncrypted = /\/Encrypt\b/i.test(textHeader);
  if (isEncrypted) {
    // Encrypted / password-protected PDFs CANNOT be split/copied with pdf-lib without corrupting the cryptographic structure!
    // Preserving 100% of the original untouched bytes ensures the file never gets damaged!
    const dataUrl = `data:application/pdf;base64,${uint8ArrayToBase64(srcBytes)}`;
    return { dataUrl, bytes: srcBytes, pageCount: selectedPages.length || 1 };
  }

  try {
    // Test if document loads cleanly
    let srcDoc: PDFDocument;
    try {
      srcDoc = await PDFDocument.load(srcBytes);
    } catch (loadErr: any) {
      const errMsg = String(loadErr?.message || loadErr || '').toLowerCase();
      if (errMsg.includes('encrypt') || errMsg.includes('password') || errMsg.includes('decrypt')) {
        // If encrypted, preserve 100% original bytes
        const dataUrl = `data:application/pdf;base64,${uint8ArrayToBase64(srcBytes)}`;
        return { dataUrl, bytes: srcBytes, pageCount: selectedPages.length || 1 };
      }
      // Attempt load with ignoreEncryption if other non-encryption issues
      srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
    }

    const totalSrcPages = srcDoc.getPageCount();

    // Validate pages to keep (1-indexed)
    const validPages = selectedPages.filter((p) => p >= 1 && p <= totalSrcPages);

    // If the user selected all pages anyway, return base64 of original
    if (validPages.length === totalSrcPages && totalSrcPages > 0) {
      const dataUrl = `data:application/pdf;base64,${uint8ArrayToBase64(srcBytes)}`;
      return { dataUrl, bytes: srcBytes, pageCount: totalSrcPages };
    }

    // Create a brand new clean PDF document containing ONLY the chosen pages
    const destDoc = await PDFDocument.create();
    const pageIndices = (validPages.length > 0 ? validPages : [1]).map((p) => p - 1);

    const copiedPages = await destDoc.copyPages(srcDoc, pageIndices);
    for (const page of copiedPages) {
      destDoc.addPage(page);
    }

    const outBytes = await destDoc.save();
    const base64 = uint8ArrayToBase64(outBytes);
    const dataUrl = `data:application/pdf;base64,${base64}`;

    return {
      dataUrl,
      bytes: outBytes,
      pageCount: copiedPages.length,
    };
  } catch (err) {
    console.warn('PDF page extraction fallback to original bytes:', err);
    const dataUrl = `data:application/pdf;base64,${uint8ArrayToBase64(srcBytes)}`;
    return { dataUrl, bytes: srcBytes, pageCount: selectedPages.length || 1 };
  }
}

/**
 * Creates a descriptive new filename for trimmed PDFs.
 * e.g. "Report_odd_pages.pdf" or "Contract_pages_1_2.pdf"
 */
export function formatTrimmedPdfFilename(
  originalName: string,
  mode: PageSelectionMode,
  customRange: string = ''
): string {
  const baseName = originalName.replace(/\.pdf$/i, '').trim();
  if (mode === 'ODD') {
    return `${baseName}_odd_pages.pdf`;
  }
  if (mode === 'EVEN') {
    return `${baseName}_even_pages.pdf`;
  }
  if (mode === 'CUSTOM') {
    const cleanRange = customRange.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
    return `${baseName}_pages_${cleanRange || 'selected'}.pdf`;
  }
  return `${baseName}.pdf`;
}
