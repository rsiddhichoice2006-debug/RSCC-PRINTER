import { OrderRecord, ShopSettings } from '../types';
import { formatPickupReadyWhatsAppMessage, generateWhatsAppUrl } from './whatsappService';

export const DEFAULT_MAKE_WEBHOOK_URL = 'https://hook.eu1.make.com/8pf2rw2l0pk9va2ofhqjjsg0cap9kutr';

export interface WebhookOrderPayload {
  event: 'ORDER_CREATED' | 'ORDER_PLACED' | 'PAYMENT_VERIFIED' | 'STATUS_UPDATED' | 'READY_FOR_PICKUP' | 'TEST_PING';
  timestamp: string;
  orderId: string;
  orderNumber: string;
  deliveryPin: string;
  customer: {
    name: string;
    mobile: string;
    email?: string;
  };
  orderDetails: {
    mode: string;
    paperSize?: string;
    paperQuality?: string;
    printType?: string;
    printingSide?: string;
    passportService?: string;
    photoLayout?: string;
    photoOrientation?: string;
    totalPages: number;
    totalSheets?: number;
    copies: number;
    ratePerPage: number;
    totalAmount: number;
  };
  payment: {
    status: string;
    method?: string;
    reference?: string;
    verifiedAt?: string;
  };
  status: {
    orderStatus: string;
    createdAt: string;
    updatedAt: string;
  };
  filesSummary: {
    count: number;
    fileNames: string[];
    totalSizeBytes: number;
  };
  whatsappNotification?: {
    senderPhone: string;
    recipientPhone: string;
    message: string;
    whatsappUrl: string;
  };
  specialInstructions?: string;
  shop: {
    name: string;
    phone: string;
    whatsapp: string;
    whatsAppSenderPhone?: string;
    upiId: string;
  };
}

/**
 * Dispatches an order event to Make.com Webhook endpoint
 */
export async function triggerMakeWebhook(
  order: OrderRecord,
  event: 'ORDER_CREATED' | 'ORDER_PLACED' | 'PAYMENT_VERIFIED' | 'STATUS_UPDATED' | 'READY_FOR_PICKUP' | 'TEST_PING' = 'ORDER_PLACED',
  customWebhookUrl?: string,
  settings?: ShopSettings
): Promise<{ success: boolean; message: string }> {
  const url = (customWebhookUrl || settings?.webhookUrl || DEFAULT_MAKE_WEBHOOK_URL).trim();
  if (!url) {
    return { success: false, message: 'No webhook URL configured' };
  }

  const senderPhone = settings?.whatsAppSenderPhone || settings?.whatsapp || settings?.phone || '8652411690';
  const cleanSender = senderPhone.replace(/\D/g, '').slice(-10) || '8652411690';
  const cleanRecipient = order.customer.mobile.replace(/\D/g, '').slice(-10);

  const formattedMsg = formatPickupReadyWhatsAppMessage(order, settings);
  const waUrl = generateWhatsAppUrl(cleanRecipient, formattedMsg);

  const payload: WebhookOrderPayload = {
    event,
    timestamp: new Date().toISOString(),
    orderId: order.id,
    orderNumber: order.orderNumber,
    deliveryPin: order.deliveryPin,
    customer: {
      name: order.customer.name || 'Customer',
      mobile: order.customer.mobile || '',
      email: order.customer.email,
    },
    orderDetails: {
      mode: order.mode,
      paperSize: order.paperSize,
      paperQuality: order.paperQuality,
      printType: order.printType,
      printingSide: order.printingSide,
      passportService: order.passportService,
      photoLayout: order.photoLayout,
      photoOrientation: order.photoOrientation,
      totalPages: order.totalPages || 1,
      totalSheets: order.totalSheets,
      copies: order.copies || 1,
      ratePerPage: order.ratePerPage || 0,
      totalAmount: order.totalAmount || 0,
    },
    payment: {
      status: order.paymentStatus,
      method: order.paymentMethod,
      reference: order.paymentReference,
      verifiedAt: order.verifiedAt,
    },
    status: {
      orderStatus: order.orderStatus,
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: order.updatedAt || new Date().toISOString(),
    },
    filesSummary: {
      count: order.files?.length || 0,
      fileNames: (order.files || []).map((f) => f.name),
      totalSizeBytes: (order.files || []).reduce((sum, f) => sum + (f.size || 0), 0),
    },
    whatsappNotification: {
      senderPhone: cleanSender,
      recipientPhone: cleanRecipient,
      message: formattedMsg,
      whatsappUrl: waUrl,
    },
    specialInstructions: order.specialInstructions,
    shop: {
      name: settings?.shopName || 'Riddhi Siddhi Choice Centre',
      phone: settings?.phone || '+91 8652411690',
      whatsapp: settings?.whatsapp || '8652411690',
      whatsAppSenderPhone: settings?.whatsAppSenderPhone || '8652411690',
      upiId: settings?.upiId || '8652411690@OKBIZAXIS',
    },
  };

  try {
    // Try standard POST with Content-Type JSON
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { success: true, message: `Webhook delivered successfully (${response.status})` };
    } else {
      const text = await response.text().catch(() => '');
      return { success: true, message: `Webhook reached Make.com (HTTP ${response.status}: ${text || 'Accepted'})` };
    }
  } catch (err: any) {
    console.warn('Standard Webhook POST error, falling back to no-cors mode:', err);
    try {
      // In browser contexts, Make.com webhook endpoints might not send CORS headers for OPTIONS requests.
      // fetch with mode 'no-cors' allows the POST payload to be delivered directly to Make.com!
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(payload),
      });
      return { success: true, message: 'Webhook sent to Make.com via direct delivery' };
    } catch (fallbackErr: any) {
      console.error('Make Webhook error:', fallbackErr);
      return { success: false, message: fallbackErr.message || 'Failed to dispatch webhook' };
    }
  }
}
