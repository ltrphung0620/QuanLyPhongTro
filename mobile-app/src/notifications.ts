import { Alert, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { emitInvoiceCreated } from './events';
import { registerTenantDevice } from './api';
import { savePushToken } from './storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('tenant-invoices', {
      name: 'Hóa đơn',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7f5f55',
    });
  }

  if (!Device.isDevice) {
    return null;
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    return null;
  }

  const projectId =
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.expoConfig?.extra?.projectId;

  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  await savePushToken(token);
  await registerTenantDevice(token, Platform.OS, Device.deviceName ?? Device.modelName ?? undefined);
  return token;
}

export function addNotificationResponseListener() {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    if (data?.type === 'invoice.created') {
      const invoiceId = Number(data.invoiceId);
      emitInvoiceCreated({
        eventName: 'tenant.invoice.created',
        data: {
          type: 'invoice.created',
          invoiceId: Number.isFinite(invoiceId) ? invoiceId : undefined,
          billingMonth: typeof data.billingMonth === 'string' ? data.billingMonth : undefined,
        },
      });

      if (Number.isFinite(invoiceId) && invoiceId > 0) {
        router.push(`/invoice/${invoiceId}`);
      } else {
        router.push('/(tabs)');
      }
    }
  });
}

export function showInvoiceToast(message?: string) {
  Alert.alert('Hóa đơn mới', message || 'Bạn có hóa đơn mới cần thanh toán.');
}
