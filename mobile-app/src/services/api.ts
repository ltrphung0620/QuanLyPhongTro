import { API_BASE_URL } from "@/config/env";
import {
  AuthResponse,
  Contract,
  Invoice,
  MeterReading,
  MonthlyExpense,
  MonthlyProfitLoss,
  MonthlyRevenue,
  Room,
  Tenant,
  Transaction,
  TransactionInput,
  UpdateInvoice,
  UserProfile
} from "@/types/api";
import { getActiveOrganizationId, getToken } from "./storage";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean | null | undefined>;
  skipAuth?: boolean;
};

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function readError(response: Response) {
  const text = await response.text();
  if (!text) return `Lỗi ${response.status}`;

  try {
    const json = JSON.parse(text) as { message?: string; title?: string };
    return json.message || json.title || text;
  } catch {
    return text;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.skipAuth ? null : await getToken();
  const activeOrganizationId = await getActiveOrganizationId();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (activeOrganizationId) headers.set("X-Organization-Id", String(activeOrganizationId));

  const response = await fetch(buildUrl(path, options.query), {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  login(email: string, password: string) {
    return apiRequest<AuthResponse>("/Auth/login", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ email, password })
    });
  },
  me() {
    return apiRequest<UserProfile>("/Auth/me");
  },
  changePassword(oldPassword: string, newPassword: string) {
    return apiRequest<{ message: string }>("/Auth/change-password", {
      method: "POST",
      body: JSON.stringify({ oldPassword, newPassword })
    });
  },
  rooms(status?: string | null) {
    return apiRequest<Room[]>("/Rooms", { query: { status } });
  },
  updateRoom(id: number, dto: { roomCode: string; listedPrice: number; status: string }) {
    return apiRequest<Room>(`/Rooms/${id}`, {
      method: "PUT",
      body: JSON.stringify(dto)
    });
  },
  tenants() {
    return apiRequest<Tenant[]>("/Tenants");
  },
  updateTenant(id: number, dto: { fullName: string; phone?: string | null; cccd?: string | null }) {
    return apiRequest<Tenant>(`/Tenants/${id}`, {
      method: "PUT",
      body: JSON.stringify(dto)
    });
  },
  contracts(status?: string | null, includeArchived = false) {
    return apiRequest<Contract[]>("/Contracts", { query: { status, includeArchived } });
  },
  meterReadings(month: string) {
    return apiRequest<MeterReading[]>("/MeterReadings", { query: { month } });
  },
  invoices(month: string, status?: string | null) {
    return apiRequest<Invoice[]>("/Invoices", { query: { month, status } });
  },
  markInvoicePaid(id: number, dto: { amount: number; paymentMethod: string; paymentReference?: string | null; note?: string | null }) {
    return apiRequest<Invoice>(`/Invoices/${id}/mark-paid`, {
      method: "PATCH",
      body: JSON.stringify(dto)
    });
  },
  markInvoiceUnpaid(id: number) {
    return apiRequest<Invoice>(`/Invoices/${id}/mark-unpaid`, {
      method: "PATCH"
    });
  },
  updateInvoice(id: number, dto: UpdateInvoice) {
    return apiRequest<Invoice>(`/Invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(dto)
    });
  },
  deleteInvoice(id: number) {
    return apiRequest<void>(`/Invoices/${id}`, { method: "DELETE" });
  },
  transactions(month: string) {
    return apiRequest<Transaction[]>("/Transactions", { query: { month } });
  },
  createTransaction(dto: TransactionInput) {
    return apiRequest<Transaction>("/Transactions", { method: "POST", body: JSON.stringify(dto) });
  },
  updateTransaction(id: number, dto: TransactionInput) {
    return apiRequest<Transaction>(`/Transactions/${id}`, { method: "PUT", body: JSON.stringify(dto) });
  },
  deleteTransaction(id: number) {
    return apiRequest<void>(`/Transactions/${id}`, { method: "DELETE" });
  },
  monthlyRevenue(month: string) {
    return apiRequest<MonthlyRevenue>("/Reports/monthly-revenue", { query: { month } });
  },
  monthlyExpense(month: string) {
    return apiRequest<MonthlyExpense>("/Reports/monthly-expense", { query: { month } });
  },
  monthlyProfitLoss(month: string) {
    return apiRequest<MonthlyProfitLoss>("/Reports/monthly-profit-loss", { query: { month } });
  }
};
