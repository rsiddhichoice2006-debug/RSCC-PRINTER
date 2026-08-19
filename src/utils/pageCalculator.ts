import { PageSelectionMode } from '../types';

/**
 * Parses a custom page range string like "1-5, 8, 11-14" and returns an array of unique 1-indexed page numbers.
 */
export function parseCustomPageRange(rangeStr: string, maxPages: number): number[] {
  if (!rangeStr || !rangeStr.trim() || maxPages <= 0) return [];

  const pagesSet = new Set<number>();
  const parts = rangeStr.split(/[,;\s]+/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (!isNaN(start) && !isNaN(end)) {
        const lower = Math.max(1, Math.min(start, end));
        const upper = Math.min(maxPages, Math.max(start, end));
        for (let i = lower; i <= upper; i++) {
          pagesSet.add(i);
        }
      }
    } else {
      const page = parseInt(trimmed, 10);
      if (!isNaN(page) && page >= 1 && page <= maxPages) {
        pagesSet.add(page);
      }
    }
  }

  return Array.from(pagesSet).sort((a, b) => a - b);
}

/**
 * Calculates the number of pages to print based on selection mode and custom range.
 */
export function getSelectedPageCount(
  pageCount: number,
  mode: PageSelectionMode = 'ALL',
  customRange: string = ''
): number {
  if (pageCount <= 0) return 0;

  switch (mode) {
    case 'ODD':
      return Math.ceil(pageCount / 2);
    case 'EVEN':
      return Math.floor(pageCount / 2);
    case 'CUSTOM': {
      const parsed = parseCustomPageRange(customRange, pageCount);
      return parsed.length > 0 ? parsed.length : pageCount;
    }
    case 'ALL':
    default:
      return pageCount;
  }
}
