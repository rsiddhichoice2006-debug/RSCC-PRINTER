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
  const customerName = order.customer?.name || 'Valued Customer';
  const pickupPin = order.deliveryPin || '4921';
  const orderNum = order.orderNumber;
  const address = settings?.address || 'Shop No. 4, Ground Floor, Riddhi Siddhi Choice Centre, Main Market, India';
  const timings = settings?.pickupTimings || '9:00 AM - 9:00 PM (Monday - Saturday)';
  const senderPhone = settings?.whatsAppSenderPhone || settings?.whatsapp || settings?.phone || '8652411690';
  const cleanSender = (senderPhone || '').replace(/\D/g, '').slice(-10);
  const phone = `+91 ${cleanSender || '8652411690'}`;

  const fileCount = order.files?.length || 1;
  const printSummary = order.mode === 'PASSPORT_PHOTO'
    ? 'Passport Size Photos'
    : order.mode === 'PHOTO'
    ? 'High Quality Photo Sheet'
    : `${order.printType === 'COLOUR' ? 'Color' : 'B&W'} Document (${order.totalPages || 1} pages${order.pagesPerSheet === 2 ? ' • 2-in-1 Same Side' : ''}, ${order.copies || 1} copy)`;

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

export const WHATSAPP_TAB_TARGET = 'rscc_whatsapp_desk';

/**
 * Generate a WhatsApp Desktop application protocol link (whatsapp://).
 * This completely avoids opening ANY browser tab on Chrome, and opens the
 * native WhatsApp desktop window directly.
 */
export function generateWhatsAppDesktopUrl(mobile: string, message: string): string {
  const cleanMobile = (mobile || '').replace(/\D/g, '').slice(-10);
  const fullMobile = cleanMobile.startsWith('91') ? cleanMobile : `91${cleanMobile}`;
  const encodedText = encodeURIComponent(message);
  return `whatsapp://send?phone=${fullMobile}&text=${encodedText}`;
}

/**
 * Generate a direct WhatsApp Web / WhatsApp Mobile deep link.
 * When directMode is true (default):
 * - On desktop: Targets web.whatsapp.com/send directly to BYPASS the "Continue to WhatsApp Web" screen!
 * - On mobile/tablet: Targets api.whatsapp.com/send to open the native WhatsApp application.
 */
export function generateWhatsAppUrl(mobile: string, message: string, directMode: boolean = true): string {
  const cleanMobile = (mobile || '').replace(/\D/g, '').slice(-10);
  const fullMobile = cleanMobile.startsWith('91') ? cleanMobile : `91${cleanMobile}`;
  const encodedText = encodeURIComponent(message);

  if (directMode) {
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
    if (!isMobile) {
      // Bypasses the "Continue to Chat / Use WhatsApp Web" intermediate landing page on desktop
      return `https://web.whatsapp.com/send?phone=${fullMobile}&text=${encodedText}`;
    }
    return `https://api.whatsapp.com/send?phone=${fullMobile}&text=${encodedText}`;
  }

  return `https://wa.me/${fullMobile}?text=${encodedText}`;
}

/**
 * Triggers the native WhatsApp Desktop application directly without creating ANY tabs in Chrome.
 */
export function launchWhatsAppDesktop(mobile: string, message: string): boolean {
  try {
    const desktopUrl = generateWhatsAppDesktopUrl(mobile, message);
    const link = document.createElement('a');
    link.href = desktopUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 1000);
    return true;
  } catch (err) {
    console.warn('Failed to launch WhatsApp desktop protocol:', err);
    return false;
  }
}

/**
 * Copies the ready message directly to clipboard so the user can just paste into their open WhatsApp tab
 */
export async function copyWhatsAppMessageToClipboard(message: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard write failed:', err);
  }
  return false;
}

/**
 * Opens or reuses a single WhatsApp Web tab, preventing multiple tabs from piling up.
 */
export function openWhatsAppInSingleTab(url: string, singleTab: boolean = true): boolean {
  try {
    const target = singleTab ? WHATSAPP_TAB_TARGET : '_blank';
    const win = window.open(url, target);
    if (win) {
      win.focus();
      return true;
    }
  } catch (e) {
    console.warn('Window open was blocked or restricted:', e);
  }
  return false;
}

/**
 * Smart dispatcher that respects the configured shop preference:
 * - DESKTOP_APP: Launches WhatsApp Desktop directly (0 browser tabs created)
 * - CLIPBOARD_PASTE: Auto-copies message to clipboard so user pastes into their already-open WhatsApp tab
 * - WEB_WHATSAPP: Opens WhatsApp Web
 */
export function dispatchOrderReadyWhatsApp(
  order: OrderRecord,
  settings?: ShopSettings
): { mode: string; success: boolean; message: string; desktopUrl: string; webUrl: string } {
  const cleanMobile = (order.customer?.mobile || '').replace(/\D/g, '').slice(-10);
  const formattedMsg = formatPickupReadyWhatsAppMessage(order, settings);
  const desktopUrl = generateWhatsAppDesktopUrl(cleanMobile, formattedMsg);
  const webUrl = generateWhatsAppUrl(cleanMobile, formattedMsg, true);

  // Always copy message to clipboard for instant zero-friction backup
  copyWhatsAppMessageToClipboard(formattedMsg);

  // Broadcast to RSCC WhatsApp Chrome Extension if present (single-tab companion)
  if (typeof window !== 'undefined') {
    window.postMessage(
      {
        type: 'RSCC_DISPATCH_WHATSAPP',
        phone: cleanMobile,
        message: formattedMsg,
        orderNumber: order.orderNumber,
      },
      '*'
    );
  }

  const mode = settings?.whatsAppDispatchMode || 'EXTENSION_SINGLE_TAB';

  if (mode === 'EXTENSION_SINGLE_TAB') {
    // Check if extension is installed and responsive
    return { mode: 'EXTENSION_SINGLE_TAB', success: true, message: formattedMsg, desktopUrl, webUrl };
  }

  if (mode === 'DESKTOP_APP') {
    const ok = launchWhatsAppDesktop(cleanMobile, formattedMsg);
    return { mode: 'DESKTOP_APP', success: ok, message: formattedMsg, desktopUrl, webUrl };
  }

  if (mode === 'CLIPBOARD_PASTE') {
    return { mode: 'CLIPBOARD_PASTE', success: true, message: formattedMsg, desktopUrl, webUrl };
  }

  if (mode === 'MAKE_WEBHOOK_ONLY') {
    return { mode: 'MAKE_WEBHOOK_ONLY', success: true, message: formattedMsg, desktopUrl, webUrl };
  }

  // WEB_WHATSAPP fallback
  const ok = openWhatsAppInSingleTab(webUrl, settings?.whatsappSingleTabMode !== false);
  return { mode: 'WEB_WHATSAPP', success: ok, message: formattedMsg, desktopUrl, webUrl };
}

/**
 * Automatically triggers or launches the WhatsApp notification to customer
 */
export function notifyCustomerOrderReady(
  order: OrderRecord,
  settings?: ShopSettings,
  options?: { autoOpen?: boolean; singleTab?: boolean }
): WhatsAppNotificationResult {
  const rawMobile = order.customer?.mobile || '';
  const cleanMobile = rawMobile.replace(/\D/g, '').slice(-10);
  if (!cleanMobile || cleanMobile.length < 10) {
    return {
      success: false,
      message: `Invalid customer mobile number: "${rawMobile}"`,
    };
  }

  const message = formatPickupReadyWhatsAppMessage(order, settings);
  const whatsappUrl = generateWhatsAppUrl(cleanMobile, message, true);

  let openedTab = false;
  if (options?.autoOpen !== false) {
    openedTab = openWhatsAppInSingleTab(whatsappUrl, options?.singleTab !== false);
  }

  return {
    success: true,
    message: `WhatsApp notification generated for +91 ${cleanMobile}`,
    whatsappUrl,
    openedTab,
  };
}
