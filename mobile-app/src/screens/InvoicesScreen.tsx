import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, EmptyState } from "@/components/Cards";
import { AppInput, PillButton, PrimaryButton } from "@/components/FormControls";
import { MonthYearPicker } from "@/components/MonthYearPicker";
import { InvoiceEditModal } from "@/components/InvoiceEditModal";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { downloadInvoiceImage } from "@/services/downloads";
import { displayMonth, formatMoney, formatMonth, colors, spacing } from "@/theme";
import { Invoice, UpdateInvoice } from "@/types/api";

function invoiceTitle(invoice: Invoice) {
  return `${invoice.roomCode || `Phòng #${invoice.roomId}`} • ${invoice.tenantName || "Chưa rõ khách"}`;
}

function InvoiceAction({ label, icon, danger, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.actionButton, danger && styles.actionButtonDanger, pressed && { opacity: 0.65 }]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.primaryDark} />
      <Text style={[styles.actionButtonText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

export function InvoicesScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(formatMonth(new Date()));
  const [status, setStatus] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Invoice | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [imageTarget, setImageTarget] = useState<Invoice | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const invoices = useQuery({ queryKey: ["invoices", month, status], queryFn: () => api.invoices(month, status) });
  const markPaid = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      api.markInvoicePaid(id, { amount, paymentMethod: "Tiền mặt", paymentReference: null, note: null }),
    onSuccess: async () => {
      setPayTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error) => setPayError(error instanceof Error ? error.message : "Không thể ghi nhận thanh toán.")
  });
  const markUnpaid = useMutation({
    mutationFn: (id: number) => api.markInvoiceUnpaid(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] })
  });
  const updateInvoice = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateInvoice }) => api.updateInvoice(id, dto),
    onSuccess: async () => {
      setEditTarget(null);
      setEditError(null);
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error) => setEditError(error instanceof Error ? error.message : "Không thể chỉnh sửa hóa đơn.")
  });
  const deleteInvoice = useMutation({
    mutationFn: (id: number) => api.deleteInvoice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
    onError: (error) => Alert.alert("Không thể xóa hóa đơn", error instanceof Error ? error.message : "Vui lòng thử lại.")
  });

  const totalThisMonth = useMemo(
    () =>
      (invoices.data ?? []).reduce(
        (sum, invoice) => sum + invoice.roomFee + invoice.electricityFee + invoice.waterFee + invoice.trashFee + invoice.extraFee - invoice.discountAmount,
        0
      ),
    [invoices.data]
  );

  const openPayModal = (invoice: Invoice) => {
    setPayTarget(invoice);
    setPayAmount(String(invoice.totalAmount));
    setPayError(null);
  };

  const submitPayment = () => {
    if (!payTarget) return;
    const amount = Number(payAmount.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayError("Số tiền thanh toán phải lớn hơn 0.");
      return;
    }
    setPayError(null);
    markPaid.mutate({
      id: payTarget.invoiceId,
      amount
    });
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

  const previewImage = async (invoice: Invoice) => {
    setImageTarget(invoice);
    setImageUri(null);
    try {
      setImageUri(await downloadInvoiceImage(invoice.invoiceId));
    } catch (error) {
      setImageTarget(null);
      Alert.alert("Không tải được ảnh", error instanceof Error ? error.message : "Vui lòng thử lại.");
    }
  };

  const confirmDelete = (invoice: Invoice) => {
    Alert.alert(
      "Xác nhận xóa hóa đơn",
      `Bạn có chắc muốn xóa vĩnh viễn hóa đơn ${invoiceTitle(invoice)}? Dữ liệu ghi số điện tương ứng vẫn được giữ lại.`,
      [
        { text: "Hủy", style: "cancel" },
        { text: "Xóa", style: "destructive", onPress: () => deleteInvoice.mutate(invoice.invoiceId) }
      ]
    );
  };

  return (
    <Screen title="Hóa đơn" subtitle={`Kỳ ${displayMonth(month)}`} loading={invoices.isLoading} refreshing={invoices.isFetching} onRefresh={invoices.refetch}>
      <MonthYearPicker value={month} onChange={setMonth} />
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
                <InvoiceAction label="Hủy thu" icon="return-up-back-outline" onPress={() => confirmUnpaid(invoice)} />
              ) : (
                <InvoiceAction label="Thu tiền" icon="cash-outline" onPress={() => openPayModal(invoice)} />
              )}
              <InvoiceAction label="Ảnh" icon="image-outline" onPress={() => previewImage(invoice)} />
              <InvoiceAction label="Sửa" icon="create-outline" onPress={() => { setEditError(null); setEditTarget(invoice); }} />
              <InvoiceAction label="Xóa" icon="trash-outline" danger onPress={() => confirmDelete(invoice)} />
            </View>
          </Card>
        ))
      )}
      <Modal visible={!!payTarget} transparent animationType="slide" onRequestClose={() => !markPaid.isPending && setPayTarget(null)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !markPaid.isPending && setPayTarget(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Ghi nhận thanh toán</Text>
                <Text style={styles.modalSubtitle}>Phòng {payTarget?.roomCode || payTarget?.roomId}</Text>
              </View>
              <Pressable style={styles.closeButton} disabled={markPaid.isPending} onPress={() => setPayTarget(null)}>
                <Ionicons name="close" size={23} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              {payError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={19} color={colors.danger} />
                  <Text style={styles.errorText}>{payError}</Text>
                </View>
              ) : null}
              <AppInput
                label="Số tiền thực tế thanh toán (VND) *"
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="numeric"
                editable={!markPaid.isPending}
              />
              <Text style={styles.formHelp}>Mặc định là số tiền hóa đơn cần thu: {formatMoney(payTarget?.totalAmount)}</Text>
            </ScrollView>
            <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
              <View style={styles.footerButton}><PrimaryButton title="Hủy" variant="secondary" disabled={markPaid.isPending} onPress={() => setPayTarget(null)} /></View>
              <View style={styles.footerButton}><PrimaryButton title={markPaid.isPending ? "Đang lưu..." : "Xác nhận thu tiền"} disabled={markPaid.isPending} onPress={submitPayment} /></View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <InvoiceEditModal
        invoice={editTarget}
        saving={updateInvoice.isPending}
        error={editError}
        onClose={() => !updateInvoice.isPending && setEditTarget(null)}
        onSave={(dto) => editTarget && updateInvoice.mutate({ id: editTarget.invoiceId, dto })}
      />
      <Modal visible={!!imageTarget} animationType="fade" statusBarTranslucent onRequestClose={() => setImageTarget(null)}>
        <View style={styles.imagePreview}>
          <View style={styles.imagePreviewHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.imagePreviewTitle}>Hóa đơn phòng {imageTarget?.roomCode || imageTarget?.roomId}</Text>
              <Text style={styles.imagePreviewSubtitle}>{imageTarget?.tenantName || "Chưa rõ người thuê"}</Text>
            </View>
            <Pressable style={styles.imageCloseButton} onPress={() => setImageTarget(null)}>
              <Ionicons name="close" size={26} color={colors.white} />
            </Pressable>
          </View>
          <View style={styles.imageCanvas}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.invoiceImage} resizeMode="contain" />
            ) : (
              <View style={styles.imageLoading}>
                <ActivityIndicator size="large" color={colors.white} />
                <Text style={styles.imageLoadingText}>Đang tải ảnh hóa đơn...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.md
  },
  actionButton: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  actionButtonDanger: { backgroundColor: "#fff5f4", borderColor: "#eed2ce" },
  actionButtonText: { color: colors.primaryDark, fontSize: 12, fontWeight: "900" },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(43,37,35,0.45)"
  },
  modalSheet: {
    maxHeight: "88%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden"
  },
  modalHeader: {
    minHeight: 76,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  modalSubtitle: { color: colors.textMuted, marginTop: 3, fontWeight: "700" },
  closeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  modalBody: { padding: spacing.md, gap: spacing.md },
  errorBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: "#eed2ce", borderRadius: 10, backgroundColor: "#fff5f4", padding: spacing.md },
  errorText: { flex: 1, color: colors.danger, fontWeight: "700" },
  formHelp: { color: colors.textMuted, fontSize: 12, marginTop: -spacing.sm },
  modalFooter: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  footerButton: { flex: 1 },
  imagePreview: { flex: 1, backgroundColor: "#171514" },
  imagePreviewHeader: { minHeight: 92, paddingTop: spacing.lg, paddingHorizontal: spacing.md, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "#171514" },
  imagePreviewTitle: { color: colors.white, fontSize: 18, fontWeight: "900" },
  imagePreviewSubtitle: { color: "#c9bfba", marginTop: 3 },
  imageCloseButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  imageCanvas: { flex: 1, padding: spacing.sm, alignItems: "center", justifyContent: "center" },
  invoiceImage: { width: "100%", height: "100%" },
  imageLoading: { alignItems: "center", gap: spacing.md },
  imageLoadingText: { color: colors.white, fontWeight: "700" }
});
