import React, { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, spacing } from "@/theme";

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <Card>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </Card>
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
  statLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  statValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    marginTop: spacing.sm
  },
  helper: {
    color: colors.textMuted,
    marginTop: spacing.xs
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
