import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { View, StyleSheet } from "react-native";
import { Card, ListRow, StatCard } from "@/components/Cards";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import { displayMonth, formatMoney, formatMonth, spacing } from "@/theme";

const currentMonth = formatMonth(new Date());

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { profile, activeOrganizationId } = useAuth();
  const revenue = useQuery({ queryKey: ["revenue", currentMonth, activeOrganizationId], queryFn: () => api.monthlyRevenue(currentMonth) });
  const expense = useQuery({ queryKey: ["expense", currentMonth, activeOrganizationId], queryFn: () => api.monthlyExpense(currentMonth) });
  const profit = useQuery({ queryKey: ["profit", currentMonth, activeOrganizationId], queryFn: () => api.monthlyProfitLoss(currentMonth) });
  const rooms = useQuery({ queryKey: ["rooms", activeOrganizationId], queryFn: () => api.rooms() });

  const totalRevenue = Number(revenue.data?.totalRevenue ?? revenue.data?.invoiceRevenue ?? profit.data?.revenue ?? 0);
  const totalExpense = Number(expense.data?.totalExpense ?? profit.data?.expense ?? 0);
  const netProfit = Number(profit.data?.netProfit ?? profit.data?.profit ?? totalRevenue - totalExpense);
  const occupied = rooms.data?.filter((room) => room.status === "occupied").length ?? 0;
  const totalRooms = rooms.data?.length ?? 0;

  const refreshing = revenue.isFetching || expense.isFetching || profit.isFetching || rooms.isFetching;
  const refresh = () => {
    revenue.refetch();
    expense.refetch();
    profit.refetch();
    rooms.refetch();
  };

  return (
    <Screen
      title="Tổng quan"
      subtitle={`${profile?.displayName || "Admin"} • ${displayMonth(currentMonth)}`}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <View style={styles.grid}>
        <StatCard label="Doanh thu" value={formatMoney(totalRevenue)} helper="Hóa đơn và phát sinh" />
        <StatCard label="Chi phí" value={formatMoney(totalExpense)} helper="Thu chi tháng" />
        <StatCard label="Lợi nhuận" value={formatMoney(netProfit)} helper={netProfit >= 0 ? "Dòng tiền dương" : "Đang âm"} />
        <StatCard label="Lấp đầy" value={`${occupied}/${totalRooms}`} helper="Phòng đang thuê" />
      </View>
      <Card>
        <ListRow title="Ghi chỉ số điện nước" subtitle="Nhập chỉ số tháng này" onPress={() => navigation.navigate("More", { screen: "MeterReadings" })} />
        <ListRow title="Hóa đơn" subtitle="Xem, thu tiền, tải PDF/ảnh" onPress={() => navigation.navigate("Invoices")} />
        <ListRow title="Thu chi tháng" subtitle="Theo dõi các khoản phát sinh" onPress={() => navigation.navigate("More", { screen: "Transactions" })} />
        <ListRow title="Báo cáo" subtitle="Doanh thu, chi phí, lợi nhuận" onPress={() => navigation.navigate("More", { screen: "Reports" })} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.md
  }
});
