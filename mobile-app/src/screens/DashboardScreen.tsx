import React, { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { View, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatCard } from "@/components/Cards";
import { MonthYearPicker } from "@/components/MonthYearPicker";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import { colors, displayMonth, formatMoney, formatMonth, radius, shadow, spacing } from "@/theme";

function getRecentMonths(selectedMonth: string) {
  const [year, month] = selectedMonth.split("-").map(Number);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, month - 1 - (5 - index), 1);
    return formatMonth(date);
  });
}

function compactMoney(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (absolute >= 1_000) return `${Math.round(value / 1_000)}k`;
  return Math.round(value).toLocaleString("vi-VN");
}

export function DashboardScreen() {
  const [month, setMonth] = useState(formatMonth(new Date()));
  const { profile, activeOrganizationId } = useAuth();
  const revenue = useQuery({ queryKey: ["revenue", month, activeOrganizationId], queryFn: () => api.monthlyRevenue(month) });
  const expense = useQuery({ queryKey: ["expense", month, activeOrganizationId], queryFn: () => api.monthlyExpense(month) });
  const profit = useQuery({ queryKey: ["profit", month, activeOrganizationId], queryFn: () => api.monthlyProfitLoss(month) });
  const chartMonths = getRecentMonths(month);
  const cashFlowQueries = useQueries({
    queries: chartMonths.map((chartMonth) => ({
      queryKey: ["cash-flow", chartMonth, activeOrganizationId],
      queryFn: () => api.monthlyProfitLoss(chartMonth)
    }))
  });

  const totalRevenue = Number(revenue.data?.totalRevenue ?? revenue.data?.invoiceRevenue ?? profit.data?.revenue ?? 0);
  const totalExpense = Number(expense.data?.totalExpense ?? profit.data?.expense ?? 0);
  const netProfit = Number(profit.data?.profitLoss ?? profit.data?.netProfit ?? profit.data?.profit ?? totalRevenue - totalExpense);
  const activeOrganization = profile?.organizations?.find((item) => item.id === activeOrganizationId) ?? profile?.activeOrganization;
  const organizationIdentity = `${activeOrganization?.name ?? ""} ${activeOrganization?.code ?? ""}`.toLowerCase();
  const isNhaTro110 = organizationIdentity.includes("110");
  const splitProfitAmount = netProfit / 2;
  const cashFlowData = chartMonths.map((chartMonth, index) => {
    const data = cashFlowQueries[index]?.data;
    const revenueValue = Number(data?.totalRevenue ?? data?.revenue ?? 0);
    const expenseValue = Number(data?.totalExpense ?? data?.expense ?? 0);
    return {
      month: chartMonth,
      revenue: revenueValue,
      expense: expenseValue,
      net: Number(data?.profitLoss ?? data?.netProfit ?? data?.profit ?? revenueValue - expenseValue)
    };
  });
  const chartMax = Math.max(1, ...cashFlowData.flatMap((item) => [item.revenue, item.expense]));

  const refreshing = revenue.isFetching || expense.isFetching || profit.isFetching || cashFlowQueries.some((query) => query.isFetching);
  const refresh = () => {
    revenue.refetch();
    expense.refetch();
    profit.refetch();
    cashFlowQueries.forEach((query) => query.refetch());
  };

  return (
    <Screen
      title="Tổng quan"
      subtitle={`Báo cáo hoạt động kinh doanh tháng ${displayMonth(month)}`}
      organizationName={activeOrganization?.name}
      profileName={profile?.displayName || profile?.username}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <MonthYearPicker value={month} onChange={setMonth} />
      <Text style={styles.sectionLabel}>TỔNG QUAN THÁNG</Text>
      <View style={styles.grid}>
        <StatCard label="Doanh thu thực thu" value={formatMoney(totalRevenue)} helper="Hóa đơn, tiền cọc và phát sinh" />
        <StatCard label="Chi phí phát sinh" value={formatMoney(totalExpense)} helper="Chi phí quản lý" />
        {isNhaTro110 ? (
          <View style={styles.profitSplitCard}>
            <View style={styles.profitSplitHeader}>
              <Text style={styles.profitSplitTitle}>LỢI NHUẬN THUẦN</Text>
              <View style={[styles.profitSplitIcon, netProfit < 0 && styles.profitSplitIconNegative]}>
                <Ionicons name="logo-usd" size={20} color={netProfit < 0 ? colors.danger : colors.accent} />
              </View>
            </View>
            <View style={styles.profitSplitRows}>
              <View style={styles.profitSplitRow}>
                <Text style={styles.profitSplitLabel}>Gđ Nam-Loan</Text>
                <Text style={styles.profitSplitValue}>{formatMoney(splitProfitAmount)}</Text>
              </View>
              <View style={[styles.profitSplitRow, styles.profitSplitLastRow]}>
                <Text style={styles.profitSplitLabel}>Ông bà</Text>
                <Text style={styles.profitSplitValue}>{formatMoney(splitProfitAmount)}</Text>
              </View>
            </View>
          </View>
        ) : (
          <StatCard label="Lợi nhuận thuần" value={formatMoney(netProfit)} helper={netProfit >= 0 ? "Dòng tiền dương" : "Đang âm"} />
        )}
      </View>
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.chartTitle}>Dòng tiền 6 tháng</Text>
            <Text style={styles.chartSubtitle}>Doanh thu và chi phí thực tế</Text>
          </View>
          <Text style={[styles.currentNet, netProfit < 0 && { color: colors.danger }]}>{netProfit >= 0 ? "+" : ""}{compactMoney(netProfit)}</Text>
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.accent }]} /><Text style={styles.legendText}>Doanh thu</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.danger }]} /><Text style={styles.legendText}>Chi phí</Text></View>
        </View>
        <View style={styles.chart}>
          {cashFlowData.map((item) => (
            <View key={item.month} style={styles.chartGroup}>
              <View style={styles.valueArea}>
                <View style={styles.barPair}>
                  <View style={[styles.bar, styles.revenueBar, { height: Math.max(item.revenue > 0 ? 4 : 0, (item.revenue / chartMax) * 132) }]} />
                  <View style={[styles.bar, styles.expenseBar, { height: Math.max(item.expense > 0 ? 4 : 0, (item.expense / chartMax) * 132) }]} />
                </View>
              </View>
              <Text style={styles.monthLabel}>{item.month.slice(5, 7)}</Text>
              <Text style={[styles.netLabel, item.net < 0 && { color: colors.danger }]}>{compactMoney(item.net)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.chartNote}>Số dưới tháng là lợi nhuận ròng</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
    marginTop: spacing.sm
  },
  profitSplitCard: {
    width: "100%",
    minHeight: 170,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow
  },
  profitSplitHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  profitSplitTitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800"
  },
  profitSplitIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef6f3"
  },
  profitSplitIconNegative: {
    backgroundColor: "#fbf1f0"
  },
  profitSplitRows: {
    gap: spacing.md
  },
  profitSplitRow: {
    minHeight: 40,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  profitSplitLastRow: {
    minHeight: 24,
    paddingBottom: 0,
    borderBottomWidth: 0
  },
  profitSplitLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "800"
  },
  profitSplitValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  chartCard: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface },
  chartHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  chartTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  chartSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  currentNet: { color: colors.accent, fontSize: 16, fontWeight: "900" },
  legend: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 2 },
  legendText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  chart: { height: 190, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: spacing.md, paddingTop: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  chartGroup: { flex: 1, alignItems: "center" },
  valueArea: { height: 136, justifyContent: "flex-end" },
  barPair: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar: { width: 10, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  revenueBar: { backgroundColor: colors.accent },
  expenseBar: { backgroundColor: colors.danger },
  monthLabel: { color: colors.text, fontSize: 11, fontWeight: "900", marginTop: 5 },
  netLabel: { color: colors.accent, fontSize: 9, fontWeight: "800", marginTop: 2 },
  chartNote: { color: colors.textMuted, fontSize: 10, textAlign: "center", marginTop: spacing.sm }
});
