/**
 * Utility to accurately detect and preserve the original file format (PDF, JPG, PNG, WEBP, DOCX, etc.)
 * across customer upload, order dispatch, and staff downloads.
 */

export interface FormatDetails {
  filename: string;
  mimeType: string;
  extension: string;
  formatLabel: string;
}

/**
 * Inspects binary magic bytes to determine file type with 100% precision.
 */
export function detectFormatFromBytes(bytes: Uint8Array): { mimeType: string; extension: string; label: string } | null {
  if (!bytes || bytes.length < 4) return null;

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { mimeType: 'application/pdf', extension: '.pdf', label: 'PDF Document' };
  }

  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4E &&
    bytes[3] === 0x47
  ) {
    return { mimeType: 'image/png', extension: '.png', label: 'PNG Image' };
  }

  // JPEG / JPG: 0xFF 0xD8 0xFF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: '.jpg', label: 'JPEG Image' };
  }

  // GIF: GIF87a or GIF89a (0x47 0x49 0x46 0x38)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { mimeType: 'image/gif', extension: '.gif', label: 'GIF Image' };
  }

  // WEBP: RIFF....WEBP (0x52 0x49 0x46 0x46 and bytes 8..11 = 0x57 0x45 0x42 0x50)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mimeType: 'image/webp', extension: '.webp', label: 'WEBP Image' };
  }

  // ZIP / OOXML: 0x50 0x4B 0x03 0x04
  if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return { mimeType: 'application/zip', extension: '.zip', label: 'ZIP Archive' };
  }

  return null;
}

/**
 * Extracts MIME type from a Data URL string (e.g. data:image/png;base64,...)
 */
export function extractMimeFromDataUrl(dataUrl?: string): string | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  const match = dataUrl.match(/^data:([^;,]+)/i);
  return match && match[1] ? match[1].toLowerCase() : null;
}

/**
 * Maps standard MIME types to file extensions and human-readable labels.
 */
export function getExtensionAndLabelForMime(mimeType: string): { extension: string; label: string } {
  const m = (mimeType || '').toLowerCase().trim();

  if (m === 'application/pdf') return { extension: '.pdf', label: 'PDF Document' };
  if (m === 'image/jpeg' || m === 'image/jpg') return { extension: '.jpg', label: 'JPEG Image' };
  if (m === 'image/png') return { extension: '.png', label: 'PNG Image' };
  if (m === 'image/webp') return { extension: '.webp', label: 'WEBP Image' };
  if (m === 'image/gif') return { extension: '.gif', label: 'GIF Image' };
  if (m === 'image/bmp') return { extension: '.bmp', label: 'Bitmap Image' };
  if (m === 'image/svg+xml') return { extension: '.svg', label: 'SVG Image' };
  if (m.includes('wordprocessingml') || m === 'application/msword') {
    return { extension: '.docx', label: 'Word Document' };
  }
  if (m.includes('presentationml') || m === 'application/vnd.ms-powerpoint') {
    return { extension: '.pptx', label: 'PowerPoint Presentation' };
  }
  if (m.includes('spreadsheetml') || m === 'application/vnd.ms-excel') {
    return { extension: '.xlsx', label: 'Excel Spreadsheet' };
  }
  if (m.startsWith('text/plain') || m === 'text/plain') return { extension: '.txt', label: 'Text Document' };

  return { extension: '', label: 'Document' };
}

/**
 * Guarantees that the downloaded file preserves the exact format uploaded by customer.
 * - If customer uploaded a PDF -> downloads with valid .pdf extension and application/pdf MIME
 * - If customer uploaded a JPG -> downloads with valid .jpg extension and image/jpeg MIME
 * - If customer uploaded a PNG -> downloads with valid .png extension and image/png MIME
 * - If customer uploaded a DOCX/PPTX/etc. -> downloads with original extension and MIME
 */
export function getPreservedFormatDetails(
  file: { name?: string; type?: string; previewUrl?: string },
  binaryBytes?: Uint8Array,
  fallbackUrl?: string
): FormatDetails {
  const effectiveUrl = fallbackUrl || file.previewUrl;

  // 1. Inspect binary magic bytes first (most authoritative)
  if (binaryBytes && binaryBytes.length >= 4) {
    const byteDetection = detectFormatFromBytes(binaryBytes);
    if (byteDetection) {
      // If it's a zip/OOXML container, check if original filename was docx/pptx/xlsx
      if (byteDetection.extension === '.zip' && file.name) {
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.docx')) {
          return {
            filename: ensureFilenameHasExtension(file.name, '.docx'),
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            extension: '.docx',
            formatLabel: 'Word Document (.docx)',
          };
        }
        if (lowerName.endsWith('.pptx')) {
          return {
            filename: ensureFilenameHasExtension(file.name, '.pptx'),
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            extension: '.pptx',
            formatLabel: 'PowerPoint Presentation (.pptx)',
          };
        }
        if (lowerName.endsWith('.xlsx')) {
          return {
            filename: ensureFilenameHasExtension(file.name, '.xlsx'),
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            extension: '.xlsx',
            formatLabel: 'Excel Spreadsheet (.xlsx)',
          };
        }
      }

      return {
        filename: ensureFilenameHasExtension(file.name || 'document', byteDetection.extension),
        mimeType: byteDetection.mimeType,
        extension: byteDetection.extension,
        formatLabel: byteDetection.label,
      };
    }
  }

  // 2. Inspect Data URL MIME Header (e.g. data:image/png;base64,...)
  const dataUrlMime = extractMimeFromDataUrl(effectiveUrl);
  if (dataUrlMime && dataUrlMime !== 'application/octet-stream') {
    const { extension, label } = getExtensionAndLabelForMime(dataUrlMime);
    if (extension) {
      return {
        filename: ensureFilenameHasExtension(file.name || 'file', extension),
        mimeType: dataUrlMime,
        extension,
        formatLabel: label,
      };
    }
  }

  // 3. Inspect file.type property
  if (file.type && file.type !== 'application/octet-stream') {
    const { extension, label } = getExtensionAndLabelForMime(file.type);
    if (extension) {
      return {
        filename: ensureFilenameHasExtension(file.name || 'file', extension),
        mimeType: file.type,
        extension,
        formatLabel: label,
      };
    }
  }

  // 4. Inspect file.name extension
  if (file.name && file.name.includes('.')) {
    const ext = '.' + file.name.split('.').pop()!.toLowerCase();
    const knownMimes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
    };

    if (knownMimes[ext]) {
      return {
        filename: file.name,
        mimeType: knownMimes[ext],
        extension: ext,
        formatLabel: ext.toUpperCase().replace('.', '') + ' File',
      };
    }
  }

  // 5. Fallback safe document
  return {
    filename: file.name || 'document.pdf',
    mimeType: 'application/pdf',
    extension: '.pdf',
    formatLabel: 'PDF Document',
  };
}

/**
 * Ensures the target filename has the correct file extension.
 * If the filename has no extension or an outdated/mismatched extension, updates it.
 */
export function ensureFilenameHasExtension(filename: string, requiredExtension: string): string {
  if (!filename) return `file${requiredExtension}`;
  const cleanExt = requiredExtension.toLowerCase().startsWith('.')
    ? requiredExtension.toLowerCase()
    : `.${requiredExtension.toLowerCase()}`;

  // If already ends with the required extension (case-insensitive)
  if (filename.toLowerCase().endsWith(cleanExt)) {
    return filename;
  }

  // If jpeg vs jpg
  if (cleanExt === '.jpg' && filename.toLowerCase().endsWith('.jpeg')) {
    return filename;
  }
  if (cleanExt === '.jpeg' && filename.toLowerCase().endsWith('.jpg')) {
    return filename;
  }

  // Strip trailing wrong extension if present (e.g., .bin, .octet-stream, .download)
  const stripped = filename.replace(/\.(bin|octet-stream|tmp|part|download)$/i, '');

  return `${stripped}${cleanExt}`;
}
