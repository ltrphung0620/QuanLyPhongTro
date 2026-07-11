import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, EmptyState } from "@/components/Cards";
import { AppInput, PillButton, PrimaryButton } from "@/components/FormControls";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { shareInvoiceImage, shareInvoicePdf } from "@/services/downloads";
import { displayMonth, formatMoney, formatMonth, colors, spacing } from "@/theme";
import { Invoice } from "@/types/api";

function invoiceTitle(invoice: Invoice) {
  return `${invoice.roomCode || `Phòng #${invoice.roomId}`} • ${invoice.tenantName || "Chưa rõ khách"}`;
}

export function InvoicesScreen() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(formatMonth(new Date()));
  const [status, setStatus] = useState<string | null>(null);
  const invoices = useQuery({ queryKey: ["invoices", month, status], queryFn: () => api.invoices(month, status) });
  const markPaid = useMutation({
    mutationFn: (id: number) => api.markInvoicePaid(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] })
  });
  const markUnpaid = useMutation({
    mutationFn: (id: number) => api.markInvoiceUnpaid(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] })
  });

  const totalThisMonth = useMemo(
    () =>
      (invoices.data ?? []).reduce(
        (sum, invoice) => sum + invoice.roomFee + invoice.electricityFee + invoice.waterFee + invoice.trashFee + invoice.extraFee - invoice.discountAmount,
        0
      ),
    [invoices.data]
  );

  const confirmPaid = (invoice: Invoice) => {
    Alert.alert("Thu tiền hóa đơn", `Xác nhận thu ${formatMoney(invoice.totalAmount)} cho ${invoiceTitle(invoice)}?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Thu tiền",
        onPress: () => markPaid.mutate(invoice.invoiceId)
      }
    ]);
  };

  const confirmUnpaid = (invoice: Invoice) => {
    Alert.alert("Hủy thu", `Chuyển hóa đơn ${invoiceTitle(invoice)} về chưa thu?`, [
      { text: "Không", style: "cancel" },
      {
        text: "Hủy thu",
        style: "destructive",
        onPress: () => markUnpaid.mutate(invoice.invoiceId)
      }
    ]);
  };

  const sharePdf = async (invoice: Invoice) => {
    try {
      await shareInvoicePdf(invoice.invoiceId, `HoaDon-${invoice.roomCode || invoice.invoiceId}.pdf`);
    } catch (error) {
      Alert.alert("Không tải được PDF", error instanceof Error ? error.message : "Vui lòng thử lại.");
    }
  };

  const shareImage = async (invoice: Invoice) => {
    try {
      await shareInvoiceImage(invoice.invoiceId, `HoaDon-${invoice.roomCode || invoice.invoiceId}.png`);
    } catch (error) {
      Alert.alert("Không tải được ảnh", error instanceof Error ? error.message : "Vui lòng thử lại.");
    }
  };

  return (
    <Screen title="Hóa đơn" subtitle={`Kỳ ${displayMonth(month)}`} loading={invoices.isLoading} refreshing={invoices.isFetching} onRefresh={invoices.refetch}>
      <AppInput label="Tháng" value={month} onChangeText={setMonth} autoCapitalize="none" />
      <View style={styles.filters}>
        <PillButton title="Tất cả" active={!status} onPress={() => setStatus(null)} />
        <PillButton title="Chưa thu" active={status === "unpaid"} onPress={() => setStatus("unpaid")} />
        <PillButton title="Đã thu" active={status === "paid"} onPress={() => setStatus("paid")} />
      </View>
      <Card>
        <Text style={styles.totalLabel}>Tổng tiền tháng này</Text>
        <Text style={styles.totalValue}>{formatMoney(totalThisMonth)}</Text>
      </Card>
      {(invoices.data ?? []).length === 0 ? (
        <EmptyState text="Chưa có hóa đơn trong kỳ này." />
      ) : (
        invoices.data?.map((invoice) => (
          <Card key={invoice.invoiceId}>
            <View style={styles.invoiceHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.invoiceTitle}>{invoiceTitle(invoice)}</Text>
                <Text style={styles.invoiceMeta}>
                  {invoice.consumedUnits ?? 0} kWh • {invoice.paymentCode || "Chưa có mã"}
                </Text>
              </View>
              <Text style={[styles.status, invoice.status === "paid" ? styles.paid : styles.unpaid]}>
                {invoice.status === "paid" ? "Đã thu" : "Chưa thu"}
              </Text>
            </View>
            <View style={styles.moneyRows}>
              <Text>Tiền phòng: {formatMoney(invoice.roomFee)}</Text>
              <Text>Điện: {formatMoney(invoice.electricityFee)}</Text>
              <Text>Nước & DV: {formatMoney(invoice.waterFee + invoice.trashFee)}</Text>
              <Text>Công nợ/giảm giá: {formatMoney(invoice.debtAmount + invoice.depositDebtAmount - invoice.discountAmount)}</Text>
            </View>
            <Text style={styles.invoiceTotal}>{formatMoney(invoice.totalAmount)}</Text>
            <View style={styles.actions}>
              {invoice.status === "paid" ? (
                <PrimaryButton title="Hủy thu" variant="secondary" onPress={() => confirmUnpaid(invoice)} />
              ) : (
                <PrimaryButton title="Thu tiền" onPress={() => confirmPaid(invoice)} />
              )}
              <PrimaryButton title="PDF" variant="secondary" onPress={() => sharePdf(invoice)} />
              <PrimaryButton title="Ảnh" variant="secondary" onPress={() => shareImage(invoice)} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  totalLabel: {
    color: colors.textMuted,
    fontWeight: "800"
  },
  totalValue: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 28,
    marginTop: spacing.xs
  },
  invoiceHeader: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start"
  },
  invoiceTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 18
  },
  invoiceMeta: {
    color: colors.textMuted,
    marginTop: 4
  },
  status: {
    fontWeight: "900",
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: "hidden"
  },
  paid: {
    color: colors.accent,
    backgroundColor: "#eef8f4"
  },
  unpaid: {
    color: colors.warning,
    backgroundColor: "#fff4e7"
  },
  moneyRows: {
    gap: 5,
    marginTop: spacing.md
  },
  invoiceTotal: {
    marginTop: spacing.md,
    fontSize: 24,
    fontWeight: "900",
    color: colors.primaryDark
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  }
});
