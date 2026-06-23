export type UserProfile = {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: 'SuperAdmin' | 'Admin' | 'Tenant' | string;
  organizationId?: number | null;
  tenantId?: number | null;
  mustChangePassword: boolean;
  isActive: boolean;
  lastLoginAt?: string | null;
};

export type LoginResponse = {
  token: string;
  email: string;
  userId: number;
};

export type Invoice = {
  invoiceId: number;
  roomId: number;
  roomCode?: string | null;
  contractId?: number | null;
  invoiceType: string;
  billingMonth?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  roomFee: number;
  electricityFee: number;
  previousReading?: number | null;
  currentReading?: number | null;
  consumedUnits?: number | null;
  meterImagePath?: string | null;
  waterFee: number;
  trashFee: number;
  extraFee: number;
  discountAmount: number;
  debtAmount: number;
  depositDebtAmount: number;
  totalAmount: number;
  status: 'paid' | 'unpaid' | string;
  paymentCode?: string | null;
  paidAt?: string | null;
  paidAmount?: number | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  extraFeeNote?: string | null;
  note?: string | null;
  createdAt: string;
};

export type MeterReading = {
  meterReadingId: number;
  roomId: number;
  roomCode?: string | null;
  contractId?: number | null;
  billingMonth: string;
  previousReading: number;
  currentReading: number;
  consumedUnits: number;
  unitPrice: number;
  amount: number;
  meterImagePath?: string | null;
  createdAt: string;
  readingDate?: string | null;
};

export type RealtimeEvent = {
  eventName: string;
  data?: {
    type?: string;
    invoiceId?: number;
    billingMonth?: string;
    message?: string;
    [key: string]: unknown;
  };
};
