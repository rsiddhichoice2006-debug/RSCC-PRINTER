export type PrintType = 'BW' | 'COLOUR';
export type PrintingSide = 'SINGLE' | 'BOTH';
export type OrderMode = 'DOCUMENT' | 'PHOTO';
export type PhotoLayoutType = '9_PHOTOS' | '4_PHOTOS' | '2_PHOTOS' | '1_PHOTO';
export type PhotoOrientation = 'PORTRAIT' | 'LANDSCAPE';

export type PaymentStatus =
  | 'PAYMENT_PENDING'
  | 'PAYMENT_VERIFICATION_REQUIRED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_FAILED';

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PRINTING'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ShopPricing {
  bwSingle: number; // e.g. 5
  bwBoth: number;   // e.g. 4
  colorSingle: number; // e.g. 10
  colorBoth: number;   // e.g. 7.5
  photoSheet: number;  // e.g. 15
}

export interface ShopSettings {
  shopName: string;
  shortName: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  upiId: string;
  maxFileSizeMb: number;
  retentionDays: number;
  pickupTimings: string;
  pricing: ShopPricing;
}

export interface UploadedFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
  pageCount: number;
  isProcessing: boolean;
  error?: string;
  moderationStatus: 'SAFE' | 'FLAGGED' | 'PENDING' | 'MANUAL_REVIEW';
  moderationReason?: string;
}

export interface SerializableFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  pageCount: number;
  moderationStatus: 'SAFE' | 'FLAGGED' | 'PENDING' | 'MANUAL_REVIEW';
  moderationReason?: string;
  previewUrl?: string;
}

export interface CustomerDetails {
  name: string;
  mobile: string;
  email?: string;
  specialInstructions?: string;
}

export interface CustomerUser {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  createdAt: string;
  token?: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  deliveryPin: string;
  customer: {
    name: string;
    mobile: string;
    email?: string;
  };
  mode: OrderMode;
  photoLayout?: PhotoLayoutType;
  photoOrientation?: PhotoOrientation;
  files: SerializableFileItem[];
  totalPages: number;
  totalSheets?: number;
  copies: number;
  printType: PrintType;
  printingSide: PrintingSide;
  ratePerPage: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  paymentReference?: string;
  paymentMethod?: string;
  paymentScreenshot?: string;
  paymentScreenshotTime?: string;
  paymentScreenshotFilename?: string;
  paymentWindowExpiresAt?: string;
  ocrVerifiedUpi?: boolean;
  ocrDetectedUpiId?: string;
  ocrVerifiedTime?: boolean;
  ocrTimeDiffMinutes?: number;
  specialInstructions?: string;
  internalNotes?: string[];
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
}

export interface PhotoSlotItem {
  slotIndex: number;
  fileId?: string;
  previewUrl?: string;
  fileName?: string;
  fitMode?: 'cover' | 'contain';
}

export interface AdminStats {
  todayCount: number;
  pendingCount: number;
  printingCount: number;
  readyCount: number;
  completedCount: number;
  pendingPaymentsCount: number;
  todayRevenue: number;
  totalRevenue: number;
  totalOrdersCount: number;
}
