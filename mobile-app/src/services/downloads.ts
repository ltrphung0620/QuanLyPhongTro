import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { API_BASE_URL } from "@/config/env";
import { getActiveOrganizationId, getToken } from "./storage";

async function downloadFile(path: string, fileName: string) {
  const token = await getToken();
  const activeOrganizationId = await getActiveOrganizationId();
  const target = `${FileSystem.cacheDirectory ?? ""}${fileName}`;
  const headers: Record<string, string> = {};

  if (token) headers.Authorization = `Bearer ${token}`;
  if (activeOrganizationId) headers["X-Organization-Id"] = String(activeOrganizationId);

  const result = await FileSystem.downloadAsync(`${API_BASE_URL}${path}`, target, {
    headers
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Không tải được file (${result.status}).`);
  }

  return result.uri;
}

async function downloadAndShare(path: string, fileName: string) {
  const uri = await downloadFile(path, fileName);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Thiết bị chưa hỗ trợ chia sẻ file.");
  }

  await Sharing.shareAsync(uri);
}

export function shareInvoicePdf(invoiceId: number, fileName: string) {
  return downloadAndShare(`/Invoices/${invoiceId}/pdf`, fileName);
}

export function shareInvoiceImage(invoiceId: number, fileName: string) {
  return downloadAndShare(`/Invoices/${invoiceId}/image`, fileName);
}

export function downloadInvoiceImage(invoiceId: number) {
  return downloadFile(`/Invoices/${invoiceId}/image`, `invoice-preview-${invoiceId}-${Date.now()}.png`);
}

export function shareInvoiceImagesZip(month: string, status?: string | null) {
  const query = new URLSearchParams({ month });
  if (status) query.set("status", status);

  const monthPart = month.slice(0, 7);
  const statusPart = status || "tat-ca";
  return downloadAndShare(
    `/Invoices/images.zip?${query.toString()}`,
    `AnhHoaDon-${monthPart}-${statusPart}.zip`
  );
}
