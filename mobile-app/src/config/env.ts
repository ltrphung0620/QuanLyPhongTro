import Constants from "expo-constants";

const extraApiBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (typeof extraApiBaseUrl === "string" ? extraApiBaseUrl : undefined) ||
  "https://qlpt.io.vn:18444/api";

export const APP_NAME = "QLPT";
