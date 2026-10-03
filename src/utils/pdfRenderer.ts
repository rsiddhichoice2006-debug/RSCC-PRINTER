import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error Vite ?url asset import query
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure worker using local bundled asset with CDN fallback
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker || `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

// In-memory cache for rendered page images: key is `${fileId}_${pageNumber}_${width}`
const pageThumbnailCache = new Map<string, string>();

/**
 * Normalizes any PDF source (File, Data URL, ArrayBuffer, Uint8Array) into a Uint8Array
 */
async function toUint8Array(input: File | ArrayBuffer | Uint8Array | string): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input instanceof File) {
    const ab = await input.arrayBuffer();
    return new Uint8Array(ab);
  }
  if (typeof input === 'string') {
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
      return new Uint8Array(ab);
    }
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
  throw new Error('Unsupported input type for PDF rendering');
}

/**
 * Renders a specific page of a PDF document to a data URL (image/png or image/jpeg).
 * Returns the data URL of the rendered page.
 */
export async function renderPdfPageToDataUrl(
  input: File | ArrayBuffer | Uint8Array | string,
  pageNumber: number = 1,
  targetWidth: number = 600,
  cacheKey?: string
): Promise<string> {
  const fullCacheKey = cacheKey ? `${cacheKey}_p${pageNumber}_w${targetWidth}` : null;
  if (fullCacheKey && pageThumbnailCache.has(fullCacheKey)) {
    return pageThumbnailCache.get(fullCacheKey)!;
  }

  const bytes = await toUint8Array(input);
  const loadingTask = pdfjsLib.getDocument({
    data: bytes,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const safePageNum = Math.min(Math.max(1, pageNumber), numPages);

  const page = await pdf.getPage(safePageNum);
  const unscaledViewport = page.getViewport({ scale: 1.0 });

  // Calculate scale based on desired target width
  const scale = targetWidth / unscaledViewport.width;
  const viewport = page.getViewport({ scale });

  // Render on offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context for PDF rendering');
  }

  // Draw white background first
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
  };

  await page.render(renderContext).promise;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

  if (fullCacheKey) {
    pageThumbnailCache.set(fullCacheKey, dataUrl);
  }

  return dataUrl;
}

/**
 * Renders a PDF page directly onto an existing HTML Canvas element.
 */
export async function renderPdfPageToCanvas(
  input: File | ArrayBuffer | Uint8Array | string,
  canvas: HTMLCanvasElement,
  pageNumber: number = 1,
  targetWidth: number = 600
): Promise<void> {
  const bytes = await toUint8Array(input);
  const loadingTask = pdfjsLib.getDocument({
    data: bytes,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const safePageNum = Math.min(Math.max(1, pageNumber), numPages);

  const page = await pdf.getPage(safePageNum);
  const unscaledViewport = page.getViewport({ scale: 1.0 });

  const scale = targetWidth / unscaledViewport.width;
  const viewport = page.getViewport({ scale });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport: viewport,
  }).promise;
}
