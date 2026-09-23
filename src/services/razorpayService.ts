/**
 * Razorpay Standard Web Checkout Integration Service
 * Secure client-side orchestration for Razorpay Checkout Modal
 */

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface RazorpayOrderResponse {
  success: boolean;
  order_id: string;
  amount: number;
  currency: string;
  receipt?: string;
  key_id?: string;
  error?: string;
}

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutOptions {
  amount: number; // in Rupees (e.g., 25.50)
  currency?: string;
  receipt?: string;
  name?: string;
  description?: string;
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
  notes?: Record<string, string>;
  orderId?: string; // App order ID (e.g. ord-12345)
  onSuccess: (paymentResult: RazorpayPaymentSuccessResponse, verifyData: any) => void;
  onError: (error: { code?: string; description?: string; reason?: string }) => void;
  onDismiss?: () => void;
}

/**
 * Ensures checkout.js is loaded dynamically if not present
 */
export async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.Razorpay) return true;

  return new Promise((resolve) => {
    const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      if (window.Razorpay) return resolve(true);
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * 1. Calls backend /api/create-order to create an order on Razorpay
 */
export async function createRazorpayOrder(params: {
  amountInPaise: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrderResponse> {
  const res = await fetch('/api/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Math.round(params.amountInPaise),
      currency: params.currency || 'INR',
      receipt: params.receipt,
      notes: params.notes,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create Razorpay order');
  }
  return data;
}

/**
 * 2. Calls backend /api/verify-payment to verify Razorpay signature
 */
export async function verifyRazorpayPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  orderId?: string;
  orderData?: any;
}): Promise<{ success: boolean; message?: string; payment_id?: string; order?: any }> {
  const res = await fetch('/api/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Payment signature verification failed');
  }
  return data;
}

/**
 * 3. Launches the Razorpay Standard Checkout Modal
 */
export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !window.Razorpay) {
    throw new Error('Could not load Razorpay Checkout SDK. Please check your internet connection.');
  }

  // Minimum amount is ₹1.00 (100 paise)
  const amountInPaise = Math.max(100, Math.round(options.amount * 100));

  // Step 1: Create Order on Backend
  const orderRes = await createRazorpayOrder({
    amountInPaise,
    currency: options.currency || 'INR',
    receipt: options.receipt || `order_${Date.now()}`,
    notes: {
      ...options.notes,
      orderId: options.orderId || '',
      customerName: options.customerName || '',
    },
  });

  // Client Key ID priority: from backend response, or Vite client env, or fallback
  const keyId =
    orderRes.key_id ||
    (import.meta as any).env?.VITE_RAZORPAY_KEY_ID ||
    'rzp_test_TfQk4RHXy0ikDN';

  const checkoutConfig = {
    key: keyId,
    amount: orderRes.amount,
    currency: orderRes.currency,
    name: options.name || 'Riddhi Siddhi Choice Centre (RSCC)',
    description: options.description || `Print Order Payment - ₹${options.amount.toFixed(2)}`,
    order_id: orderRes.order_id,
    prefill: {
      name: options.customerName || '',
      email: options.customerEmail || '',
      contact: options.customerMobile || '',
    },
    theme: {
      color: '#059669', // Emerald-600 to match RSCC branding
    },
    modal: {
      ondismiss: () => {
        if (options.onDismiss) {
          options.onDismiss();
        }
      },
      escape: true,
      backdropclose: false,
    },
    handler: async (response: RazorpayPaymentSuccessResponse) => {
      try {
        // Step 2: Verify payment on backend
        const verifyData = await verifyRazorpayPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          orderId: options.orderId,
          orderData: options.notes,
        });

        options.onSuccess(response, verifyData);
      } catch (err: any) {
        options.onError({
          description: err?.message || 'Payment verification failed on server.',
        });
      }
    },
  };

  const rzpInstance = new window.Razorpay(checkoutConfig);

  rzpInstance.on('payment.failed', (resp: any) => {
    console.error('Razorpay payment failed:', resp?.error);
    options.onError({
      code: resp?.error?.code,
      description: resp?.error?.description || 'Payment was unsuccessful or declined by your bank/UPI.',
      reason: resp?.error?.reason,
    });
  });

  rzpInstance.open();
}
