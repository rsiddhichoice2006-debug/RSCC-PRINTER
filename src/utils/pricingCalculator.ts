import { PaperSize, PaperQuality, PrintType, PrintingSide, ShopPricing } from '../types';

export const DEFAULT_PRICING: ShopPricing = {
  // A4 Black & White
  a4Bw75Single: 5,
  a4Bw75Both: 5,
  a4Bw100Single: 5,
  a4Bw100Both: 5,
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
  bwBoth: 5,
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
