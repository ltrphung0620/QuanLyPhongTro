import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState, ListRow } from "@/components/Cards";
import { MonthYearPicker } from "@/components/MonthYearPicker";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { displayMonth, formatMoney, formatMonth } from "@/theme";

export function MeterReadingsScreen() {
  const [month, setMonth] = useState(formatMonth(new Date()));
  const readings = useQuery({ queryKey: ["meter-readings", month], queryFn: () => api.meterReadings(month) });

  return (
    <Screen title="Chỉ số điện nước" subtitle={`Kỳ ${displayMonth(month)}`} loading={readings.isLoading} refreshing={readings.isFetching} onRefresh={readings.refetch}>
      <MonthYearPicker value={month} onChange={setMonth} />
      <Card>
        {(readings.data ?? []).length === 0 ? (
          <EmptyState text="Chưa có chỉ số trong tháng này." />
        ) : (
          readings.data?.map((reading) => (
            <ListRow
              key={reading.meterReadingId}
              title={reading.roomCode}
              subtitle={`${reading.previousReading} → ${reading.currentReading} • ${reading.consumedUnits} kWh`}
              right={formatMoney(reading.amount)}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
