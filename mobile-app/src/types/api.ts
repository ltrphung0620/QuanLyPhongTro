export type Role = "Admin" | "SuperAdmin" | "Tenant" | string;

export type UserOrganization = {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  hasFullAccess: boolean;
  pagePermissions: string[];
};

export type AuthResponse = {
  token: string;
  email: string;
  userId: number;
};

export type UserProfile = {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: Role;
  organizationId?: number | null;
  tenantId?: number | null;
  mustChangePassword: boolean;
  isActive: boolean;
  lastLoginAt?: string | null;
  hasFullAccess: boolean;
  pagePermissions: string[];
  organizations: UserOrganization[];
  activeOrganization?: UserOrganization | null;
};

export type Room = {
  roomId: number;
  roomCode: string;
  listedPrice: number;
  status: string;
};

export type Tenant = {
  tenantId: number;
  fullName: string;
  phone?: string | null;
  cccd?: string | null;
};

export type Contract = {
  contractId: number;
  roomId: number;
  roomCode?: string | null;
  tenantId: number;
  tenantName?: string | null;
  startDate: string;
  expectedEndDate?: string | null;
  actualEndDate?: string | null;
  depositAmount: number;
  depositPaidAmount: number;
  occupantCount: number;
  actualRoomPrice: number;
  status: string;
  isArchived: boolean;
};

export type MeterReading = {
  meterReadingId: number;
  roomId: number;
  roomCode: string;
  billingMonth: string;
  previousReading: number;
  currentReading: number;
  consumedUnits: number;
  unitPrice: number;
  amount: number;
};

export type Invoice = {
  invoiceId: number;
  roomId: number;
  roomCode?: string | null;
  tenantName?: string | null;
  billingMonth?: string | null;
  roomFee: number;
  electricityFee: number;
  waterFee: number;
  trashFee: number;
  extraFee: number;
  discountAmount: number;
  debtAmount: number;
  depositDebtAmount: number;
  totalAmount: number;
  status: "paid" | "unpaid" | string;
  paymentCode?: string | null;
  paidAt?: string | null;
  extraFeeNote?: string | null;
  note?: string | null;
  previousReading?: number | null;
  currentReading?: number | null;
  consumedUnits?: number | null;
};

export type UpdateInvoice = {
  roomFee: number;
  electricityFee: number;
  waterFee: number;
  trashFee: number;
  extraFee: number;
  discountAmount: number;
  debtAmount: number;
  depositDebtAmount: number;
  extraFeeNote?: string | null;
  note?: string | null;
};

export type Transaction = {
  transactionId: number;
  transactionDirection: "income" | "expense" | string;
  category: string;
  itemName?: string | null;
  amount: number;
  transactionDate: string;
  description?: string | null;
  relatedRoomId?: number | null;
  relatedRoomCode?: string | null;
  relatedInvoiceId?: number | null;
};

export type TransactionInput = {
  transactionDirection: "income" | "expense" | string;
  category: string;
  itemName?: string | null;
  amount: number;
  transactionDate: string;
  description?: string | null;
  relatedRoomId?: number | null;
};

export type MonthlyRevenue = {
  totalRevenue?: number;
  invoiceRevenue?: number;
  extraIncome?: number;
  [key: string]: unknown;
};

export type MonthlyExpense = {
  totalExpense?: number;
  [key: string]: unknown;
};

export type MonthlyProfitLoss = {
  totalRevenue?: number;
  totalExpense?: number;
  profitLoss?: number;
  revenue?: number;
  expense?: number;
  profit?: number;
  netProfit?: number;
  occupancyRate?: number;
  [key: string]: unknown;
};
