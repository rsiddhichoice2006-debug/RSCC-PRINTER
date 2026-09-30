import { PhotoLayoutType, PhotoOrientation, PhotoSlotItem } from '../types';

export interface PhotoLayoutConfig {
  id: PhotoLayoutType;
  name: string;
  photoCount: number;
  gridCols: number;
  gridRows: number;
  dimensionsText: string;
  description: string;
  defaultOrientation: PhotoOrientation;
  aspectRatio: string; // approximate W/H ratio for slots
  asciiPreview: string;
}

export const PHOTO_LAYOUTS: Record<PhotoLayoutType, PhotoLayoutConfig> = {
  '9_PHOTOS': {
    id: '9_PHOTOS',
    name: '9 Photos on 1 A4 Page',
    photoCount: 9,
    gridCols: 3,
    gridRows: 3,
    dimensionsText: '6.7 × 9.4 cm each',
    description: '3 × 3 grid, ideal for mini wallet prints, passport collections, or scrapbook memories.',
    defaultOrientation: 'PORTRAIT',
    aspectRatio: '67 / 94',
    asciiPreview: `┌─────────────────────┐
│ ┌───┐ ┌───┐ ┌───┐ │
│ │ 1 │ │ 2 │ │ 3 │ │
│ ├───┤ ├───┤ ├───┤ │
│ │ 4 │ │ 5 │ │ 6 │ │
│ ├───┤ ├───┤ ├───┤ │
│ │ 7 │ │ 8 │ │ 9 │ │
│ └───┘ └───┘ └───┘ │
└─────────────────────┘`,
  },
  '4_PHOTOS': {
    id: '4_PHOTOS',
    name: '4 Photos on 1 A4 Page',
    photoCount: 4,
    gridCols: 2,
    gridRows: 2,
    dimensionsText: '9 × 13 cm each',
    description: '2 × 2 grid, standard postcard size prints (approx 3.5 × 5 inches).',
    defaultOrientation: 'PORTRAIT',
    aspectRatio: '9 / 13',
    asciiPreview: `┌─────────────────────┐
│    ┌─────┐ ┌─────┐ │
│    │  1  │ │  2  │ │
│    └─────┘ └─────┘ │
│    ┌─────┐ ┌─────┐ │
│    │  3  │ │  4  │ │
│    └─────┘ └─────┘ │
└─────────────────────┘`,
  },
  '2_PHOTOS': {
    id: '2_PHOTOS',
    name: '2 Photos on 1 A4 Page',
    photoCount: 2,
    gridCols: 1,
    gridRows: 2,
    dimensionsText: '13 × 18 cm each',
    description: '2 large photos on A4 sheet (approx 5 × 7 inches), perfect for framed portraits.',
    defaultOrientation: 'PORTRAIT',
    aspectRatio: '18 / 13',
    asciiPreview: `┌─────────────────────┐
│     ┌──────────┐    │
│     │    1     │    │
│     └──────────┘    │
│     ┌──────────┐    │
│     │    2     │    │
│     └──────────┘    │
└─────────────────────┘`,
  },
  '1_PHOTO': {
    id: '1_PHOTO',
    name: '1 Photo — Full Page',
    photoCount: 1,
    gridCols: 1,
    gridRows: 1,
    dimensionsText: 'Full A4 Page (20 × 28.7 cm)',
    description: 'Maximum printable A4 poster area. Choose portrait or landscape orientation.',
    defaultOrientation: 'PORTRAIT',
    aspectRatio: '210 / 297',
    asciiPreview: `┌─────────────────────┐
│                     │
│                     │
│      PHOTO 1        │
│                     │
│                     │
│                     │
└─────────────────────┘`,
  },
};

/**
 * Calculates total sheets needed given uploaded photos and selected layout.
 */
export function calculateRequiredSheets(
  photoCount: number,
  layoutType: PhotoLayoutType
): number {
  if (photoCount <= 0) return 1;
  const capacityPerSheet = PHOTO_LAYOUTS[layoutType].photoCount;
  return Math.ceil(photoCount / capacityPerSheet);
}

/**
 * Generates slots distributed across multiple sheets.
 */
export function generateSheetSlots(
  photos: {
    id: string;
    previewUrl: string;
    name: string;
    fitMode?: 'cover' | 'contain';
    rotation?: number;
    isLandscape?: boolean;
  }[],
  layoutType: PhotoLayoutType,
  sheetIndex: number,
  defaultFitMode: 'cover' | 'contain' = 'contain'
): PhotoSlotItem[] {
  const layout = PHOTO_LAYOUTS[layoutType];
  const capacity = layout.photoCount;
  const startIndex = sheetIndex * capacity;

  const slots: PhotoSlotItem[] = [];
  for (let i = 0; i < capacity; i++) {
    const photoIdx = startIndex + i;
    if (photoIdx < photos.length) {
      slots.push({
        slotIndex: i,
        fileId: photos[photoIdx]?.id,
        previewUrl: photos[photoIdx]?.previewUrl,
        fileName: photos[photoIdx]?.name || 'photo.jpg',
        fitMode: photos[photoIdx]?.fitMode || defaultFitMode,
      });
    } else {
      slots.push({
        slotIndex: i,
        fitMode: defaultFitMode,
      });
    }
  }
  return slots;
}
