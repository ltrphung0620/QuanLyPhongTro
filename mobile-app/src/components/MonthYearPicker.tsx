import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme";

type PickerMode = "month" | "year" | null;
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function parseValue(value: string) {
  const [year, month] = value.split("-").map(Number);
  const now = new Date();
  return {
    year: Number.isFinite(year) ? year : now.getFullYear(),
    month: Number.isFinite(month) ? month : now.getMonth() + 1
  };
}

export function MonthYearPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selected = parseValue(value);
  const [mode, setMode] = useState<PickerMode>(null);
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 9 }, (_, index) => currentYear + 2 - index), [currentYear]);
  const options = mode === "month" ? MONTHS : years;

  const select = (nextValue: number) => {
    const year = mode === "year" ? nextValue : selected.year;
    const month = mode === "month" ? nextValue : selected.month;
    onChange(`${year}-${String(month).padStart(2, "0")}-01`);
    setMode(null);
  };

  return (
    <View style={styles.group}>
      <Text style={styles.label}>Chọn kỳ</Text>
      <View style={styles.controls}>
        <Pressable style={styles.select} onPress={() => setMode("month")}>
          <Text style={styles.selectHint}>Tháng</Text>
          <View style={styles.valueRow}>
            <Text style={styles.value}>Tháng {selected.month}</Text>
            <Ionicons name="chevron-down" size={17} color={colors.textMuted} />
          </View>
        </Pressable>
        <Pressable style={styles.select} onPress={() => setMode("year")}>
          <Text style={styles.selectHint}>Năm</Text>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{selected.year}</Text>
            <Ionicons name="chevron-down" size={17} color={colors.textMuted} />
          </View>
        </Pressable>
      </View>

      <Modal visible={mode !== null} transparent animationType="fade" onRequestClose={() => setMode(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMode(null)}>
          <Pressable style={styles.modal} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{mode === "month" ? "Chọn tháng" : "Chọn năm"}</Text>
              <Pressable style={styles.closeButton} onPress={() => setMode(null)}>
                <Ionicons name="close" size={21} color={colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              key={mode || "picker"}
              keyExtractor={(item) => String(item)}
              numColumns={mode === "month" ? 3 : 1}
              contentContainerStyle={styles.optionList}
              renderItem={({ item }) => {
                const active = mode === "month" ? item === selected.month : item === selected.year;
                return (
                  <Pressable style={[styles.option, mode === "month" && styles.monthOption, active && styles.optionActive]} onPress={() => select(item)}>
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{mode === "month" ? `Tháng ${item}` : item}</Text>
                    {active && mode === "year" ? <Ionicons name="checkmark" size={19} color={colors.white} /> : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  controls: { flexDirection: "row", gap: spacing.sm },
  select: { flex: 1, minHeight: 62, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  selectHint: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  valueRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 },
  value: { color: colors.text, fontSize: 16, fontWeight: "900" },
  backdrop: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: "rgba(43,37,35,0.45)" },
  modal: { maxHeight: "78%", borderRadius: radius.md, backgroundColor: colors.surface, overflow: "hidden" },
  modalHeader: { minHeight: 60, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
  closeButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  optionList: { padding: spacing.md },
  option: { minHeight: 48, marginBottom: spacing.sm, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  monthOption: { width: "31%", marginHorizontal: "1.15%", justifyContent: "center", paddingHorizontal: spacing.xs },
  optionActive: { backgroundColor: colors.primaryDark },
  optionText: { color: colors.text, fontWeight: "800" },
  optionTextActive: { color: colors.white }
});
