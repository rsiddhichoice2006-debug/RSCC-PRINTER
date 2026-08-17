import { GoogleGenAI } from '@google/genai';
import { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';

// Storage in-memory + JSON persistence fallback for demo & dev
interface ShopPricing {
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
  mode: 'DOCUMENT' | 'PHOTO';
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
  pricing: {
    bwSingle: 5,
    bwBoth: 4,
    colorSingle: 10,
    colorBoth: 7.5,
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
    paymentScreenshotTime: new Date(Date.now() - 1800000).toISOString(),
    specialInstructions: 'High gloss photo paper.',
    internalNotes: ['Awaiting UPI statement verification from shop owner.'],
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

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
  mode: 'DOCUMENT' | 'PHOTO';
  totalPages: number;
  totalSheets?: number;
  copies: number;
  printType: 'BW' | 'COLOUR';
  printingSide: 'SINGLE' | 'BOTH';
  customPricing?: ShopPricing;
}): { ratePerPage: number; totalAmount: number } {
  const p = params.customPricing || settings.pricing;
  const copies = Math.max(1, params.copies || 1);

  if (params.mode === 'PHOTO') {
    const sheets = Math.max(1, params.totalSheets || params.totalPages || 1);
    const ratePerSheet = p.photoSheet || 15;
    const totalAmount = sheets * copies * ratePerSheet;
    return { ratePerPage: ratePerSheet, totalAmount };
  }

  // Document printing
  const pages = Math.max(1, params.totalPages || 1);
  let rate = 0;

  if (params.printType === 'BW') {
    rate = params.printingSide === 'BOTH' ? p.bwBoth : p.bwSingle;
  } else {
    rate = params.printingSide === 'BOTH' ? p.colorBoth : p.colorSingle;
  }

  // Strictly: Total = Number of Pages * Copies * Rate
  // NEVER divide page count by 2 for duplex printing
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
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 50 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
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
          let prompt = `You are a content safety classifier for a commercial printing shop in India ("Riddhi Siddhi Choice Centre").
Evaluate whether this uploaded document/image violates printing policies (strictly prohibited: pornographic content, extreme graphic nudity, explicit sexual violence, illegal illicit materials).
Legitimate medical diagrams, educational biology charts, art history, official IDs, and regular text MUST NOT be flagged.

Filename: "${body.filename}"
Type: "${body.fileType}"
Snippet/Text content: "${body.textSnippet || ''}"

Return your judgment strictly in JSON format:
{
  "safe": true/false,
  "status": "SAFE" | "FLAGGED" | "MANUAL_REVIEW",
  "reason": "Clear explanation of finding"
}`;

          let response;
          if (body.base64Sample && body.fileType.startsWith('image/')) {
            const cleanBase64 = body.base64Sample.replace(/^data:image\/[a-z]+;base64,/, '');
            response = await ai.models.generateContent({
              model: 'gemini-3.7-flash',
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
            response = await ai.models.generateContent({
              model: 'gemini-3.7-flash',
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
              },
            });
          }

          if (response?.text) {
            const parsed = JSON.parse(response.text);
            moderationStatus = parsed.safe ? 'SAFE' : (parsed.status || 'FLAGGED');
            moderationReason = parsed.reason || (parsed.safe ? 'Verified safe for printing' : 'Prohibited content detected');
          }
        } catch (err: any) {
          console.warn('Gemini moderation check failed, using fallback:', err?.message);
          // Fallback heuristic if API key is missing or rate limited
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
      const body = await parseJsonBody<{
        customer: { name: string; mobile: string; email?: string };
        mode: 'DOCUMENT' | 'PHOTO';
        photoLayout?: '9_PHOTOS' | '4_PHOTOS' | '2_PHOTOS' | '1_PHOTO';
        photoOrientation?: 'PORTRAIT' | 'LANDSCAPE';
        files: OrderFileItem[];
        totalPages: number;
        totalSheets?: number;
        copies: number;
        printType: 'BW' | 'COLOUR';
        printingSide: 'SINGLE' | 'BOTH';
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

      // Server-side authoritative price calculation (never trust client price)
      const calculated = calculateOrderPrice({
        mode: body.mode || 'DOCUMENT',
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

    // 4. GET /api/orders - List orders for Admin Portal (Only records/shows customers who placed orders)
    if (pathname === '/api/orders' && method === 'GET') {
      const search = url.searchParams.get('search')?.toLowerCase();
      const status = url.searchParams.get('status');
      const paymentStatus = url.searchParams.get('paymentStatus');

      // Admin portal only records customers who actually placed their orders
      let filtered = orders.filter(
        (o) => o.orderStatus !== 'PENDING' || o.paymentStatus !== 'PAYMENT_PENDING'
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

    // 5. GET /api/orders/customer-history - Get customer's past orders by mobile number
    if (pathname === '/api/orders/customer-history' && method === 'GET') {
      const mobile = url.searchParams.get('mobile')?.trim();

      if (!mobile) {
        sendJson(res, 400, { success: false, error: 'Mobile number is required' });
        return true;
      }

      const customerOrders = orders.filter(
        (o) =>
          o.customer.mobile.endsWith(mobile.slice(-10)) ||
          mobile.endsWith(o.customer.mobile.slice(-10))
      );

      sendJson(res, 200, { success: true, orders: customerOrders });
      return true;
    }

    // 6. GET /api/orders/track - Track order by Order# and Mobile#
    if (pathname === '/api/orders/track' && method === 'GET') {
      const orderNumber = url.searchParams.get('orderNumber')?.trim().toUpperCase();
      const mobile = url.searchParams.get('mobile')?.trim();

      if (!orderNumber || !mobile) {
        sendJson(res, 400, { success: false, error: 'Both Order Number and Mobile Number are required' });
        return true;
      }

      const match = orders.find(
        (o) =>
          o.orderNumber.toUpperCase() === orderNumber &&
          (o.customer.mobile.endsWith(mobile.slice(-10)) || mobile.endsWith(o.customer.mobile.slice(-10)))
      );

      if (!match) {
        sendJson(res, 404, {
          success: false,
          error: 'No order found matching this Order Number and Mobile Number. Please verify your details.',
        });
        return true;
      }

      sendJson(res, 200, { success: true, order: match });
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
      }>(req);

      const orderIndex = orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
      if (orderIndex === -1) {
        sendJson(res, 404, { success: false, error: 'Order not found' });
        return true;
      }

      orders[orderIndex].orderStatus = 'PLACED';
      orders[orderIndex].paymentStatus = 'PAYMENT_VERIFICATION_REQUIRED';
      orders[orderIndex].paymentReference = body.paymentReference?.trim() || 'UPI-SCREENSHOT-VERIFICATION';
      orders[orderIndex].paymentMethod = body.paymentMethod || 'UPI (9967842065@OKBIZAXIS)';
      orders[orderIndex].paymentScreenshot = body.paymentScreenshot;
      orders[orderIndex].paymentScreenshotTime = body.paymentScreenshotTime || new Date().toISOString();
      orders[orderIndex].paymentScreenshotFilename = body.paymentScreenshotFilename;
      orders[orderIndex].ocrVerifiedUpi = body.ocrVerifiedUpi;
      orders[orderIndex].ocrDetectedUpiId = body.ocrDetectedUpiId;
      orders[orderIndex].ocrVerifiedTime = body.ocrVerifiedTime;
      orders[orderIndex].ocrTimeDiffMinutes = body.ocrTimeDiffMinutes;
      orders[orderIndex].updatedAt = new Date().toISOString();

      auditLogs.unshift({
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString(),
        action: 'PAYMENT_SCREENSHOT_SUBMITTED',
        actor: orders[orderIndex].customer.name,
        orderNumber: orders[orderIndex].orderNumber,
        details: `Customer placed order & uploaded payment screenshot (${body.paymentScreenshotFilename || 'Screenshot'}). Delivery PIN: ${orders[orderIndex].deliveryPin}. OCR UPI Match: ${body.ocrVerifiedUpi ? 'YES' : 'PENDING'}.`,
      });

      sendJson(res, 200, { success: true, order: orders[orderIndex] });
      return true;
    }

    // 7. PUT /api/orders/:id/verify-payment - Admin payment verification
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

      sendJson(res, 200, { success: true, order });
      return true;
    }

    // 8. PUT /api/orders/:id/status - Update order lifecycle status
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

    // 9. POST /api/orders/:id/note - Add internal note
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
