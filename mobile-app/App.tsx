import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import { AppNavigator } from "@/navigation/AppNavigator";
import {
  configureNotificationPresentation,
  syncMonthlyMeterReadingReminders
} from "@/services/monthlyMeterReadingReminder";

configureNotificationPresentation();

function MonthlyMeterReadingReminderBootstrap() {
  const { profile, isBootstrapping } = useAuth();

  useEffect(() => {
    if (isBootstrapping || (profile?.role !== "Admin" && profile?.role !== "SuperAdmin")) {
      return;
    }

    syncMonthlyMeterReadingReminders().catch((error) => {
      console.warn("Không thể lên lịch nhắc ghi chỉ số điện.", error);
    });
  }, [isBootstrapping, profile?.id, profile?.role]);

  return null;
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider queryClient={queryClient}>
          <MonthlyMeterReadingReminderBootstrap />
          <AppNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
