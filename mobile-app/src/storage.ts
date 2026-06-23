import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'tenant_jwt';
const PUSH_TOKEN_KEY = 'tenant_expo_push_token';

async function getItem(key: string) {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(key) ?? null;
  }

  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function getToken() {
  return getItem(TOKEN_KEY);
}

export async function saveToken(token: string) {
  await setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  await deleteItem(TOKEN_KEY);
}

export async function getSavedPushToken() {
  return getItem(PUSH_TOKEN_KEY);
}

export async function savePushToken(token: string) {
  await setItem(PUSH_TOKEN_KEY, token);
}

export async function clearSavedPushToken() {
  await deleteItem(PUSH_TOKEN_KEY);
}
