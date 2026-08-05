import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CHANNEL_ID = "monthly-meter-reading-reminders";
const REMINDER_TYPE = "monthly-meter-reading-reminder";
const MONTHS_TO_SCHEDULE = 24;
const REMINDER_HOUR = 8;

export function configureNotificationPresentation() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false
    })
  });
}

export function getLastDayReminderDate(year: number, month: number) {
  return new Date(year, month + 1, 0, REMINDER_HOUR, 0, 0, 0);
}

async function ensureNotificationPermission() {
  if (Platform.OS === "web") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Nhắc ghi chỉ số điện",
      description: "Thông báo vào ngày cuối tháng để ghi nhận chỉ số điện phòng trọ.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 180, 250]
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    permission = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true
      }
    });
  }

  return permission.granted;
}

export async function syncMonthlyMeterReadingReminders() {
  if (!(await ensureNotificationPermission())) return false;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existingReminderIds = scheduled
    .filter((notification) => notification.content.data?.reminderType === REMINDER_TYPE)
    .map((notification) => notification.identifier);

  await Promise.all(
    existingReminderIds.map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier)
    )
  );

  const now = new Date();
  const scheduledDates: Date[] = [];

  for (let offset = 0; offset < MONTHS_TO_SCHEDULE; offset += 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const reminderDate = getLastDayReminderDate(
      monthStart.getFullYear(),
      monthStart.getMonth()
    );

    if (reminderDate.getTime() > now.getTime()) {
      scheduledDates.push(reminderDate);
    }
  }

  await Promise.all(
    scheduledDates.map((date) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: "Nhắc ghi chỉ số điện",
          body: "Thông báo: Đến hạn ghi nhận chỉ số điện cho phòng trọ",
          sound: "default",
          data: {
            reminderType: REMINDER_TYPE,
            targetScreen: "MeterReadings"
          }
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: CHANNEL_ID
        }
      })
    )
  );

  return true;
}
