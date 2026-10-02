import { PDFDocument, rgb } from 'pdf-lib';
import { PagesPerSheet, PaperSize, PrintingSide } from '../types';

export type NupOrientation = 'SIDE_BY_SIDE' | 'TOP_BOTTOM';

export interface GenerateNupOptions {
  input: File | ArrayBuffer | Uint8Array | string;
  pagesPerSheet: PagesPerSheet;
  selectedPages?: number[];
  paperSize?: PaperSize;
  orientation?: NupOrientation;
}

export interface NupResult {
  dataUrl: string;
  bytes: Uint8Array;
  sheetCount: number;
  originalPageCount: number;
  effectivePrintedPages: number;
}

/**
 * Standard paper dimensions in PDF points (72 points / inch)
 */
const PAPER_DIMENSIONS = {
  A4: {
    portrait: { width: 595.28, height: 841.89 },
    landscape: { width: 841.89, height: 595.28 },
  },
  A3: {
    portrait: { width: 841.89, height: 1190.55 },
    landscape: { width: 1190.55, height: 841.89 },
  },
};

/**
 * Converts Uint8Array to base64 safely without call stack overflow
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
 * Normalizes input to Uint8Array
 */
async function toUint8Array(input: File | ArrayBuffer | Uint8Array | string): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input instanceof File) {
    const ab = await input.arrayBuffer();
    return new Uint8Array(ab);
  }
  if (typeof input === 'string') {
    let b64 = input;
    if (input.includes(',')) {
      b64 = input.split(',')[1];
    }
    const cleanB64 = b64.replace(/[^A-Za-z0-9+/=]/g, '');
    const binStr = atob(cleanB64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
  }
  throw new Error('Unsupported input type for PDF processing');
}

/**
 * Calculates how many physical sheets and printed sides are required.
 */
export function calculateEffectiveSheets(
  totalPages: number,
  pagesPerSheet: PagesPerSheet = 1,
  printingSide: PrintingSide = 'SINGLE'
): {
  effectivePrintedPages: number;
  physicalSheets: number;
} {
  const p = Math.max(0, totalPages);
  const n = pagesPerSheet || 1;
  const effectivePrintedPages = Math.ceil(p / n);
  const physicalSheets = printingSide === 'BOTH'
    ? Math.ceil(effectivePrintedPages / 2)
    : effectivePrintedPages;

  return {
    effectivePrintedPages,
    physicalSheets,
  };
}

/**
 * Generates an N-Up compiled PDF (e.g. 2 pages on same side, half-and-half)
 */
export async function generateNupPdf(options: GenerateNupOptions): Promise<NupResult> {
  const {
    input,
    pagesPerSheet = 1,
    paperSize = 'A4',
    orientation = 'SIDE_BY_SIDE',
  } = options;

  const srcBytes = await toUint8Array(input);

  // Check if original PDF is encrypted or password-protected
  const textHeader = new TextDecoder('latin1').decode(srcBytes.subarray(0, Math.min(srcBytes.length, 65536)));
  if (/\/Encrypt\b/i.test(textHeader)) {
    return {
      dataUrl: `data:application/pdf;base64,${uint8ArrayToBase64(srcBytes)}`,
      bytes: srcBytes,
      sheetCount: 1,
      originalPageCount: 1,
      effectivePrintedPages: 1,
    };
  }

  let srcDoc: PDFDocument;
  try {
    srcDoc = await PDFDocument.load(srcBytes);
  } catch (loadErr: any) {
    const errMsg = String(loadErr?.message || loadErr || '').toLowerCase();
    if (errMsg.includes('encrypt') || errMsg.includes('password') || errMsg.includes('decrypt')) {
      return {
        dataUrl: `data:application/pdf;base64,${uint8ArrayToBase64(srcBytes)}`,
        bytes: srcBytes,
        sheetCount: 1,
        originalPageCount: 1,
        effectivePrintedPages: 1,
      };
    }
    srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
  }
  const totalSrcPages = srcDoc.getPageCount();

  const validPages = (options.selectedPages && options.selectedPages.length > 0)
    ? options.selectedPages.filter((p) => p >= 1 && p <= totalSrcPages)
    : Array.from({ length: totalSrcPages }, (_, i) => i + 1);

  // If 1-up, simply extract the selected pages into a clean document
  if (pagesPerSheet === 1) {
    const destDoc = await PDFDocument.create();
    const copiedPages = await destDoc.copyPages(srcDoc, validPages.map((p) => p - 1));
    for (const page of copiedPages) {
      destDoc.addPage(page);
    }
    const outBytes = await destDoc.save();
    return {
      dataUrl: `data:application/pdf;base64,${uint8ArrayToBase64(outBytes)}`,
      bytes: outBytes,
      sheetCount: copiedPages.length,
      originalPageCount: validPages.length,
      effectivePrintedPages: copiedPages.length,
    };
  }

  // 2-Up or 4-Up Multi-Page Layout
  const destDoc = await PDFDocument.create();
  const pageIndices = validPages.map((p) => p - 1);
  const embeddedPages = await destDoc.embedPdf(srcDoc, pageIndices);

  const paperDims = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.A4;

  if (pagesPerSheet === 2) {
    // 2 Pages per Sheet
    // SIDE_BY_SIDE: Landscape sheet, left half and right half
    // TOP_BOTTOM: Portrait sheet, top half and bottom half
    const isLandscape = orientation === 'SIDE_BY_SIDE';
    const sheetDims = isLandscape ? paperDims.landscape : paperDims.portrait;
    const sheetW = sheetDims.width;
    const sheetH = sheetDims.height;

    const margin = 18;
    const gap = 14;

    const pairsCount = Math.ceil(embeddedPages.length / 2);

    for (let pairIdx = 0; pairIdx < pairsCount; pairIdx++) {
      const pageIndex1 = pairIdx * 2;
      const pageIndex2 = pageIndex1 + 1;
      const p1 = embeddedPages[pageIndex1];
      const p2 = pageIndex2 < embeddedPages.length ? embeddedPages[pageIndex2] : null;

      const sheet = destDoc.addPage([sheetW, sheetH]);

      if (isLandscape) {
        // SIDE_BY_SIDE: Left half and Right half
        const slotW = (sheetW - 2 * margin - gap) / 2;
        const slotH = sheetH - 2 * margin;

        // Draw Left Page (Page 1 of pair)
        const scale1 = Math.min(slotW / p1.width, slotH / p1.height);
        const w1 = p1.width * scale1;
        const h1 = p1.height * scale1;
        const x1 = margin + (slotW - w1) / 2;
        const y1 = margin + (slotH - h1) / 2;
        sheet.drawPage(p1, { x: x1, y: y1, width: w1, height: h1 });

        // Draw Right Page (Page 2 of pair if present)
        if (p2) {
          const slot2X = margin + slotW + gap;
          const scale2 = Math.min(slotW / p2.width, slotH / p2.height);
          const w2 = p2.width * scale2;
          const h2 = p2.height * scale2;
          const x2 = slot2X + (slotW - w2) / 2;
          const y2 = margin + (slotH - h2) / 2;
          sheet.drawPage(p2, { x: x2, y: y2, width: w2, height: h2 });
        }

        // Draw center dividing dashed cut/fold line
        sheet.drawLine({
          start: { x: sheetW / 2, y: margin / 2 },
          end: { x: sheetW / 2, y: sheetH - margin / 2 },
          color: rgb(0.8, 0.8, 0.8),
          dashArray: [4, 4],
          thickness: 0.8,
        });
      } else {
        // TOP_BOTTOM: Top half and Bottom half
        const slotW = sheetW - 2 * margin;
        const slotH = (sheetH - 2 * margin - gap) / 2;

        // Top slot (higher Y in PDF coordinate space)
        const topSlotY = margin + slotH + gap;
        const scale1 = Math.min(slotW / p1.width, slotH / p1.height);
        const w1 = p1.width * scale1;
        const h1 = p1.height * scale1;
        const x1 = margin + (slotW - w1) / 2;
        const y1 = topSlotY + (slotH - h1) / 2;
        sheet.drawPage(p1, { x: x1, y: y1, width: w1, height: h1 });

        // Bottom slot (lower Y in PDF coordinate space)
        if (p2) {
          const scale2 = Math.min(slotW / p2.width, slotH / p2.height);
          const w2 = p2.width * scale2;
          const h2 = p2.height * scale2;
          const x2 = margin + (slotW - w2) / 2;
          const y2 = margin + (slotH - h2) / 2;
          sheet.drawPage(p2, { x: x2, y: y2, width: w2, height: h2 });
        }

        // Draw center horizontal dashed cut/fold line
        sheet.drawLine({
          start: { x: margin / 2, y: sheetH / 2 },
          end: { x: sheetW - margin / 2, y: sheetH / 2 },
          color: rgb(0.8, 0.8, 0.8),
          dashArray: [4, 4],
          thickness: 0.8,
        });
      }
    }
  } else if (pagesPerSheet === 4) {
    // 4 Pages per Sheet (2x2 Quad Grid on Portrait Sheet)
    const sheetDims = paperDims.portrait;
    const sheetW = sheetDims.width;
    const sheetH = sheetDims.height;
    const margin = 16;
    const gap = 12;

    const slotW = (sheetW - 2 * margin - gap) / 2;
    const slotH = (sheetH - 2 * margin - gap) / 2;

    const quadsCount = Math.ceil(embeddedPages.length / 4);

    for (let qIdx = 0; qIdx < quadsCount; qIdx++) {
      const sheet = destDoc.addPage([sheetW, sheetH]);
      const baseIdx = qIdx * 4;

      // 4 quadrant coordinates [col, row] where row 0 is top, row 1 is bottom
      const quadSlots = [
        { col: 0, row: 0 }, // Top-Left
        { col: 1, row: 0 }, // Top-Right
        { col: 0, row: 1 }, // Bottom-Left
        { col: 1, row: 1 }, // Bottom-Right
      ];

      quadSlots.forEach((slot, sIdx) => {
        const pageIdx = baseIdx + sIdx;
        if (pageIdx >= embeddedPages.length) return;
        const page = embeddedPages[pageIdx];

        const slotX = margin + slot.col * (slotW + gap);
        const slotY = slot.row === 0 ? margin + slotH + gap : margin;

        const scale = Math.min(slotW / page.width, slotH / page.height);
        const w = page.width * scale;
        const h = page.height * scale;
        const x = slotX + (slotW - w) / 2;
        const y = slotY + (slotH - h) / 2;

        sheet.drawPage(page, { x, y, width: w, height: h });
      });

      // Draw horizontal & vertical dividers
      sheet.drawLine({
        start: { x: sheetW / 2, y: margin / 2 },
        end: { x: sheetW / 2, y: sheetH - margin / 2 },
        color: rgb(0.8, 0.8, 0.8),
        dashArray: [4, 4],
        thickness: 0.8,
      });
      sheet.drawLine({
        start: { x: margin / 2, y: sheetH / 2 },
        end: { x: sheetW - margin / 2, y: sheetH / 2 },
        color: rgb(0.8, 0.8, 0.8),
        dashArray: [4, 4],
        thickness: 0.8,
      });
    }
  }

  const outBytes = await destDoc.save();
  const effectivePrintedPages = Math.ceil(validPages.length / pagesPerSheet);

  return {
    dataUrl: `data:application/pdf;base64,${uint8ArrayToBase64(outBytes)}`,
    bytes: outBytes,
    sheetCount: destDoc.getPageCount(),
    originalPageCount: validPages.length,
    effectivePrintedPages,
  };
}
