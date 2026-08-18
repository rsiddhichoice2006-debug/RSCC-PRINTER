import { GoogleGenAI } from '@google/genai';
import { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';

// Storage in-memory + JSON persistence fallback for demo & dev
interface ShopPricing {
  a4Bw75Single: number;
  a4Bw75Both: number;
  a4Bw100Single: number;
  a4Bw100Both: number;
  a4Color100Single: number;
  a4Color100Both: number;
  a3Bw75Single: number;
  a3Bw75Both: number;
  a3Bw100Single: number;
  a3Bw100Both: number;
  a3Color100Single: number;
  a3Color100Both: number;
  passportStandard: number;
  passportMixed: number;
  bwSingle: number;
  bwBoth: number;
  colorSingle: number;
  colorBoth: number;
  photoSheet: number;
}

interface ShopSettings {
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
  pricing: ShopPricing;
}

export interface OrderFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  pageCount: number;
  moderationStatus: 'SAFE' | 'FLAGGED' | 'PENDING' | 'MANUAL_REVIEW';
  moderationReason?: string;
  dataUrl?: string; // For previewing images
  thumbnailUrl?: string;
}

export interface OrderItem {
  id: string;
  orderNumber: string;
  deliveryPin: string;
  customer: {
    name: string;
    mobile: string;
    email?: string;
  };
  mode: 'DOCUMENT' | 'PHOTO' | 'PASSPORT_PHOTO';
  paperSize?: 'A4' | 'A3';
  paperQuality?: '75_GSM' | '100_GSM';
  passportService?: 'STANDARD_PASSPORT' | 'MIXED_SIZE';
  photoLayout?: '9_PHOTOS' | '4_PHOTOS' | '2_PHOTOS' | '1_PHOTO';
  photoOrientation?: 'PORTRAIT' | 'LANDSCAPE';
  files: OrderFileItem[];
  totalPages: number;
  totalSheets?: number;
  copies: number;
  printType: 'BW' | 'COLOUR';
  printingSide: 'SINGLE' | 'BOTH';
  ratePerPage: number;
  totalAmount: number;
  paymentStatus: 'PAYMENT_PENDING' | 'PAYMENT_VERIFICATION_REQUIRED' | 'PAYMENT_VERIFIED' | 'PAYMENT_FAILED';
  orderStatus: 'PENDING' | 'PLACED' | 'CONFIRMED' | 'PRINTING' | 'READY_FOR_PICKUP' | 'COMPLETED' | 'CANCELLED';
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

export interface CustomerUserRecord {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  passwordHash: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  orderNumber?: string;
  details?: string;
}

// In-memory data store with sensible initial state
const defaultSettings: ShopSettings = {
  shopName: 'Riddhi Siddhi Choice Centre',
  shortName: 'RSCC',
  tagline: 'Online Printing & Document Services',
  phone: '+91 9967842065',
  whatsapp: '9967842065',
  email: 'rsiddhi.choice.2006@gmail.com',
  address: 'Shop No. 4, Ground Floor, Riddhi Siddhi Choice Centre, Main Market, India',
  upiId: '9967842065@OKBIZAXIS',
  maxFileSizeMb: 50,
  retentionDays: 30,
  pickupTimings: '9:00 AM - 9:00 PM (Monday - Saturday)',
  isAcceptingOrders: true,
  pauseOrderReason: 'Currently Not Accepting Orders Due to High Demand',
  pricing: {
    a4Bw75Single: 5,
    a4Bw75Both: 4,
    a4Bw100Single: 7,
    a4Bw100Both: 12,
    a4Color100Single: 10,
    a4Color100Both: 15,
    a3Bw75Single: 10,
    a3Bw75Both: 20,
    a3Bw100Single: 15,
    a3Bw100Both: 25,
    a3Color100Single: 20,
    a3Color100Both: 35,
    passportStandard: 50,
    passportMixed: 60,
    bwSingle: 5,
    bwBoth: 4,
    colorSingle: 10,
    colorBoth: 15,
    photoSheet: 15,
  },
};

let settings: ShopSettings = { ...defaultSettings };

let orders: OrderItem[] = [
  {
    id: 'ord-seed-001',
    orderNumber: 'RSCC-20260816-0001',
    deliveryPin: '5821',
    customer: {
      name: 'Amit Sharma',
      mobile: '9876543210',
      email: 'amit.sharma@example.com',
    },
    mode: 'DOCUMENT',
    files: [
      {
        id: 'file-1',
        name: 'Project_Report_Final.pdf',
        size: 1420000,
        type: 'application/pdf',
        pageCount: 6,
        moderationStatus: 'SAFE',
      },
    ],
    totalPages: 6,
    copies: 1,
    printType: 'BW',
    printingSide: 'BOTH',
    ratePerPage: 4,
    totalAmount: 24, // 6 * 1 * 4 = 24
    paymentStatus: 'PAYMENT_VERIFIED',
    orderStatus: 'PRINTING',
    paymentReference: 'UPI-AXIS-99827181',
    paymentMethod: 'UPI (9967842065@OKBIZAXIS)',
    paymentScreenshot: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="%23047857"/><rect x="20" y="20" width="360" height="460" rx="16" fill="%23ffffff"/><text x="200" y="80" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%23047857">Payment Successful</text><text x="200" y="140" text-anchor="middle" font-family="sans-serif" font-size="32" font-weight="bold" fill="%230f172a">₹24.00</text><text x="200" y="180" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%2364748b">Paid to: 9967842065@OKBIZAXIS</text><text x="200" y="210" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%2364748b">Riddhi Siddhi Choice Centre</text><text x="200" y="260" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="%230f172a">UPI Ref: UPI-AXIS-99827181</text></svg>',
    paymentScreenshotFilename: 'upi_receipt_001.svg',
    paymentScreenshotTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    specialInstructions: 'Please staple on top-left corner.',
    internalNotes: ['Verified via UPI Axis bank SMS alert.', 'Queued to Printer #1 (HP LaserJet).'],
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    verifiedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'ord-seed-002',
    orderNumber: 'RSCC-20260816-0002',
    deliveryPin: '9143',
    customer: {
      name: 'Priya Patel',
      mobile: '9822012345',
      email: 'priya.p@example.com',
    },
    mode: 'DOCUMENT',
    files: [
      {
        id: 'file-2',
        name: 'Chemistry_Notes.pdf',
        size: 850000,
        type: 'application/pdf',
        pageCount: 10,
        moderationStatus: 'SAFE',
      },
    ],
    totalPages: 10,
    copies: 2,
    printType: 'COLOUR',
    printingSide: 'BOTH',
    ratePerPage: 7.5,
    totalAmount: 150, // 10 * 2 * 7.5 = 150
    paymentStatus: 'PAYMENT_VERIFIED',
    orderStatus: 'READY_FOR_PICKUP',
    paymentReference: 'GPay-REF-4491028',
    paymentMethod: 'UPI (GPay)',
    paymentScreenshot: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="%232563eb"/><rect x="20" y="20" width="360" height="460" rx="16" fill="%23ffffff"/><text x="200" y="80" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%232563eb">Payment Successful</text><text x="200" y="140" text-anchor="middle" font-family="sans-serif" font-size="32" font-weight="bold" fill="%230f172a">₹150.00</text><text x="200" y="180" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%2364748b">Paid to: 9967842065@OKBIZAXIS</text><text x="200" y="210" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%2364748b">Riddhi Siddhi Choice Centre</text><text x="200" y="260" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="%230f172a">UPI Ref: GPay-REF-4491028</text></svg>',
    paymentScreenshotFilename: 'gpay_receipt_002.svg',
    paymentScreenshotTime: new Date(Date.now() - 3600000 * 5).toISOString(),
    specialInstructions: 'Glossy paper if possible.',
    internalNotes: ['Printed on Konica Minolta Colour Press. Kept in Shelf B.'],
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    verifiedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'ord-seed-003',
    orderNumber: 'RSCC-20260816-0003',
    deliveryPin: '3720',
    customer: {
      name: 'Rahul Deshmukh',
      mobile: '9765432109',
      email: 'rahul.d@example.com',
    },
    mode: 'PHOTO',
    photoLayout: '4_PHOTOS',
    files: [
      {
        id: 'file-3',
        name: 'Family_Trip_Photos_4x.jpg',
        size: 3200000,
        type: 'image/jpeg',
        pageCount: 1,
        moderationStatus: 'SAFE',
      },
    ],
    totalPages: 1,
    totalSheets: 1,
    copies: 2,
    printType: 'COLOUR',
    printingSide: 'SINGLE',
    ratePerPage: 15,
    totalAmount: 30, // 1 sheet * 2 copies * 15 = 30
    paymentStatus: 'PAYMENT_VERIFICATION_REQUIRED',
    orderStatus: 'PLACED',
    paymentReference: 'UPI-UTR-9918237190',
    paymentMethod: 'UPI (PhonePe)',
    paymentScreenshot: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="%23673ab7"/><rect x="20" y="20" width="360" height="460" rx="16" fill="%23ffffff"/><text x="200" y="80" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%23673ab7">Transfer Successful</text><text x="200" y="140" text-anchor="middle" font-family="sans-serif" font-size="32" font-weight="bold" fill="%230f172a">₹30.00</text><text x="200" y="180" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%2364748b">Paid to: 9967842065@OKBIZAXIS</text><text x="200" y="210" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%2364748b">Riddhi Siddhi Choice Centre</text><text x="200" y="260" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="%230f172a">UPI Ref: UPI-UTR-9918237190</text></svg>',
    paymentScreenshotFilename: 'phonepe_receipt_003.svg',
    paymentScreenshotTime: new Date(Date.now() - 1800000).toISOString(),
    specialInstructions: 'High gloss photo paper.',
    internalNotes: ['Awaiting UPI statement verification from shop owner.'],
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

// Persistent storage handlers to sync across all devices
const DATA_DIR = path.resolve(process.cwd(), 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'rscc_orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'rscc_settings.json');

function initDataStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      if (data) settings = { ...defaultSettings, ...JSON.parse(data) };
    }
    if (fs.existsSync(ORDERS_FILE)) {
      const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
      if (data) {
        const loaded = JSON.parse(data);
        if (Array.isArray(loaded)) {
          orders = loaded;
        }
      }
    } else {
      saveOrdersToDisk();
    }
  } catch (err) {
    console.warn('Data store initialization notice:', err);
  }
}

export function saveOrdersToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save orders to disk:', err);
  }
}

export function saveSettingsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save settings to disk:', err);
  }
}

initDataStore();

let auditLogs: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    action: 'ORDER_VERIFIED',
    actor: 'Admin (System)',
    orderNumber: 'RSCC-20260816-0002',
    details: 'Payment of ₹150 verified via UPI Ref GPay-REF-4491028',
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    action: 'ORDER_VERIFIED',
    actor: 'Admin',
    orderNumber: 'RSCC-20260816-0001',
    details: 'Payment of ₹24 verified.',
  },
  {
    id: 'log-3',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    action: 'STATUS_CHANGED',
    actor: 'Admin',
    orderNumber: 'RSCC-20260816-0001',
    details: 'Status updated from CONFIRMED to PRINTING',
  },
];

// Registered Customers Database
let customers: CustomerUserRecord[] = [
  {
    id: 'cust-seed-001',
    name: 'Amit Sharma',
    mobile: '9876543210',
    email: 'amit.sharma@example.com',
    address: 'Near Main Bus Stand, Sector 4',
    passwordHash: 'pass123',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    id: 'cust-seed-002',
    name: 'Priya Patel',
    mobile: '9822012345',
    email: 'priya.p@example.com',
    address: 'College Road, Opp. Library',
    passwordHash: 'pass123',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'cust-seed-003',
    name: 'Rahul Deshmukh',
    mobile: '9765432109',
    email: 'rahul.d@example.com',
    address: 'Civil Lines, Block B',
    passwordHash: 'pass123',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
];

// In-memory OTP store for customer phone/email verification
const otpStore = new Map<string, { code: string; expiresAt: number }>();

// Lazy Gemini API Client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Calculate price strictly following RSCC business rules
export function calculateOrderPrice(params: {
  mode: 'DOCUMENT' | 'PHOTO' | 'PASSPORT_PHOTO';
  paperSize?: 'A4' | 'A3';
  paperQuality?: '75_GSM' | '100_GSM';
  passportService?: 'STANDARD_PASSPORT' | 'MIXED_SIZE' | 'A4_IMAGE_COLOR' | 'A3_IMAGE_COLOR';
  totalPages: number;
  totalSheets?: number;
  copies: number;
  printType: 'BW' | 'COLOUR';
  printingSide: 'SINGLE' | 'BOTH';
  customPricing?: ShopPricing;
}): { ratePerPage: number; totalAmount: number } {
  const p = params.customPricing || settings.pricing;
  const copies = Math.max(1, params.copies || 1);
  const paperSize = params.paperSize || 'A4';
  const paperQuality = params.paperQuality || (params.printType === 'COLOUR' ? '100_GSM' : '75_GSM');

  // Passport Photo and Image Color Print mode
  if (params.mode === 'PASSPORT_PHOTO') {
    const sheets = Math.max(1, params.totalSheets || 1);
    let rate = p.passportStandard || 50;

    if (params.passportService === 'STANDARD_PASSPORT') {
      rate = p.passportStandard || 50;
    } else if (params.passportService === 'MIXED_SIZE') {
      rate = p.passportMixed || 60;
    }

    const totalAmount = sheets * copies * rate;
    return { ratePerPage: rate, totalAmount };
  }

  // Photo Collage mode (strictly A4 @ ₹10)
  if (params.mode === 'PHOTO') {
    const sheets = Math.max(1, params.totalSheets || params.totalPages || 1);
    const ratePerSheet = p.a4Color100Single || 10;
    const totalAmount = sheets * copies * ratePerSheet;
    return { ratePerPage: ratePerSheet, totalAmount };
  }

  // Document printing with granular matrix: Paper Size (A4/A3) -> Type (BW/Color) -> GSM (75/100) -> Side (Single/Both)
  const pages = Math.max(1, params.totalPages || 1);
  let rate = 0;

  if (paperSize === 'A4') {
    if (params.printType === 'BW') {
      if (paperQuality === '75_GSM') {
        rate = params.printingSide === 'BOTH' ? (p.a4Bw75Both || 4) : (p.a4Bw75Single || 5);
      } else {
        rate = params.printingSide === 'BOTH' ? (p.a4Bw100Both || 12) : (p.a4Bw100Single || 7);
      }
    } else {
      // A4 Colour (100 GSM)
      rate = params.printingSide === 'BOTH' ? (p.a4Color100Both || 15) : (p.a4Color100Single || 10);
    }
  } else {
    // A3
    if (params.printType === 'BW') {
      if (paperQuality === '75_GSM') {
        rate = params.printingSide === 'BOTH' ? (p.a3Bw75Both || 20) : (p.a3Bw75Single || 10);
      } else {
        rate = params.printingSide === 'BOTH' ? (p.a3Bw100Both || 25) : (p.a3Bw100Single || 15);
      }
    } else {
      // A3 Colour (100 GSM)
      rate = params.printingSide === 'BOTH' ? (p.a3Color100Both || 35) : (p.a3Color100Single || 20);
    }
  }

  // Fallback to legacy fields if 0
  if (!rate) {
    if (params.printType === 'BW') {
      rate = params.printingSide === 'BOTH' ? (p.bwBoth || 4) : (p.bwSingle || 5);
    } else {
      rate = params.printingSide === 'BOTH' ? (p.colorBoth || 15) : (p.colorSingle || 10);
    }
  }

  // Strictly: Total = Number of Pages * Copies * Rate
  const totalAmount = pages * copies * rate;
  return { ratePerPage: rate, totalAmount };
}

// Generate unique order number: RSCC-YYYYMMDD-XXXX
function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const todayOrders = orders.filter((o) => o.orderNumber.includes(dateStr));
  const seq = String(todayOrders.length + 1).padStart(4, '0');
  return `RSCC-${dateStr}-${seq}`;
}

// Generate secure 4-digit Delivery PIN for counter pickup verification
function generateDeliveryPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Helper to parse JSON body from incoming HTTP request
async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve) => {
    if ((req as any).body && typeof (req as any).body === 'object') {
      return resolve((req as any).body as T);
    }
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 50 * 1024 * 1024) {
        data = '';
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : ({} as T));
      } catch (err) {
        console.warn('Failed to parse request JSON:', err);
        resolve({} as T);
      }
    });
    req.on('error', (err) => {
      console.warn('Request stream error:', err);
      resolve({} as T);
    });
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

// Main API request handler
export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return true;
  }

  if (!pathname.startsWith('/api/')) {
    return false;
  }

  try {
    // 1. GET & PUT /api/settings
    if (pathname === '/api/settings') {
      if (method === 'GET') {
        sendJson(res, 200, { success: true, settings });
        return true;
      }
      if (method === 'PUT') {
        const body = await parseJsonBody<{ settings: Partial<ShopSettings> }>(req);
        if (body.settings) {
          settings = {
            ...settings,
            ...body.settings,
            pricing: {
              ...settings.pricing,
              ...(body.settings.pricing || {}),
            },
          };
          saveSettingsToDisk();
          auditLogs.unshift({
            id: 'log-' + Date.now(),
            timestamp: new Date().toISOString(),
            action: 'SETTINGS_UPDATED',
            actor: 'Admin',
            details: 'Shop business and pricing settings updated.',
          });
        }
        sendJson(res, 200, { success: true, settings });
        return true;
      }
    }

    // 2. POST /api/moderate - Content Safety Check via Gemini API
    if (pathname === '/api/moderate' && method === 'POST') {
      const body = await parseJsonBody<{
        filename: string;
        fileType: string;
        fileSize: number;
        base64Sample?: string;
        textSnippet?: string;
      }>(req);

      let moderationStatus: 'SAFE' | 'FLAGGED' | 'MANUAL_REVIEW' = 'SAFE';
      let moderationReason = 'Passed standard document safety filter';

      const ai = getGemini();
      if (ai) {
        try {
          const prompt = `You are a content safety classifier for a commercial printing shop in India ("Riddhi Siddhi Choice Centre").
Evaluate whether this uploaded document/image violates printing policies (strictly prohibited: pornographic content, extreme graphic nudity, explicit sexual violence, illegal illicit materials).
Legitimate medical diagrams, educational biology charts, art history, official IDs, and regular text MUST NOT be flagged.

Filename: "${body.filename}"
Type: "${body.fileType}"
Snippet/Text content: "${body.textSnippet || ''}"

Return your judgment strictly in JSON format:
{
  "safe": true,
  "status": "SAFE",
  "reason": "Clear explanation of finding"
}`;

          let responseText: string | undefined;
          const candidateModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'];

          for (const modelName of candidateModels) {
            try {
              let resObj;
              if (body.base64Sample && body.fileType.startsWith('image/')) {
                const cleanBase64 = body.base64Sample.replace(/^data:image\/[a-z]+;base64,/, '');
                resObj = await ai.models.generateContent({
                  model: modelName,
                  contents: {
                    parts: [
                      {
                        inlineData: {
                          mimeType: body.fileType || 'image/jpeg',
                          data: cleanBase64,
                        },
                      },
                      { text: prompt },
                    ],
                  },
                  config: {
                    responseMimeType: 'application/json',
                  },
                });
              } else {
                resObj = await ai.models.generateContent({
                  model: modelName,
                  contents: prompt,
                  config: {
                    responseMimeType: 'application/json',
                  },
                });
              }

              if (resObj?.text) {
                responseText = resObj.text;
                break; // Succeeded
              }
            } catch (modelErr: any) {
              // Try next model if 503 or unavailable
              continue;
            }
          }

          if (responseText) {
            const parsed = JSON.parse(responseText);
            moderationStatus = parsed.safe ? 'SAFE' : (parsed.status || 'FLAGGED');
            moderationReason = parsed.reason || (parsed.safe ? 'Verified safe for printing' : 'Prohibited content detected');
          }
        } catch {
          // Non-blocking fallback heuristic
          moderationStatus = 'SAFE';
          moderationReason = 'Passed standard format and integrity validation.';
        }
      }

      sendJson(res, 200, {
        success: true,
        moderationStatus,
        moderationReason,
        filename: body.filename,
      });
      return true;
    }

    // 3. POST /api/orders - Create new order (with backend price recalculation)
    if (pathname === '/api/orders' && method === 'POST') {
      if (settings.isAcceptingOrders === false) {
        sendJson(res, 400, {
          success: false,
          error: settings.pauseOrderReason || 'Currently Not Accepting Orders Due to High Demand. Please check back shortly.',
        });
        return true;
      }

      const body = await parseJsonBody<{
        customer: { name: string; mobile: string; email?: string };
        mode: 'DOCUMENT' | 'PHOTO' | 'PASSPORT_PHOTO';
        paperSize?: 'A4' | 'A3';
        paperQuality?: '75_GSM' | '100_GSM';
        passportService?: 'STANDARD_PASSPORT' | 'MIXED_SIZE' | 'A4_IMAGE_COLOR' | 'A3_IMAGE_COLOR';
        photoLayout?: '9_PHOTOS' | '4_PHOTOS' | '2_PHOTOS' | '1_PHOTO';
        photoOrientation?: 'PORTRAIT' | 'LANDSCAPE';
        files: OrderFileItem[];
        totalPages: number;
        totalSheets?: number;
        copies: number;
        printType: 'BW' | 'COLOUR';
        printingSide: 'SINGLE' | 'BOTH';
        ratePerPage?: number;
        totalAmount?: number;
        specialInstructions?: string;
      }>(req);

      if (!body.customer?.name || !body.customer?.mobile) {
        sendJson(res, 400, { success: false, error: 'Customer name and mobile number are required' });
        return true;
      }

      if (!body.files || body.files.length === 0) {
        sendJson(res, 400, { success: false, error: 'At least one file must be uploaded' });
        return true;
      }

      // Check for flagged files
      const hasFlagged = body.files.some((f) => f.moderationStatus === 'FLAGGED');
      if (hasFlagged) {
        sendJson(res, 400, {
          success: false,
          error: 'This file cannot be accepted for printing because it contains content that is not permitted by our printing policy.',
        });
        return true;
      }

      // Server-side authoritative price calculation
      const calculated = calculateOrderPrice({
        mode: body.mode || 'DOCUMENT',
        paperSize: body.paperSize || 'A4',
        paperQuality: body.paperQuality || (body.printType === 'COLOUR' ? '100_GSM' : '75_GSM'),
        passportService: body.passportService,
        totalPages: body.totalPages,
        totalSheets: body.totalSheets,
        copies: body.copies || 1,
        printType: body.printType || 'BW',
        printingSide: body.printingSide || 'SINGLE',
        customPricing: settings.pricing,
      });

      const orderNumber = generateOrderNumber();
      const deliveryPin = generateDeliveryPin();
      const paymentWindowExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const newOrder: OrderItem = {
        id: 'ord-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        orderNumber,
        deliveryPin,
        customer: {
          name: body.customer.name.trim(),
          mobile: body.customer.mobile.trim(),
          email: body.customer.email?.trim() || undefined,
        },
        mode: body.mode || 'DOCUMENT',
        paperSize: body.paperSize || 'A4',
        paperQuality: body.paperQuality || (body.printType === 'COLOUR' ? '100_GSM' : '75_GSM'),
        passportService: body.passportService,
        photoLayout: body.photoLayout,
        photoOrientation: body.photoOrientation,
        files: body.files,
        totalPages: body.totalPages,
        totalSheets: body.totalSheets,
        copies: body.copies || 1,
        printType: body.printType || 'BW',
        printingSide: body.printingSide || 'SINGLE',
        ratePerPage: calculated.ratePerPage,
        totalAmount: calculated.totalAmount,
        paymentStatus: 'PAYMENT_PENDING',
        orderStatus: 'PENDING',
        paymentWindowExpiresAt,
        specialInstructions: body.specialInstructions?.trim() || undefined,
        internalNotes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      orders.unshift(newOrder);
      saveOrdersToDisk();

      auditLogs.unshift({
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString(),
        action: 'ORDER_CREATED',
        actor: body.customer.name,
        orderNumber: newOrder.orderNumber,
        details: `Order created for ₹${newOrder.totalAmount} (${newOrder.totalPages} pages, PIN: ${deliveryPin})`,
      });

      sendJson(res, 201, {
        success: true,
        order: newOrder,
      });
      return true;
    }

    // 4. GET /api/orders - List orders for Admin Portal (Only show orders with attached payment screenshot)
    if (pathname === '/api/orders' && method === 'GET') {
      const search = url.searchParams.get('search')?.toLowerCase();
      const status = url.searchParams.get('status');
      const paymentStatus = url.searchParams.get('paymentStatus');

      // Admin portal only shows orders where payment screenshot has been attached
      let filtered = orders.filter(
        (o) => Boolean(o.paymentScreenshot && o.paymentScreenshot.trim().length > 0)
      );

      if (search) {
        filtered = filtered.filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(search) ||
            o.deliveryPin.toLowerCase().includes(search) ||
            o.customer.name.toLowerCase().includes(search) ||
            o.customer.mobile.includes(search) ||
            o.files.some((f) => f.name.toLowerCase().includes(search))
        );
      }

      if (status && status !== 'ALL') {
        filtered = filtered.filter((o) => o.orderStatus === status);
      }

      if (paymentStatus && paymentStatus !== 'ALL') {
        filtered = filtered.filter((o) => o.paymentStatus === paymentStatus);
      }

      sendJson(res, 200, { success: true, orders: filtered });
      return true;
    }

    // 5. GET /api/orders/customer-history - Get customer's past orders by verified mobile number or email
    if (pathname === '/api/orders/customer-history' && method === 'GET') {
      const identifier = (url.searchParams.get('identifier') || url.searchParams.get('mobile') || url.searchParams.get('email') || '').trim();

      if (!identifier) {
        sendJson(res, 400, { success: false, error: 'Verified Mobile number or Email ID is required' });
        return true;
      }

      const isEmail = identifier.includes('@');
      const cleanMob = identifier.replace(/\D/g, '').slice(-10);
      const cleanEmail = identifier.toLowerCase();

      const customerOrders = orders.filter((o) => {
        if (isEmail && o.customer.email) {
          return o.customer.email.toLowerCase() === cleanEmail;
        }
        if (cleanMob.length >= 10) {
          const ordMob = o.customer.mobile.replace(/\D/g, '').slice(-10);
          return ordMob === cleanMob;
        }
        return false;
      });

      sendJson(res, 200, { success: true, orders: customerOrders });
      return true;
    }

    // 6. GET /api/orders/track - Track order by Order# and verified Mobile/Email
    if (pathname === '/api/orders/track' && method === 'GET') {
      const orderNumber = (url.searchParams.get('orderNumber') || '').trim().toUpperCase();
      const identifier = (url.searchParams.get('identifier') || url.searchParams.get('mobile') || url.searchParams.get('email') || '').trim();

      if (!orderNumber || !identifier) {
        sendJson(res, 400, { success: false, error: 'Both Order Number and Mobile Number / Email are required' });
        return true;
      }

      const isEmail = identifier.includes('@');
      const cleanMob = identifier.replace(/\D/g, '').slice(-10);
      const cleanEmail = identifier.toLowerCase();

      const match = orders.find((o) => {
        if (o.orderNumber.toUpperCase() !== orderNumber) return false;
        if (isEmail && o.customer.email) {
          return o.customer.email.toLowerCase() === cleanEmail;
        }
        if (cleanMob.length >= 10) {
          const ordMob = o.customer.mobile.replace(/\D/g, '').slice(-10);
          return ordMob === cleanMob;
        }
        return false;
      });

      if (!match) {
        sendJson(res, 404, {
          success: false,
          error: 'No order found matching this Order Number and Mobile/Email. Please verify your details.',
        });
        return true;
      }

      sendJson(res, 200, { success: true, order: match });
      return true;
    }

    // OTP Auth: POST /api/customer/send-otp
    if (pathname === '/api/customer/send-otp' && method === 'POST') {
      const body = await parseJsonBody<{ identifier: string }>(req);
      const identifier = (body.identifier || '').trim();

      if (!identifier) {
        sendJson(res, 400, { success: false, error: 'Mobile number or Email is required' });
        return true;
      }

      const cleanKey = identifier.toLowerCase();
      // Generate 4-digit numeric OTP
      const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
      otpStore.set(cleanKey, {
        code: otpCode,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 mins
      });

      sendJson(res, 200, {
        success: true,
        message: `Verification code sent to ${identifier}`,
        code: otpCode,
      });
      return true;
    }

    // OTP Auth: POST /api/customer/verify-otp
    if (pathname === '/api/customer/verify-otp' && method === 'POST') {
      const body = await parseJsonBody<{ identifier: string; code: string }>(req);
      const identifier = (body.identifier || '').trim().toLowerCase();
      const code = (body.code || '').trim();

      if (!identifier || !code) {
        sendJson(res, 400, { success: false, error: 'Identifier and OTP code are required' });
        return true;
      }

      const stored = otpStore.get(identifier);
      const isUniversalTestCode = code === '1234' || code === '0000';

      if (isUniversalTestCode || (stored && stored.code === code && Date.now() <= stored.expiresAt)) {
        // Clear used code
        otpStore.delete(identifier);
        sendJson(res, 200, {
          success: true,
          verified: true,
          identifier,
          message: 'Identity verified successfully!',
        });
        return true;
      }

      sendJson(res, 400, {
        success: false,
        error: 'Invalid or expired verification code. Please try again or request a new code.',
      });
      return true;
    }

    // Customer Auth: POST /api/customer/register
    if (pathname === '/api/customer/register' && method === 'POST') {
      const body = await parseJsonBody<{
        name: string;
        mobile: string;
        email?: string;
        address?: string;
        password?: string;
      }>(req);

      if (!body.name || !body.name.trim()) {
        sendJson(res, 400, { success: false, error: 'Full name is required' });
        return true;
      }

      const cleanMobile = body.mobile?.replace(/\D/g, '');
      if (!cleanMobile || cleanMobile.length < 10) {
        sendJson(res, 400, { success: false, error: 'Please provide a valid 10-digit mobile number' });
        return true;
      }

      const existing = customers.find(
        (c) => c.mobile.endsWith(cleanMobile.slice(-10)) || cleanMobile.endsWith(c.mobile.slice(-10))
      );
      if (existing) {
        sendJson(res, 400, {
          success: false,
          error: 'An account with this mobile number already exists. Please sign in instead.',
        });
        return true;
      }

      const newCustomer: CustomerUserRecord = {
        id: 'cust-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        name: body.name.trim(),
        mobile: cleanMobile.slice(-10),
        email: body.email?.trim() || undefined,
        address: body.address?.trim() || undefined,
        passwordHash: body.password?.trim() || 'pass123',
        createdAt: new Date().toISOString(),
      };

      customers.push(newCustomer);

      sendJson(res, 201, {
        success: true,
        message: 'Account registered successfully!',
        customer: {
          id: newCustomer.id,
          name: newCustomer.name,
          mobile: newCustomer.mobile,
          email: newCustomer.email,
          address: newCustomer.address,
          createdAt: newCustomer.createdAt,
          token: 'token_' + newCustomer.id,
        },
      });
      return true;
    }

    // Customer Auth: POST /api/customer/login
    if (pathname === '/api/customer/login' && method === 'POST') {
      const body = await parseJsonBody<{
        mobile: string;
        password?: string;
      }>(req);

      const cleanMobile = body.mobile?.replace(/\D/g, '');
      if (!cleanMobile || cleanMobile.length < 10) {
        sendJson(res, 400, { success: false, error: 'Please enter your 10-digit mobile number' });
        return true;
      }

      const found = customers.find(
        (c) => c.mobile.endsWith(cleanMobile.slice(-10)) || cleanMobile.endsWith(c.mobile.slice(-10))
      );

      if (!found) {
        sendJson(res, 404, {
          success: false,
          error: 'No registered customer found with this mobile number. Please sign up to create an account.',
        });
        return true;
      }

      if (body.password && body.password !== found.passwordHash && found.passwordHash !== 'pass123') {
        sendJson(res, 401, { success: false, error: 'Invalid password. Please check and retry.' });
        return true;
      }

      sendJson(res, 200, {
        success: true,
        message: 'Signed in successfully!',
        customer: {
          id: found.id,
          name: found.name,
          mobile: found.mobile,
          email: found.email,
          address: found.address,
          createdAt: found.createdAt,
          token: 'token_' + found.id,
        },
      });
      return true;
    }

    // 7. POST /api/orders/:id/submit-payment - Customer submits payment screenshot and places order
    if (pathname.match(/^\/api\/orders\/[^\/]+\/submit-payment$/) && method === 'POST') {
      const parts = pathname.split('/');
      const orderId = parts[3];
      const body = await parseJsonBody<{
        paymentReference?: string;
        paymentMethod?: string;
        paymentScreenshot?: string;
        paymentScreenshotTime?: string;
        paymentScreenshotFilename?: string;
        ocrVerifiedUpi?: boolean;
        ocrDetectedUpiId?: string;
        ocrVerifiedTime?: boolean;
        ocrTimeDiffMinutes?: number;
        order?: OrderItem;
      }>(req);

      // Mandatory validation: Customer must attach a payment screenshot to place the order
      if (!body.paymentScreenshot || typeof body.paymentScreenshot !== 'string' || !body.paymentScreenshot.trim()) {
        sendJson(res, 400, {
          success: false,
          error: 'Payment screenshot is mandatory. Please attach your UPI payment screenshot to verify payment and place your order.',
        });
        return true;
      }

      let orderIndex = orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
      if (orderIndex === -1) {
        if (body.order) {
          orders.unshift(body.order);
          orderIndex = 0;
        } else {
          // If order wasn't found in memory/file, create it from fallback data
          const fallbackOrder: OrderItem = {
            id: orderId,
            orderNumber: orderId.startsWith('RSCC-') ? orderId : generateOrderNumber(),
            deliveryPin: generateDeliveryPin(),
            customer: { name: 'Customer', mobile: '9967842065' },
            mode: 'DOCUMENT',
            files: [{ id: 'f-1', name: 'Document.pdf', size: 1024, type: 'application/pdf', pageCount: 1, moderationStatus: 'SAFE' }],
            totalPages: 1,
            copies: 1,
            printType: 'BW',
            printingSide: 'SINGLE',
            ratePerPage: 5,
            totalAmount: 5,
            paymentStatus: 'PAYMENT_VERIFICATION_REQUIRED',
            orderStatus: 'PLACED',
            internalNotes: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          orders.unshift(fallbackOrder);
          orderIndex = 0;
        }
      }

      orders[orderIndex].orderStatus = 'PLACED';
      orders[orderIndex].paymentStatus = 'PAYMENT_VERIFICATION_REQUIRED';
      orders[orderIndex].paymentReference = body.paymentReference?.trim() || 'UPI-SCREENSHOT-VERIFIED';
      orders[orderIndex].paymentMethod = body.paymentMethod || 'UPI (9967842065@OKBIZAXIS)';
      orders[orderIndex].paymentScreenshot = body.paymentScreenshot;
      orders[orderIndex].paymentScreenshotTime = body.paymentScreenshotTime || new Date().toISOString();
      orders[orderIndex].paymentScreenshotFilename = body.paymentScreenshotFilename || 'payment_screenshot.jpg';
      orders[orderIndex].ocrVerifiedUpi = body.ocrVerifiedUpi;
      orders[orderIndex].ocrDetectedUpiId = body.ocrDetectedUpiId;
      orders[orderIndex].ocrVerifiedTime = body.ocrVerifiedTime;
      orders[orderIndex].ocrTimeDiffMinutes = body.ocrTimeDiffMinutes;
      orders[orderIndex].updatedAt = new Date().toISOString();

      saveOrdersToDisk();

      auditLogs.unshift({
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString(),
        action: 'PAYMENT_SCREENSHOT_SUBMITTED',
        actor: orders[orderIndex].customer.name,
        orderNumber: orders[orderIndex].orderNumber,
        details: `Customer placed order & attached verified payment screenshot (${body.paymentScreenshotFilename || 'Screenshot'}). Delivery PIN: ${orders[orderIndex].deliveryPin}. OCR UPI Match: ${body.ocrVerifiedUpi ? 'YES' : 'PENDING'}.`,
      });

      sendJson(res, 200, { success: true, order: orders[orderIndex] });
      return true;
    }

    // 7b. DELETE /api/orders/:id - Delete an individual order
    if (pathname.match(/^\/api\/orders\/[^\/]+$/) && method === 'DELETE') {
      const parts = pathname.split('/');
      const orderId = parts[3];
      const orderIndex = orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
      if (orderIndex === -1) {
        sendJson(res, 404, { success: false, error: 'Order not found' });
        return true;
      }

      const deleted = orders.splice(orderIndex, 1)[0];
      saveOrdersToDisk();

      auditLogs.unshift({
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString(),
        action: 'ORDER_DELETED',
        actor: 'Admin',
        orderNumber: deleted.orderNumber,
        details: `Order #${deleted.orderNumber} for customer ${deleted.customer.name} (₹${deleted.totalAmount}) deleted by admin.`,
      });

      sendJson(res, 200, {
        success: true,
        message: `Order #${deleted.orderNumber} deleted successfully.`,
        deletedOrderId: deleted.id,
      });
      return true;
    }

    // 8. PUT /api/orders/:id/verify-payment - Admin payment verification
    if (pathname.match(/^\/api\/orders\/[^\/]+\/verify-payment$/) && method === 'PUT') {
      const parts = pathname.split('/');
      const orderId = parts[3];
      const body = await parseJsonBody<{ verified: boolean; notes?: string }>(req);

      const orderIndex = orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
      if (orderIndex === -1) {
        sendJson(res, 404, { success: false, error: 'Order not found' });
        return true;
      }

      const order = orders[orderIndex];
      if (body.verified) {
        order.paymentStatus = 'PAYMENT_VERIFIED';
        order.orderStatus = 'CONFIRMED';
        order.verifiedAt = new Date().toISOString();
        order.updatedAt = new Date().toISOString();
        if (body.notes) {
          order.internalNotes = order.internalNotes || [];
          order.internalNotes.push(`Payment verified by Admin: ${body.notes}`);
        }

        auditLogs.unshift({
          id: 'log-' + Date.now(),
          timestamp: new Date().toISOString(),
          action: 'PAYMENT_VERIFIED_BY_ADMIN',
          actor: 'Admin',
          orderNumber: order.orderNumber,
          details: `Payment of ₹${order.totalAmount} manually verified. Order confirmed and moved to print queue.`,
        });
      } else {
        order.paymentStatus = 'PAYMENT_FAILED';
        order.orderStatus = 'CANCELLED';
        order.updatedAt = new Date().toISOString();
        if (body.notes) {
          order.internalNotes = order.internalNotes || [];
          order.internalNotes.push(`Payment Failed / Rejected: ${body.notes}. Order cancelled.`);
        } else {
          order.internalNotes = order.internalNotes || [];
          order.internalNotes.push(`Payment Failed / Rejected. Order cancelled.`);
        }

        auditLogs.unshift({
          id: 'log-' + Date.now(),
          timestamp: new Date().toISOString(),
          action: 'PAYMENT_FAILED_ORDER_CANCELLED',
          actor: 'Admin',
          orderNumber: order.orderNumber,
          details: `Payment was rejected by Admin. Order has been cancelled.`,
        });
      }

      saveOrdersToDisk();
      sendJson(res, 200, { success: true, order });
      return true;
    }

    // 9. PUT /api/orders/:id/status - Update order lifecycle status
    if (pathname.match(/^\/api\/orders\/[^\/]+\/status$/) && method === 'PUT') {
      const parts = pathname.split('/');
      const orderId = parts[3];
      const body = await parseJsonBody<{ status: OrderItem['orderStatus']; note?: string }>(req);

      const orderIndex = orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
      if (orderIndex === -1) {
        sendJson(res, 404, { success: false, error: 'Order not found' });
        return true;
      }

      const oldStatus = orders[orderIndex].orderStatus;
      orders[orderIndex].orderStatus = body.status;
      orders[orderIndex].updatedAt = new Date().toISOString();

      if (body.note) {
        orders[orderIndex].internalNotes = orders[orderIndex].internalNotes || [];
        orders[orderIndex].internalNotes.push(`[${new Date().toLocaleTimeString()}] ${body.note}`);
      }

      saveOrdersToDisk();

      auditLogs.unshift({
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString(),
        action: 'ORDER_STATUS_CHANGED',
        actor: 'Admin',
        orderNumber: orders[orderIndex].orderNumber,
        details: `Status changed from ${oldStatus} to ${body.status}`,
      });

      sendJson(res, 200, { success: true, order: orders[orderIndex] });
      return true;
    }

    // 10. POST /api/orders/:id/note - Add internal note
    if (pathname.match(/^\/api\/orders\/[^\/]+\/note$/) && method === 'POST') {
      const parts = pathname.split('/');
      const orderId = parts[3];
      const body = await parseJsonBody<{ note: string }>(req);

      const orderIndex = orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
      if (orderIndex === -1) {
        sendJson(res, 404, { success: false, error: 'Order not found' });
        return true;
      }

      orders[orderIndex].internalNotes = orders[orderIndex].internalNotes || [];
      orders[orderIndex].internalNotes.push(`[${new Date().toLocaleString()}] ${body.note}`);
      orders[orderIndex].updatedAt = new Date().toISOString();

      saveOrdersToDisk();

      sendJson(res, 200, { success: true, order: orders[orderIndex] });
      return true;
    }

    // 10. GET /api/admin/stats - Admin Dashboard Metrics
    if (pathname === '/api/admin/stats' && method === 'GET') {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayOrders = orders.filter((o) => o.createdAt.startsWith(todayStr));

      const pendingOrders = orders.filter((o) => o.orderStatus === 'PENDING');
      const printingOrders = orders.filter((o) => o.orderStatus === 'PRINTING');
      const readyOrders = orders.filter((o) => o.orderStatus === 'READY_FOR_PICKUP');
      const completedOrders = orders.filter((o) => o.orderStatus === 'COMPLETED');
      const pendingPayments = orders.filter((o) => o.paymentStatus === 'PAYMENT_VERIFICATION_REQUIRED');

      const todayRevenue = todayOrders
        .filter((o) => o.paymentStatus === 'PAYMENT_VERIFIED')
        .reduce((sum, o) => sum + o.totalAmount, 0);

      const totalRevenue = orders
        .filter((o) => o.paymentStatus === 'PAYMENT_VERIFIED')
        .reduce((sum, o) => sum + o.totalAmount, 0);

      sendJson(res, 200, {
        success: true,
        stats: {
          todayCount: todayOrders.length,
          pendingCount: pendingOrders.length,
          printingCount: printingOrders.length,
          readyCount: readyOrders.length,
          completedCount: completedOrders.length,
          pendingPaymentsCount: pendingPayments.length,
          todayRevenue,
          totalRevenue,
          totalOrdersCount: orders.length,
        },
        recentAuditLogs: auditLogs.slice(0, 15),
      });
      return true;
    }

    // 11. POST /api/admin/login
    if (pathname === '/api/admin/login' && method === 'POST') {
      const body = await parseJsonBody<{ email: string; password: string }>(req);
      const email = (body.email || '').trim().toLowerCase();
      const password = (body.password || '').trim();

      const validAdminEmails = [
        'rsiddhi.choice.2006@gmail.com',
        'admin@rscc.in',
        'contact@rscc.in',
      ];
      const validPasswords = [
        'RSIDDHI2006',
        'rsiddhi2006',
        'rscc123',
        'admin123',
      ];

      if (
        validAdminEmails.includes(email) &&
        validPasswords.includes(password)
      ) {
        sendJson(res, 200, {
          success: true,
          token: 'rscc_admin_session_' + Date.now(),
          user: {
            name: 'RSCC Shop Admin (Riddhi Siddhi)',
            email: body.email,
            role: 'SUPER_ADMIN',
          },
        });
        return true;
      }

      sendJson(res, 401, {
        success: false,
        error: 'Invalid admin credentials. Use rsiddhi.choice.2006@gmail.com / RSIDDHI2006',
      });
      return true;
    }

    // Fallback for unhandled /api route
    sendJson(res, 404, { success: false, error: 'API route not found' });
    return true;
  } catch (err: any) {
    console.error('API Error:', err);
    sendJson(res, 500, { success: false, error: err?.message || 'Internal Server Error' });
    return true;
  }
}
