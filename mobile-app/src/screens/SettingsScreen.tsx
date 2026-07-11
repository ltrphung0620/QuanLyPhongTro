import React from "react";
import { useNavigation } from "@react-navigation/native";
import { Text, View } from "react-native";
import { Card, ListRow } from "@/components/Cards";
import { PrimaryButton } from "@/components/FormControls";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { colors, spacing } from "@/theme";

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { profile, activeOrganizationId, selectOrganization, signOut } = useAuth();

  return (
    <Screen title="Khác" subtitle={profile?.displayName || profile?.email}>
      <Card>
        <ListRow title="Khách thuê" subtitle="Danh sách và tài khoản khách" onPress={() => navigation.navigate("Tenants")} />
        <ListRow title="Hợp đồng" subtitle="Theo dõi hợp đồng thuê" onPress={() => navigation.navigate("Contracts")} />
        <ListRow title="Chỉ số điện nước" subtitle="Theo kỳ tháng" onPress={() => navigation.navigate("MeterReadings")} />
        <ListRow title="Thu chi tháng" subtitle="Sổ quỹ vận hành" onPress={() => navigation.navigate("Transactions")} />
        <ListRow title="Báo cáo" subtitle="Doanh thu và lợi nhuận" onPress={() => navigation.navigate("Reports")} />
      </Card>
      {profile?.organizations?.length ? (
        <Card>
          <Text style={{ color: colors.text, fontWeight: "900", marginBottom: spacing.sm }}>Tổ chức</Text>
          {profile.organizations.map((organization) => (
            <ListRow
              key={organization.id}
              title={organization.name}
              subtitle={`Mã: ${organization.code}`}
              right={organization.id === activeOrganizationId ? "Đang chọn" : "Chọn"}
              onPress={() => selectOrganization(organization)}
            />
          ))}
        </Card>
      ) : null}
      <View style={{ gap: spacing.sm }}>
        <PrimaryButton title="Đăng xuất" variant="danger" onPress={signOut} />
      </View>
    </Screen>
  );
}
