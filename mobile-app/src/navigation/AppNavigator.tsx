import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { ChangePasswordScreen } from "@/screens/ChangePasswordScreen";
import { ContractsScreen } from "@/screens/ContractsScreen";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { InvoicesScreen } from "@/screens/InvoicesScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { MeterReadingsScreen } from "@/screens/MeterReadingsScreen";
import { ReportsScreen } from "@/screens/ReportsScreen";
import { RoomsScreen } from "@/screens/RoomsScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { TenantsScreen } from "@/screens/TenantsScreen";
import { TransactionsScreen } from "@/screens/TransactionsScreen";

export type AuthStackParamList = {
  Login: undefined;
};

export type AdminTabParamList = {
  Dashboard: undefined;
  Invoices: undefined;
  Transactions: undefined;
  More: undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Rooms: undefined;
  Tenants: undefined;
  Contracts: undefined;
  MeterReadings: undefined;
  Reports: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<AdminTabParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

function BootScreen() {
  return (
    <View style={styles.boot}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.bootText}>Đang tải QLPT...</Text>
    </View>
  );
}

function UnsupportedRoleScreen() {
  const { profile, signOut } = useAuth();
  return (
    <View style={styles.boot}>
      <Text style={styles.unsupportedTitle}>Mobile V1 dành cho Admin</Text>
      <Text style={styles.bootText}>Tài khoản hiện tại: {profile?.role || "Không xác định"}</Text>
      <Text style={styles.link} onPress={signOut}>
        Đăng xuất
      </Text>
    </View>
  );
}

function MoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreHome" component={SettingsScreen} options={{ title: "Khác" }} />
      <MoreStack.Screen name="Rooms" component={RoomsScreen} options={{ title: "Phòng trọ" }} />
      <MoreStack.Screen name="Tenants" component={TenantsScreen} options={{ title: "Khách thuê" }} />
      <MoreStack.Screen name="Contracts" component={ContractsScreen} options={{ title: "Hợp đồng" }} />
      <MoreStack.Screen name="MeterReadings" component={MeterReadingsScreen} options={{ title: "Chỉ số" }} />
      <MoreStack.Screen name="Reports" component={ReportsScreen} options={{ title: "Báo cáo" }} />
    </MoreStack.Navigator>
  );
}

function AdminTabs() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62 + bottomPadding, paddingTop: 7, paddingBottom: bottomPadding },
        tabBarItemStyle: { paddingBottom: 3 },
        tabBarIconStyle: { marginTop: -2 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: -2 }
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Tổng quan", tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Invoices" component={InvoicesScreen} options={{ title: "Hóa đơn", tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ title: "Thu chi tháng", tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal-outline" color={color} size={size} /> }} />
      <Tab.Screen name="More" component={MoreStackNavigator} options={{ title: "Khác", tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { token, profile, isBootstrapping } = useAuth();

  if (isBootstrapping) return <BootScreen />;

  return (
    <NavigationContainer>
      {!token ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
      ) : profile?.mustChangePassword ? (
        <ChangePasswordScreen />
      ) : profile?.role === "Admin" || profile?.role === "SuperAdmin" ? (
        <AdminTabs />
      ) : (
        <UnsupportedRoleScreen />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12
  },
  bootText: {
    color: colors.textMuted,
    textAlign: "center"
  },
  unsupportedTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 22
  },
  link: {
    color: colors.primaryDark,
    fontWeight: "900",
    marginTop: 10
  }
});
