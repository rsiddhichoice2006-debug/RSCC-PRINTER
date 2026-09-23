export type PaperSize = 'A4' | 'A3';
export type PaperQuality = '75_GSM' | '100_GSM';
export type PrintType = 'BW' | 'COLOUR';
export type PrintingSide = 'SINGLE' | 'BOTH';
export type OrderMode = 'DOCUMENT' | 'PHOTO' | 'PASSPORT_PHOTO';
export type PassportServiceType = 'STANDARD_PASSPORT' | 'MIXED_SIZE' | 'A4_IMAGE_COLOR' | 'A3_IMAGE_COLOR';
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
  // A4 Black & White
  a4Bw75Single: number;  // 5
  a4Bw75Both: number;    // 4
  a4Bw100Single: number; // 7
  a4Bw100Both: number;   // 12
  // A4 Colour
  a4Color100Single: number; // 10
  a4Color100Both: number;   // 15
  // A3 Black & White
  a3Bw75Single: number;  // 10
  a3Bw75Both: number;    // 20
  a3Bw100Single: number; // 15
  a3Bw100Both: number;   // 25
  // A3 Colour
  a3Color100Single: number; // 20
  a3Color100Both: number;   // 35
  // Passport Size Photos
  passportStandard: number; // 50
  passportMixed: number;    // 60
  // Compatibility / Fallback properties
  bwSingle: number;
  bwBoth: number;
  colorSingle: number;
  colorBoth: number;
  photoSheet: number;
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
  isAcceptingOrders?: boolean;
  pauseOrderReason?: string;
  webhookUrl?: string;
  autoNotifyReadyWhatsApp?: boolean;
  whatsAppSenderPhone?: string;
  whatsappSingleTabMode?: boolean;
  whatsAppDispatchMode?: 'EXTENSION_SINGLE_TAB' | 'DESKTOP_APP' | 'WEB_WHATSAPP' | 'CLIPBOARD_PASTE' | 'MAKE_WEBHOOK_ONLY';
  pricing: ShopPricing;
}

export type PageSelectionMode = 'ALL' | 'ODD' | 'EVEN' | 'CUSTOM';

export interface UploadedFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
  pageCount: number;
  pageSelectionMode?: PageSelectionMode;
  customPageRange?: string;
  selectedPageCount?: number;
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
  pageSelectionMode?: PageSelectionMode;
  customPageRange?: string;
  selectedPageCount?: number;
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
  userId?: string;
  deliveryPin: string;
  customer: {
    name: string;
    mobile: string;
    email?: string;
  };
  mode: OrderMode;
  paperSize?: PaperSize;
  paperQuality?: PaperQuality;
  passportService?: PassportServiceType;
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
  whatsappNotifiedAt?: string;
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
  // Aliases for seamless UI rendering
  totalOrders?: number;
  todayOrders?: number;
  pendingVerification?: number;
  pendingOrders?: number;
}
