import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/Cards";
import { AppInput } from "@/components/FormControls";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { displayMonth, formatMoney, formatMonth } from "@/theme";

export function ReportsScreen() {
  const [month, setMonth] = useState(formatMonth(new Date()));
  const revenue = useQuery({ queryKey: ["report-revenue", month], queryFn: () => api.monthlyRevenue(month) });
  const expense = useQuery({ queryKey: ["report-expense", month], queryFn: () => api.monthlyExpense(month) });
  const profit = useQuery({ queryKey: ["report-profit", month], queryFn: () => api.monthlyProfitLoss(month) });

  const totalRevenue = Number(revenue.data?.totalRevenue ?? revenue.data?.invoiceRevenue ?? profit.data?.revenue ?? 0);
  const totalExpense = Number(expense.data?.totalExpense ?? profit.data?.expense ?? 0);
  const netProfit = Number(profit.data?.netProfit ?? profit.data?.profit ?? totalRevenue - totalExpense);

  const refreshing = revenue.isFetching || expense.isFetching || profit.isFetching;
  const refresh = () => {
    revenue.refetch();
    expense.refetch();
    profit.refetch();
  };

  return (
    <Screen title="Báo cáo" subtitle={`Kỳ ${displayMonth(month)}`} refreshing={refreshing} onRefresh={refresh}>
      <AppInput label="Tháng" value={month} onChangeText={setMonth} autoCapitalize="none" />
      <StatCard label="Doanh thu" value={formatMoney(totalRevenue)} />
      <StatCard label="Chi phí" value={formatMoney(totalExpense)} />
      <StatCard label="Lợi nhuận thuần" value={formatMoney(netProfit)} />
    </Screen>
  );
}
