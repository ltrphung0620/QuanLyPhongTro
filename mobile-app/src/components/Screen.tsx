import React, { PropsWithChildren } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/theme";

type ScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function Screen({ title, subtitle, loading, refreshing, onRefresh, children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
      >
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          children
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.md,
    gap: spacing.md
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text
  },
  subtitle: {
    marginTop: -spacing.sm,
    color: colors.textMuted,
    fontSize: 15
  },
  loading: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center"
  }
});
