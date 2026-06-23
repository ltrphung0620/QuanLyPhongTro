import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  extra?.apiBaseUrl ||
  ''
).replace(/\/$/, '');

export const VIETQR_BANK_CODE = process.env.EXPO_PUBLIC_VIETQR_BANK_CODE || extra?.vietQrBankCode || 'mbbank';
export const VIETQR_ACCOUNT_NO = process.env.EXPO_PUBLIC_VIETQR_ACCOUNT_NO || extra?.vietQrAccountNo || '556062006';
export const VIETQR_ACCOUNT_NAME = process.env.EXPO_PUBLIC_VIETQR_ACCOUNT_NAME || extra?.vietQrAccountName || 'LaiTrinhPhuocHung';

export function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error('Chưa cấu hình EXPO_PUBLIC_API_BASE_URL cho mobile app.');
  }

  return API_BASE_URL;
}
