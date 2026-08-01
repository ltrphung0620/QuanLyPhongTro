import React, { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow, spacing } from "@/theme";

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function StatCard({ label, value, helper, icon, tone = "accent" }: { label: string; value: string; helper?: string; icon?: keyof typeof Ionicons.glyphMap; tone?: "accent" | "danger" | "neutral" }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Text style={styles.statLabel}>{label}</Text>
        {icon ? <View style={[styles.statIcon, tone === "danger" && styles.statIconDanger, tone === "neutral" && styles.statIconNeutral]}><Ionicons name={icon} size={18} color={tone === "danger" ? colors.danger : tone === "neutral" ? colors.primary : colors.accent} /></View> : null}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

export function ActionCard({ title, subtitle, icon, onPress }: { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.actionIcon}><Ionicons name={icon} size={23} color={colors.primary} /></View>
      <View style={styles.rowText}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress
}: {
  title: string;
  subtitle?: string;
  right?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={styles.rowRight}>{right}</Text> : null}
    </Pressable>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <Text style={styles.empty}>{text}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow
  },
  statCard: {
    width: "48%",
    minHeight: 154,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef6f3"
  },
  statIconDanger: { backgroundColor: "#fbf1f0" },
  statIconNeutral: { backgroundColor: "#f4f1ef" },
  statLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  statValue: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
    marginTop: spacing.sm
  },
  helper: {
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontSize: 12
  },
  actionCard: {
    minHeight: 86,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted
  },
  actionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  row: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  pressed: {
    opacity: 0.7
  },
  rowText: {
    flex: 1,
    gap: 4
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  rowSubtitle: {
    color: colors.textMuted,
    fontSize: 13
  },
  rowRight: {
    color: colors.primaryDark,
    fontWeight: "800"
  },
  empty: {
    color: colors.textMuted,
    textAlign: "center"
  }
});
