import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { colors, radius, spacing } from "@/theme";

const menuItems = [
  { permission: "rooms", route: "Rooms", title: "Quản lý phòng", subtitle: "Danh sách và trạng thái phòng", icon: "home-outline" },
  { permission: "tenants", route: "Tenants", title: "Khách thuê", subtitle: "Thông tin người thuê", icon: "people-outline" },
  { permission: "contracts", route: "Contracts", title: "Hợp đồng", subtitle: "Theo dõi hợp đồng thuê", icon: "document-text-outline" },
  { permission: "meter-readings", route: "MeterReadings", title: "Chỉ số điện nước", subtitle: "Ghi và xem chỉ số theo tháng", icon: "flash-outline" },
  { permission: "reports", route: "Reports", title: "Khai thuế", subtitle: "Doanh thu, chi phí và lợi nhuận", icon: "bar-chart-outline" }
] as const;

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { profile } = useAuth();
  const canAccess = (permission: string) => profile?.role === "SuperAdmin" || profile?.hasFullAccess || profile?.pagePermissions == null || profile.pagePermissions.includes(permission);

  return (
    <Screen title="Khác" subtitle="Danh sách chức năng quản lý">
      <View style={styles.menu}>
        {menuItems.filter((item) => canAccess(item.permission)).map((item) => (
          <Pressable key={item.route} style={({ pressed }) => [styles.item, pressed && { opacity: 0.65 }]} onPress={() => navigation.navigate(item.route)}>
            <View style={styles.icon}><Ionicons name={item.icon} size={22} color={colors.primary} /></View>
            <View style={{ flex: 1 }}><Text style={styles.title}>{item.title}</Text><Text style={styles.subtitle}>{item.subtitle}</Text></View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  menu: { gap: spacing.sm },
  item: { minHeight: 78, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  title: { color: colors.text, fontSize: 16, fontWeight: "900" },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 }
});
