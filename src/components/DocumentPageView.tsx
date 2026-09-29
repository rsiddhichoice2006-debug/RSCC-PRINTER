import React, { useState, useEffect } from 'react';
import { renderPdfPageToDataUrl } from '../utils/pdfRenderer';
import { FileText, Loader2, Image as ImageIcon } from 'lucide-react';

interface DocumentPageViewProps {
  file?: File;
  previewUrl?: string;
  fileName?: string;
  pageNumber: number;
  cacheKey?: string;
  className?: string;
  printType?: 'BW' | 'COLOUR';
  alt?: string;
  showBadge?: boolean;
  badgeLabel?: string;
}

export const DocumentPageView: React.FC<DocumentPageViewProps> = ({
  file,
  previewUrl,
  fileName = '',
  pageNumber = 1,
  cacheKey,
  className = '',
  printType = 'BW',
  alt = 'Document page preview',
  showBadge = true,
  badgeLabel,
}) => {
  const [renderedImageUrl, setRenderedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isPdf =
    (file && file.type === 'application/pdf') ||
    fileName.toLowerCase().endsWith('.pdf') ||
    (previewUrl && previewUrl.startsWith('data:application/pdf'));

  const isImage =
    (file && file.type.startsWith('image/')) ||
    fileName.match(/\.(jpe?g|png|webp|bmp|gif|svg)$/i) !== null ||
    (previewUrl && previewUrl.startsWith('data:image/'));

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setLoadError(null);

    async function loadPage() {
      try {
        if (isImage) {
          // If image, use previewUrl or create object URL from file
          if (previewUrl && previewUrl.startsWith('data:image/')) {
            if (!isCancelled) {
              setRenderedImageUrl(previewUrl);
              setIsLoading(false);
            }
            return;
          }
          if (file) {
            const url = URL.createObjectURL(file);
            if (!isCancelled) {
              setRenderedImageUrl(url);
              setIsLoading(false);
            }
            return;
          }
        }

        if (isPdf) {
          const src = file || previewUrl;
          if (!src) {
            if (!isCancelled) {
              setIsLoading(false);
              setLoadError('No PDF data available');
            }
            return;
          }

          const resolvedCacheKey = cacheKey || (file ? `${file.name}_${file.size}` : fileName);
          const dataUrl = await renderPdfPageToDataUrl(src, pageNumber, 700, resolvedCacheKey);

          if (!isCancelled) {
            setRenderedImageUrl(dataUrl);
            setIsLoading(false);
          }
          return;
        }

        // Neither image nor PDF (e.g. DOCX without previewUrl)
        if (previewUrl && previewUrl.startsWith('data:')) {
          if (!isCancelled) {
            setRenderedImageUrl(previewUrl);
            setIsLoading(false);
          }
        } else {
          if (!isCancelled) {
            setIsLoading(false);
          }
        }
      } catch (err: any) {
        console.warn(`[DocumentPageView] Could not render page ${pageNumber}:`, err);
        if (!isCancelled) {
          setLoadError(err?.message || 'Could not render page preview');
          setIsLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      isCancelled = true;
    };
  }, [file, previewUrl, fileName, pageNumber, cacheKey, isPdf, isImage]);

  const grayscaleStyle: React.CSSProperties =
    printType === 'BW'
      ? {
          filter: 'grayscale(100%) contrast(105%)',
          WebkitFilter: 'grayscale(100%) contrast(105%)',
        }
      : {};

  return (
    <div className={`relative overflow-hidden bg-white flex flex-col items-center justify-center ${className}`}>
      {/* Page Badge */}
      {showBadge && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-slate-900/85 backdrop-blur-xs text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm border border-slate-700 pointer-events-none">
          <span>{badgeLabel || `Page ${pageNumber}`}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 z-5 bg-white/90 backdrop-blur-2xs flex flex-col items-center justify-center gap-2 p-4 text-center">
          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
          <span className="text-[11px] font-bold text-slate-600">
            Rendering Page {pageNumber}...
          </span>
        </div>
      )}

      {/* Rendered Document Image */}
      {renderedImageUrl && !loadError ? (
        <div className="w-full h-full flex items-center justify-center overflow-hidden bg-white p-1">
          <img
            src={renderedImageUrl}
            alt={alt}
            style={grayscaleStyle}
            className="w-full h-full object-contain select-none transition-all duration-300"
            loading="lazy"
          />
        </div>
      ) : null}

      {/* Fallback / Error view */}
      {(!renderedImageUrl || loadError) && !isLoading && (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-slate-50 text-slate-500 space-y-2">
          {isPdf ? (
            <FileText className="w-8 h-8 text-slate-400 stroke-1" />
          ) : (
            <ImageIcon className="w-8 h-8 text-slate-400 stroke-1" />
          )}
          <div className="text-xs font-bold text-slate-700">
            {badgeLabel || `Page ${pageNumber}`}
          </div>
          <div className="text-[10px] text-slate-400 max-w-[140px] truncate">
            {fileName || 'Uploaded Document'}
          </div>
        </div>
      )}
    </div>
  );
};
