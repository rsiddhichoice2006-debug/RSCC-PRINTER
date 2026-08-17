import { AdminStats, CustomerUser, OrderRecord, ShopSettings } from '../types';

export const apiClient = {
  // Fetch Shop Settings & Pricing
  async getSettings(): Promise<ShopSettings> {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to load settings');
    const data = await res.json();
    return data.settings;
  },

  // Update Shop Settings (Admin)
  async updateSettings(settings: Partial<ShopSettings>): Promise<ShopSettings> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    const data = await res.json();
    return data.settings;
  },

  // Customer: Register
  async registerCustomer(payload: {
    name: string;
    mobile: string;
    email?: string;
    address?: string;
    password?: string;
  }): Promise<{ customer: CustomerUser; message: string }> {
    const res = await fetch('/api/customer/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to register account');
    }
    return data;
  },

  // Customer: Login
  async loginCustomer(payload: {
    mobile: string;
    password?: string;
  }): Promise<{ customer: CustomerUser; message: string }> {
    const res = await fetch('/api/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to login');
    }
    return data;
  },

  // Create Order (Authoritative server-side price check)
  async createOrder(payload: any): Promise<OrderRecord> {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create order');
    }
    return data.order;
  },

  // List Orders for Admin / Filter
  async getOrders(params?: { search?: string; status?: string; paymentStatus?: string }): Promise<OrderRecord[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.paymentStatus) query.set('paymentStatus', params.paymentStatus);

    const res = await fetch(`/api/orders?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch orders');
    const data = await res.json();
    return data.orders || [];
  },

  // Track Order
  async trackOrder(orderNumber: string, mobile: string): Promise<OrderRecord> {
    const query = new URLSearchParams({
      orderNumber: orderNumber.trim().toUpperCase(),
      mobile: mobile.trim(),
    });
    const res = await fetch(`/api/orders/track?${query.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Order not found');
    }
    return data.order;
  },

  // Submit Payment Reference and Screenshot with OCR Verification Metadata
  async submitPayment(
    orderId: string,
    payload: {
      paymentReference?: string;
      paymentMethod?: string;
      paymentScreenshot?: string;
      paymentScreenshotTime?: string;
      paymentScreenshotFilename?: string;
      ocrVerifiedUpi?: boolean;
      ocrDetectedUpiId?: string;
      ocrVerifiedTime?: boolean;
      ocrTimeDiffMinutes?: number;
    }
  ): Promise<OrderRecord> {
    const res = await fetch(`/api/orders/${orderId}/submit-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to submit payment');
    }
    return data.order;
  },

  // Customer: Get Past Orders by Mobile
  async getCustomerOrders(mobile: string): Promise<OrderRecord[]> {
    const query = new URLSearchParams({ mobile: mobile.trim() });
    const res = await fetch(`/api/orders/customer-history?${query.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch order history');
    }
    return data.orders || [];
  },

  // Admin: Verify or Reject Payment
  async verifyPayment(orderId: string, verified: boolean, notes?: string): Promise<OrderRecord> {
    const res = await fetch(`/api/orders/${orderId}/verify-payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified, notes }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to verify payment');
    }
    return data.order;
  },

  // Admin: Update Order Status
  async updateOrderStatus(orderId: string, status: OrderRecord['orderStatus'], note?: string): Promise<OrderRecord> {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update order status');
    }
    return data.order;
  },

  // Admin: Add Internal Note
  async addInternalNote(orderId: string, note: string): Promise<OrderRecord> {
    const res = await fetch(`/api/orders/${orderId}/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to add note');
    }
    return data.order;
  },

  // Admin: Get Dashboard Stats
  async getAdminStats(): Promise<{ stats: AdminStats; recentAuditLogs: any[] }> {
    const res = await fetch('/api/admin/stats');
    if (!res.ok) throw new Error('Failed to fetch admin stats');
    return res.json();
  },

  // Admin: Login
  async adminLogin(email: string, password: string): Promise<{ token: string; user: any }> {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Invalid credentials');
    }
    return data;
  },
};
