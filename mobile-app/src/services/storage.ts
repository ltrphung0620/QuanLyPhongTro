import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "qlpt.token";
const ACTIVE_ORG_KEY = "qlpt.activeOrganizationId";

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getActiveOrganizationId() {
  const value = await AsyncStorage.getItem(ACTIVE_ORG_KEY);
  return value ? Number(value) : null;
}

export async function setActiveOrganizationId(id: number | null) {
  if (!id) {
    await AsyncStorage.removeItem(ACTIVE_ORG_KEY);
    return;
  }

  await AsyncStorage.setItem(ACTIVE_ORG_KEY, String(id));
}

export async function clearSessionStorage() {
  await Promise.all([clearToken(), setActiveOrganizationId(null)]);
}
