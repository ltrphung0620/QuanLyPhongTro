import React, { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, EmptyState } from "@/components/Cards";
import { AppInput, PillButton, PrimaryButton } from "@/components/FormControls";
import { MonthYearPicker } from "@/components/MonthYearPicker";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import { colors, displayMonth, formatMoney, formatMonth, radius, spacing } from "@/theme";
import { Transaction, TransactionInput } from "@/types/api";

const FIXED_ITEMS = [
  { label: "Cáp", aliases: ["cáp"] },
  { label: "Rác", aliases: ["rác"] },
  { label: "Tiền nước", aliases: ["tiền nước", "tiền nc"] },
  { label: "Tiền điện", aliases: ["tiền điện"] }
];

type LedgerRow = Transaction & { isFixedMonthly?: boolean; persistedTransactionId?: number | null };
type LedgerForm = { transactionDirection: "income" | "expense"; itemName: string; amount: string; transactionDate: string; description: string; relatedRoomId: number | null };
const normalize = (value?: string | null) => (value || "").trim().toLocaleLowerCase("vi-VN");
const today = () => new Date().toISOString().slice(0, 10);

function isFixedTransaction(transaction: Transaction, item: (typeof FIXED_ITEMS)[number]) {
  return item.aliases.includes(normalize(transaction.itemName)) && normalize(transaction.transactionDirection) === "expense" && normalize(transaction.category) === "operating" && !transaction.relatedRoomId && !transaction.relatedInvoiceId;
}

function ActionButton({ label, icon, danger, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean; onPress: () => void }) {
  return <Pressable style={({ pressed }) => [styles.actionButton, danger && styles.actionDanger, pressed && { opacity: 0.65 }]} onPress={onPress}><Ionicons name={icon} size={15} color={danger ? colors.danger : colors.primaryDark} /><Text style={[styles.actionText, danger && { color: colors.danger }]}>{label}</Text></Pressable>;
}

export function TransactionsScreen() {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useAuth();
  const [month, setMonth] = useState(formatMonth(new Date()));
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<LedgerRow | "new" | null>(null);
  const [form, setForm] = useState<LedgerForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const ledger = useQuery({ queryKey: ["transactions", month, activeOrganizationId], queryFn: () => api.transactions(month) });
  const rooms = useQuery({ queryKey: ["rooms", activeOrganizationId], queryFn: () => api.rooms() });
  const invalidate = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["transactions"] }), queryClient.invalidateQueries({ queryKey: ["report"] })]);

  const saveLedger = useMutation({
    mutationFn: async ({ row, dto }: { row: LedgerRow | "new"; dto: TransactionInput }) => {
      if (row !== "new" && row.isFixedMonthly && dto.amount === 0) {
        if (row.persistedTransactionId) await api.deleteTransaction(row.persistedTransactionId);
        return;
      }
      if (row !== "new" && row.persistedTransactionId) return api.updateTransaction(row.persistedTransactionId, dto);
      if (row !== "new" && !row.isFixedMonthly) return api.updateTransaction(row.transactionId, dto);
      return api.createTransaction(dto);
    },
    onSuccess: async () => { setEditing(null); setForm(null); await invalidate(); },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Không thể lưu giao dịch.")
  });
  const deleteLedger = useMutation({ mutationFn: api.deleteTransaction, onSuccess: invalidate, onError: (error) => Alert.alert("Không thể xóa", error instanceof Error ? error.message : "Vui lòng thử lại.") });

  const rows = useMemo<LedgerRow[]>(() => {
    const source = ledger.data ?? [];
    const fixed = FIXED_ITEMS.map((item, index) => {
      const existing = source.find((transaction) => isFixedTransaction(transaction, item));
      return { ...(existing || {}), transactionId: existing?.transactionId ?? -index - 1, persistedTransactionId: existing?.transactionId ?? null, transactionDirection: "expense", category: "operating", itemName: item.label, amount: existing?.amount ?? 0, transactionDate: existing?.transactionDate ?? `${month.slice(0, 7)}-01`, description: existing?.description ?? null, relatedRoomId: null, relatedRoomCode: null, isFixedMonthly: true } as LedgerRow;
    });
    return [...fixed, ...source.filter((transaction) => !FIXED_ITEMS.some((item) => isFixedTransaction(transaction, item)))];
  }, [ledger.data, month]);

  const filteredRows = rows.filter((row) => `${row.itemName || ""} ${row.description || ""} ${row.relatedRoomCode || ""}`.toLocaleLowerCase("vi-VN").includes(search.toLocaleLowerCase("vi-VN")));
  const openNew = () => { setEditing("new"); setForm({ transactionDirection: "expense", itemName: "", amount: "", transactionDate: today(), description: "", relatedRoomId: null }); setFormError(null); };
  const openEdit = (row: LedgerRow) => { setEditing(row); setForm({ transactionDirection: row.transactionDirection === "income" ? "income" : "expense", itemName: row.itemName || "", amount: String(row.amount || 0), transactionDate: row.transactionDate, description: row.description || "", relatedRoomId: row.relatedRoomId || null }); setFormError(null); };
  const submitLedger = () => {
    if (!editing || !form) return;
    const amount = Number(form.amount);
    const fixed = editing !== "new" && !!editing.isFixedMonthly;
    if (!form.itemName.trim() || !form.transactionDate || !Number.isFinite(amount) || (fixed ? amount < 0 : amount <= 0)) return setFormError(fixed ? "Tên, ngày và số tiền từ 0 trở lên là bắt buộc." : "Tên, ngày và số tiền lớn hơn 0 là bắt buộc.");
    saveLedger.mutate({ row: editing, dto: { transactionDirection: form.transactionDirection, category: "operating", itemName: form.itemName.trim(), amount, transactionDate: form.transactionDate, description: form.description.trim() || null, relatedRoomId: form.transactionDirection === "income" ? form.relatedRoomId : null } });
  };
  const confirmDelete = (row: LedgerRow) => {
    const id = row.isFixedMonthly ? row.persistedTransactionId : row.transactionId;
    if (!id) return Alert.alert("Khoản cố định", "Khoản này đang ở mức 0 nên chưa có dữ liệu để xóa.");
    Alert.alert("Xóa giao dịch", `Bạn có chắc muốn xóa “${row.itemName || "Giao dịch"}”?`, [{ text: "Hủy", style: "cancel" }, { text: "Xóa", style: "destructive", onPress: () => deleteLedger.mutate(id) }]);
  };

  return (
    <Screen title="Thu chi tháng" subtitle={`Quản lý sổ quỹ kỳ ${displayMonth(month)}`} loading={ledger.isLoading} refreshing={ledger.isFetching || rooms.isFetching} onRefresh={() => { ledger.refetch(); rooms.refetch(); }}>
      <MonthYearPicker value={month} onChange={setMonth} />
      <PrimaryButton title="Ghi chép thu chi" onPress={openNew} />
      <AppInput placeholder="Tìm theo khoản thu chi, phòng..." value={search} onChangeText={setSearch} />
      {filteredRows.length ? filteredRows.map((row) => (
        <Card key={`${row.isFixedMonthly ? "fixed" : "normal"}-${row.transactionId}`}>
          <View style={styles.rowHeader}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{row.itemName || "Giao dịch phát sinh"}</Text>{row.isFixedMonthly ? <Text style={styles.fixedHint}>Cố định theo tháng</Text> : null}</View><Text style={[styles.amount, row.transactionDirection === "income" ? styles.income : styles.expense]}>{row.transactionDirection === "income" ? "+" : "-"}{formatMoney(row.amount)}</Text></View>
          <Text style={styles.meta}>{row.relatedRoomCode ? `Phòng ${row.relatedRoomCode} • ` : ""}{row.transactionDate}</Text>
          {row.description ? <Text style={styles.description}>{row.description}</Text> : null}
          <View style={styles.actions}><ActionButton label="Sửa" icon="create-outline" onPress={() => openEdit(row)} /><ActionButton label="Xóa" icon="trash-outline" danger onPress={() => confirmDelete(row)} /></View>
        </Card>
      )) : <EmptyState text="Chưa có khoản thu chi nào trong kỳ." />}

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !saveLedger.isPending && setEditing(null)} />
          <View style={styles.sheet}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>{editing === "new" ? "Ghi chép thu chi phát sinh" : "Cập nhật giao dịch thu chi"}</Text><Pressable onPress={() => setEditing(null)}><Ionicons name="close" size={24} color={colors.text} /></Pressable></View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              {formError ? <Text style={styles.error}>{formError}</Text> : null}
              {form && editing && !(editing !== "new" && editing.isFixedMonthly) ? <View style={styles.tabs}><PillButton title="Chi tiền" active={form.transactionDirection === "expense"} onPress={() => setForm({ ...form, transactionDirection: "expense", relatedRoomId: null })} /><PillButton title="Thu tiền" active={form.transactionDirection === "income"} onPress={() => setForm({ ...form, transactionDirection: "income" })} /></View> : null}
              {form ? <AppInput label="Tên khoản thu/chi phát sinh *" value={form.itemName} editable={!(editing && editing !== "new" && editing.isFixedMonthly)} onChangeText={(value) => setForm({ ...form, itemName: value })} /> : null}
              {form ? <AppInput label="Số tiền phát sinh (VND) *" keyboardType="numeric" value={form.amount} onChangeText={(value) => setForm({ ...form, amount: value })} /> : null}
              {form ? <AppInput label="Ngày phát sinh *" placeholder="YYYY-MM-DD" value={form.transactionDate} onChangeText={(value) => setForm({ ...form, transactionDate: value })} /> : null}
              {form?.transactionDirection === "income" ? <View><Text style={styles.fieldLabel}>Liên kết phòng trọ (nếu có)</Text><View style={styles.choiceList}><Pressable style={[styles.choice, !form.relatedRoomId && styles.choiceActive]} onPress={() => setForm({ ...form, relatedRoomId: null })}><Text style={!form.relatedRoomId ? styles.choiceTextActive : styles.choiceText}>Không liên kết</Text></Pressable>{rooms.data?.map((room) => <Pressable key={room.roomId} style={[styles.choice, form.relatedRoomId === room.roomId && styles.choiceActive]} onPress={() => setForm({ ...form, relatedRoomId: room.roomId })}><Text style={form.relatedRoomId === room.roomId ? styles.choiceTextActive : styles.choiceText}>{room.roomCode}</Text></Pressable>)}</View></View> : null}
              {form ? <AppInput label="Chi tiết diễn giải thêm" value={form.description} onChangeText={(value) => setForm({ ...form, description: value })} /> : null}
            </ScrollView>
            <View style={styles.footer}><View style={{ flex: 1 }}><PrimaryButton title="Hủy" variant="secondary" disabled={saveLedger.isPending} onPress={() => setEditing(null)} /></View><View style={{ flex: 1 }}><PrimaryButton title={saveLedger.isPending ? "Đang lưu..." : "Lưu giao dịch"} disabled={saveLedger.isPending} onPress={submitLedger} /></View></View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  rowHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  rowTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  fixedHint: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  amount: { fontSize: 16, fontWeight: "900" },
  income: { color: colors.accent },
  expense: { color: colors.danger },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  description: { color: colors.text, marginTop: spacing.sm, lineHeight: 20 },
  actions: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.md },
  actionButton: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  actionDanger: { backgroundColor: "#fff5f4", borderColor: "#eed2ce" },
  actionText: { color: colors.primaryDark, fontSize: 12, fontWeight: "900" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,37,35,0.45)" },
  sheet: { maxHeight: "92%", backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden" },
  modalHeader: { minHeight: 72, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { flex: 1, color: colors.text, fontSize: 19, fontWeight: "900" },
  modalBody: { padding: spacing.md, gap: spacing.md },
  error: { color: colors.danger, backgroundColor: "#fff5f4", borderColor: "#eed2ce", borderWidth: 1, borderRadius: radius.sm, padding: spacing.md, fontWeight: "700" },
  fieldLabel: { color: colors.text, fontWeight: "800", marginBottom: spacing.sm },
  choiceList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  choice: { paddingHorizontal: spacing.sm, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  choiceActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  choiceText: { color: colors.text, fontWeight: "700" },
  choiceTextActive: { color: colors.white, fontWeight: "800" },
  footer: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }
});
