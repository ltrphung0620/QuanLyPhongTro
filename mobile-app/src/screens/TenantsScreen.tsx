import React, { useState } from "react";
import { Alert, Modal } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, EmptyState, ListRow } from "@/components/Cards";
import { AppInput, PrimaryButton } from "@/components/FormControls";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { Tenant } from "@/types/api";

export function TenantsScreen() {
  const queryClient = useQueryClient();
  const tenants = useQuery({ queryKey: ["tenants"], queryFn: api.tenants });
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cccd, setCccd] = useState("");
  const updateTenant = useMutation({
    mutationFn: (tenant: Tenant) =>
      api.updateTenant(tenant.tenantId, {
        fullName,
        phone: phone || null,
        cccd: cccd || null
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tenants"] });
      setEditing(null);
    },
    onError: (error) => Alert.alert("Không lưu được khách thuê", error instanceof Error ? error.message : "Vui lòng thử lại.")
  });

  const openEdit = (tenant: Tenant) => {
    setEditing(tenant);
    setFullName(tenant.fullName);
    setPhone(tenant.phone || "");
    setCccd(tenant.cccd || "");
  };

  return (
    <Screen title="Khách thuê" subtitle="Danh sách khách thuê" loading={tenants.isLoading} refreshing={tenants.isFetching} onRefresh={tenants.refetch}>
      <Card>
        {(tenants.data ?? []).length === 0 ? (
          <EmptyState text="Chưa có khách thuê." />
        ) : (
          tenants.data?.map((tenant) => (
            <ListRow
              key={tenant.tenantId}
              title={tenant.fullName}
              subtitle={[tenant.phone, tenant.cccd].filter(Boolean).join(" • ") || "Chưa có thông tin liên hệ"}
              onPress={() => openEdit(tenant)}
            />
          ))
        )}
      </Card>
      <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(null)}>
        <Screen title="Sửa khách thuê" subtitle={editing?.fullName}>
          <AppInput label="Họ tên" value={fullName} onChangeText={setFullName} />
          <AppInput label="Số điện thoại" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <AppInput label="CCCD" value={cccd} onChangeText={setCccd} keyboardType="number-pad" />
          <PrimaryButton title={updateTenant.isPending ? "Đang lưu..." : "Lưu thay đổi"} disabled={updateTenant.isPending || !editing} onPress={() => editing && updateTenant.mutate(editing)} />
          <PrimaryButton title="Đóng" variant="secondary" onPress={() => setEditing(null)} />
        </Screen>
      </Modal>
    </Screen>
  );
}
