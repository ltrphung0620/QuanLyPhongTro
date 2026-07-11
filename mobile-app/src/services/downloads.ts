import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { API_BASE_URL } from "@/config/env";
import { getActiveOrganizationId, getToken } from "./storage";

async function downloadAndShare(path: string, fileName: string) {
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

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Thiết bị chưa hỗ trợ chia sẻ file.");
  }

  await Sharing.shareAsync(result.uri);
}

export function shareInvoicePdf(invoiceId: number, fileName: string) {
  return downloadAndShare(`/Invoices/${invoiceId}/pdf`, fileName);
}

export function shareInvoiceImage(invoiceId: number, fileName: string) {
  return downloadAndShare(`/Invoices/${invoiceId}/image`, fileName);
}
