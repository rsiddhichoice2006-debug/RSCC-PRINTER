import { PaperSize, PaperQuality, PrintType, PrintingSide, ShopPricing } from '../types';

export const DEFAULT_PRICING: ShopPricing = {
  // A4 Black & White (1st Set Rate: Single ₹5, Double ₹4)
  a4Bw75Single: 5,
  a4Bw75Both: 4,
  a4Bw100Single: 5,
  a4Bw100Both: 4,
  // Additional Sets (2nd+ Set / Copies Rate: Single ₹2, Double ₹3)
  bwCopySingle: 2,
  bwCopyBoth: 3,
  colorCopySingle: 8,
  colorCopyBoth: 8,
  a3BwCopySingle: 6,
  a3BwCopyBoth: 10,
  a3ColorCopySingle: 15,
  a3ColorCopyBoth: 25,
  // A4 Colour
  a4Color100Single: 10,
  a4Color100Both: 10,
  // A3 Black & White
  a3Bw75Single: 10,
  a3Bw75Both: 20,
  a3Bw100Single: 15,
  a3Bw100Both: 25,
  // A3 Colour
  a3Color100Single: 20,
  a3Color100Both: 35,
  // Passport Size Photos
  passportStandard: 50,
  passportMixed: 60,
  // Compatibility fallbacks
  bwSingle: 5,
  bwBoth: 4,
  colorSingle: 10,
  colorBoth: 10,
  photoSheet: 15,
};

/**
 * Returns the exact configured rate per page based on:
 * Paper Size (A4, A3) -> Print Type (BW, COLOUR) -> GSM (75, 100) -> Printing Side (SINGLE, BOTH)
 */
export function getDocumentRate(
  paperSize: PaperSize,
  printType: PrintType,
  paperQuality: PaperQuality,
  printingSide: PrintingSide,
  pricing: Partial<ShopPricing> = DEFAULT_PRICING
): number {
  const p = { ...DEFAULT_PRICING, ...pricing };

  if (paperSize === 'A4') {
    if (printType === 'BW') {
      if (paperQuality === '75_GSM') {
        return printingSide === 'SINGLE' ? p.a4Bw75Single : p.a4Bw75Both;
      } else {
        return printingSide === 'SINGLE' ? p.a4Bw100Single : p.a4Bw100Both;
      }
    } else {
      // Colour is only available in 100 GSM
      return printingSide === 'SINGLE' ? p.a4Color100Single : p.a4Color100Both;
    }
  } else {
    // A3
    if (printType === 'BW') {
      if (paperQuality === '75_GSM') {
        return printingSide === 'SINGLE' ? p.a3Bw75Single : p.a3Bw75Both;
      } else {
        return printingSide === 'SINGLE' ? p.a3Bw100Single : p.a3Bw100Both;
      }
    } else {
      // Colour is only available in 100 GSM
      return printingSide === 'SINGLE' ? p.a3Color100Single : p.a3Color100Both;
    }
  }
}

/**
 * Validates whether a combination is supported according to the official rate sheet.
 * Rule: 75 GSM is available ONLY for Black & White printing.
 */
export function isSupportedCombination(
  paperSize: PaperSize,
  printType: PrintType,
  paperQuality: PaperQuality
): boolean {
  if (printType === 'COLOUR' && paperQuality === '75_GSM') {
    return false;
  }
  return true;
}

/**
 * Gets valid Paper Quality options for a selected Print Type.
 * When Colour is selected, only 100 GSM is valid.
 */
export function getAvailableQualitiesForPrintType(printType: PrintType): { value: PaperQuality; label: string; note?: string }[] {
  if (printType === 'COLOUR') {
    return [
      { value: '100_GSM', label: '100 GSM (Premium Thick Paper)' },
    ];
  }
  return [
    { value: '75_GSM', label: '75 GSM (Standard Paper - B&W Only)' },
    { value: '100_GSM', label: '100 GSM (Premium High-Quality Paper)' },
  ];
}

/**
 * Returns the rate per page for 2nd and subsequent sets (copies).
 * Standard RSCC Rule:
 * For A4 B&W: Single = ₹2/page, Double (Both) = ₹3/page
 * For A4 Colour: Single = ₹8/page, Both = ₹8/page
 */
export function getAdditionalSetRate(
  paperSize: PaperSize,
  printType: PrintType,
  printingSide: PrintingSide,
  pricing: Partial<ShopPricing> = DEFAULT_PRICING
): number {
  const p = { ...DEFAULT_PRICING, ...pricing };
  if (paperSize === 'A4') {
    if (printType === 'BW') {
      return printingSide === 'SINGLE' ? (p.bwCopySingle ?? 2) : (p.bwCopyBoth ?? 3);
    } else {
      return printingSide === 'SINGLE' ? (p.colorCopySingle ?? 8) : (p.colorCopyBoth ?? 8);
    }
  } else {
    if (printType === 'BW') {
      return printingSide === 'SINGLE' ? (p.a3BwCopySingle ?? 6) : (p.a3BwCopyBoth ?? 10);
    } else {
      return printingSide === 'SINGLE' ? (p.a3ColorCopySingle ?? 15) : (p.a3ColorCopyBoth ?? 25);
    }
  }
}

/**
 * Calculates document order cost based on number of sets:
 * Set 1: pages × firstSetRate
 * Set 2+: (sets - 1) × pages × additionalSetRate
 */
export function calculateDocumentOrderAmount(
  pages: number,
  sets: number,
  firstSetRate: number,
  additionalSetRate: number
): {
  totalAmount: number;
  firstSetCost: number;
  additionalSetsCost: number;
  additionalSetsCount: number;
} {
  const p = Math.max(0, pages || 0);
  const s = Math.max(1, sets || 1);
  const firstSetCost = p * firstSetRate;
  const additionalSetsCount = Math.max(0, s - 1);
  const additionalSetsCost = additionalSetsCount * p * additionalSetRate;
  const totalAmount = firstSetCost + additionalSetsCost;

  return {
    totalAmount,
    firstSetCost,
    additionalSetsCost,
    additionalSetsCount,
  };
}
