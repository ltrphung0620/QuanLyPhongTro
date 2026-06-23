import { API_BASE_URL, requireApiBaseUrl } from './config';
import { getToken } from './storage';
import type { Invoice, LoginResponse, MeterReading, UserProfile } from './types';

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
};

let unauthorizedHandler: (() => void | Promise<void>) | null = null;

export function setUnauthorizedHandler(handler: (() => void | Promise<void>) | null) {
  unauthorizedHandler = handler;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = requireApiBaseUrl();
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth) {
    const token = await getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${baseUrl}/api${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    await unauthorizedHandler?.();
    throw new Error('Phiên đăng nhập đã hết hạn.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.message || payload?.title || 'Không thể tải dữ liệu.';
    throw new Error(message);
  }

  return payload as T;
}

export function login(email: string, password: string) {
  return apiRequest<LoginResponse>('/Auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
}

export function getMe() {
  return apiRequest<UserProfile>('/Auth/me');
}

export function changePassword(oldPassword: string, newPassword: string) {
  return apiRequest<{ message: string }>('/Auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export function getTenantInvoices() {
  return apiRequest<Invoice[]>('/tenant/invoices');
}

export function getTenantInvoice(id: number) {
  return apiRequest<Invoice>(`/tenant/invoices/${id}`);
}

export function getTenantMeterReadings() {
  return apiRequest<MeterReading[]>('/tenant/meter-readings');
}

export function registerTenantDevice(expoPushToken: string, platform?: string, deviceName?: string) {
  return apiRequest('/tenant/devices', {
    method: 'POST',
    body: JSON.stringify({ expoPushToken, platform, deviceName }),
  });
}

export function unregisterTenantDevice(expoPushToken: string) {
  return apiRequest('/tenant/devices/unregister', {
    method: 'POST',
    body: JSON.stringify({ expoPushToken }),
  });
}

export function getInvoicePdfUrl(invoiceId: number) {
  if (!API_BASE_URL) {
    return '';
  }

  return `${API_BASE_URL}/api/tenant/invoices/${invoiceId}/pdf`;
}

export function resolveAssetUrl(path?: string | null) {
  if (!path || !API_BASE_URL) {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE_URL}/${path.replace(/^\//, '')}`;
}
