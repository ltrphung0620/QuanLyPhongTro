import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppInput, PrimaryButton } from "@/components/FormControls";
import { colors, spacing } from "@/theme";
import { Invoice, UpdateInvoice } from "@/types/api";

type FormState = Record<"roomFee" | "electricityFee" | "waterFee" | "trashFee" | "extraFee" | "discountAmount" | "debtAmount" | "depositDebtAmount", string> & {
  extraFeeNote: string;
  note: string;
};

const numberFields: Array<{ key: keyof UpdateInvoice; label: string }> = [
  { key: "roomFee", label: "Tiền phòng (đ)" },
  { key: "electricityFee", label: "Tiền điện (đ)" },
  { key: "waterFee", label: "Tiền nước (đ)" },
  { key: "trashFee", label: "Tiền rác (đ)" },
  { key: "extraFee", label: "Phí phát sinh (đ)" },
  { key: "depositDebtAmount", label: "Nợ tiền cọc (đ)" },
  { key: "discountAmount", label: "Số tiền giảm giá (đ)" },
  { key: "debtAmount", label: "Số tiền nợ cũ cộng thêm (đ)" }
];

function createForm(invoice: Invoice): FormState {
  return {
    roomFee: String(invoice.roomFee || 0),
    electricityFee: String(invoice.electricityFee || 0),
    waterFee: String(invoice.waterFee || 0),
    trashFee: String(invoice.trashFee || 0),
    extraFee: String(invoice.extraFee || 0),
    discountAmount: String(invoice.discountAmount || 0),
    debtAmount: String(invoice.debtAmount || 0),
    depositDebtAmount: String(invoice.depositDebtAmount || 0),
    extraFeeNote: invoice.extraFeeNote || "",
    note: invoice.note || ""
  };
}

export function InvoiceEditModal({ invoice, saving, error, onClose, onSave }: { invoice: Invoice | null; saving: boolean; error?: string | null; onClose: () => void; onSave: (dto: UpdateInvoice) => void }) {
  const [form, setForm] = useState<FormState | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setForm(invoice ? createForm(invoice) : null);
    setValidationError(null);
  }, [invoice]);

  const submit = () => {
    if (!form) return;
    const values = Object.fromEntries(numberFields.map(({ key }) => [key, Number(form[key as keyof FormState])])) as unknown as UpdateInvoice;
    if (numberFields.some(({ key }) => !Number.isFinite(values[key] as number) || (values[key] as number) < 0)) {
      setValidationError("Các khoản tiền phải là số và không được nhỏ hơn 0.");
      return;
    }
    onSave({ ...values, extraFeeNote: form.extraFeeNote.trim() || null, note: form.note.trim() || null });
  };

  return (
    <Modal visible={!!invoice} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !saving && onClose()} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Sửa chi tiết hóa đơn</Text>
              <Text style={styles.subtitle}>Phòng {invoice?.roomCode || invoice?.roomId}</Text>
            </View>
            <Pressable style={styles.close} disabled={saving} onPress={onClose}><Ionicons name="close" size={23} color={colors.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {validationError || error ? <Text style={styles.error}>{validationError || error}</Text> : null}
            {form ? numberFields.map(({ key, label }) => (
              <AppInput key={key} label={label} keyboardType="numeric" value={form[key as keyof FormState]} editable={!saving} onChangeText={(value) => setForm({ ...form, [key]: value })} />
            )) : null}
            {form ? <AppInput label="Ghi chú phí phát sinh" placeholder="Ví dụ: Thay bồn nước..." value={form.extraFeeNote} editable={!saving} onChangeText={(value) => setForm({ ...form, extraFeeNote: value })} /> : null}
            {form ? <AppInput label="Ghi chú hóa đơn" placeholder="Nhập ghi chú hóa đơn" value={form.note} editable={!saving} onChangeText={(value) => setForm({ ...form, note: value })} /> : null}
          </ScrollView>
          <View style={styles.footer}>
            <View style={styles.button}><PrimaryButton title="Hủy" variant="secondary" disabled={saving} onPress={onClose} /></View>
            <View style={styles.button}><PrimaryButton title={saving ? "Đang lưu..." : "Lưu thay đổi"} disabled={saving} onPress={submit} /></View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,37,35,0.45)" },
  sheet: { maxHeight: "92%", backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden" },
  header: { minHeight: 76, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginTop: 3, fontWeight: "700" },
  close: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  body: { padding: spacing.md, gap: spacing.md },
  error: { color: colors.danger, backgroundColor: "#fff5f4", borderWidth: 1, borderColor: "#eed2ce", borderRadius: 10, padding: spacing.md, fontWeight: "700" },
  footer: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  button: { flex: 1 }
});
