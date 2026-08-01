import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { Card, EmptyState, ListRow } from "@/components/Cards";
import { PillButton } from "@/components/FormControls";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { formatMoney } from "@/theme";

export function ContractsScreen() {
  const [status, setStatus] = useState<string | null>("active");
  const contracts = useQuery({ queryKey: ["contracts", status], queryFn: () => api.contracts(status, false) });

  return (
    <Screen title="Hợp đồng" subtitle="Theo dõi hợp đồng thuê" loading={contracts.isLoading} refreshing={contracts.isFetching} onRefresh={contracts.refetch}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <PillButton title="Đang thuê" active={status === "active"} onPress={() => setStatus("active")} />
        <PillButton title="Đã kết thúc" active={status === "ended"} onPress={() => setStatus("ended")} />
        <PillButton title="Tất cả" active={!status} onPress={() => setStatus(null)} />
      </View>
      <Card>
        {(contracts.data ?? []).length === 0 ? (
          <EmptyState text="Chưa có hợp đồng." />
        ) : (
          contracts.data?.map((contract) => (
            <ListRow
              key={contract.contractId}
              title={`${contract.roomCode || `Phòng #${contract.roomId}`} • ${contract.tenantName || `Khách #${contract.tenantId}`}`}
              subtitle={`Từ ${contract.startDate} • ${contract.occupantCount} người${contract.customWaterFee == null ? "" : ` • Nước riêng ${formatMoney(contract.customWaterFee)}`}`}
              right={formatMoney(contract.actualRoomPrice)}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
