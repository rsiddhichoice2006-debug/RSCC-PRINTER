import { OrderRecord, ShopSettings } from '../types';

export interface WhatsAppNotificationResult {
  success: boolean;
  message: string;
  whatsappUrl?: string;
  openedTab?: boolean;
}

/**
 * Format a high-conversion, clear, customer-friendly WhatsApp message
 * for when an order is ready for counter pickup.
 */
export function formatPickupReadyWhatsAppMessage(order: OrderRecord, settings?: ShopSettings): string {
  const shopName = settings?.shopName || 'R.S. Choice Communication (RSCC)';
  const customerName = order.customer.name || 'Valued Customer';
  const pickupPin = order.deliveryPin || '4921';
  const orderNum = order.orderNumber;
  const address = settings?.address || 'Shop No. 4, Ground Floor, Riddhi Siddhi Choice Centre, Main Market, India';
  const timings = settings?.pickupTimings || '9:00 AM - 9:00 PM (Monday - Saturday)';
  const senderPhone = settings?.whatsAppSenderPhone || settings?.whatsapp || settings?.phone || '8652411690';
  const cleanSender = senderPhone.replace(/\D/g, '').slice(-10);
  const phone = `+91 ${cleanSender || '8652411690'}`;

  const fileCount = order.files?.length || 1;
  const printSummary = order.mode === 'PASSPORT_PHOTO'
    ? 'Passport Size Photos'
    : order.mode === 'PHOTO'
    ? 'High Quality Photo Sheet'
    : `${order.printType === 'COLOUR' ? 'Color' : 'B&W'} Document (${order.totalPages} pages, ${order.copies} copy)`;

  return `🎉 *YOUR PRINT ORDER IS READY FOR PICKUP!*

Hello *${customerName}*,

Good news! Your print order has been completed by our counter staff and is now packed and ready for pickup at *${shopName}*.

📋 *Order Details:*
• *Order #:* ${orderNum}
• *Items:* ${printSummary} (${fileCount} file${fileCount > 1 ? 's' : ''})
• *Amount:* ₹${order.totalAmount} (Paid & Verified)

🔐 *COLLECTION / PICKUP PIN:*
*${pickupPin}*
_(Please show this 4-digit PIN at the counter to collect your prints)_

📍 *Counter Location:*
${address}

⏰ *Collection Hours:*
${timings}

📞 *Shop Contact:* ${phone}

Thank you for choosing ${shopName}! Have a great day! 🙏`;
}

/**
 * Generate a direct WhatsApp Web / WhatsApp Mobile deep link
 */
export function generateWhatsAppUrl(mobile: string, message: string): string {
  const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
  const fullMobile = cleanMobile.startsWith('91') ? cleanMobile : `91${cleanMobile}`;
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${fullMobile}?text=${encodedText}`;
}

/**
 * Automatically triggers or launches the WhatsApp notification to customer
 */
export function notifyCustomerOrderReady(
  order: OrderRecord,
  settings?: ShopSettings,
  options?: { autoOpen?: boolean }
): WhatsAppNotificationResult {
  const cleanMobile = order.customer.mobile.replace(/\D/g, '').slice(-10);
  if (!cleanMobile || cleanMobile.length < 10) {
    return {
      success: false,
      message: `Invalid customer mobile number: "${order.customer.mobile}"`,
    };
  }

  const message = formatPickupReadyWhatsAppMessage(order, settings);
  const whatsappUrl = generateWhatsAppUrl(cleanMobile, message);

  let openedTab = false;
  if (options?.autoOpen !== false) {
    try {
      const newWin = window.open(whatsappUrl, '_blank');
      if (newWin) {
        openedTab = true;
      }
    } catch (e) {
      console.warn('Window open was blocked or restricted:', e);
    }
  }

  return {
    success: true,
    message: `WhatsApp notification generated for +91 ${cleanMobile}`,
    whatsappUrl,
    openedTab,
  };
}
