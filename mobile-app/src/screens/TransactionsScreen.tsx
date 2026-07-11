import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState, ListRow, StatCard } from "@/components/Cards";
import { AppInput } from "@/components/FormControls";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { displayMonth, formatMoney, formatMonth } from "@/theme";

export function TransactionsScreen() {
  const [month, setMonth] = useState(formatMonth(new Date()));
  const transactions = useQuery({ queryKey: ["transactions", month], queryFn: () => api.transactions(month) });
  const totals = useMemo(
    () =>
      (transactions.data ?? []).reduce(
        (result, item) => {
          if (item.transactionDirection === "income") result.income += item.amount;
          if (item.transactionDirection === "expense") result.expense += item.amount;
          return result;
        },
        { income: 0, expense: 0 }
      ),
    [transactions.data]
  );

  return (
    <Screen title="Thu chi" subtitle={`Kỳ ${displayMonth(month)}`} loading={transactions.isLoading} refreshing={transactions.isFetching} onRefresh={transactions.refetch}>
      <AppInput label="Tháng" value={month} onChangeText={setMonth} autoCapitalize="none" />
      <StatCard label="Chênh lệch" value={formatMoney(totals.income - totals.expense)} helper={`Thu ${formatMoney(totals.income)} • Chi ${formatMoney(totals.expense)}`} />
      <Card>
        {(transactions.data ?? []).length === 0 ? (
          <EmptyState text="Chưa có giao dịch trong tháng." />
        ) : (
          transactions.data?.map((item) => (
            <ListRow
              key={item.transactionId}
              title={item.itemName || "Giao dịch"}
              subtitle={`${item.transactionDate} • ${item.description || item.category}`}
              right={`${item.transactionDirection === "expense" ? "-" : "+"}${formatMoney(item.amount)}`}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
