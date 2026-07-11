import React from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { colors, radius, spacing } from "@/theme";

type AppInputProps = TextInputProps & {
  label?: string;
};

export function AppInput({ label, style, ...props }: AppInputProps) {
  return (
    <View style={styles.inputGroup}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.textMuted} style={[styles.input, style]} {...props} />
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  variant = "primary"
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.secondaryButton,
        variant === "danger" && styles.dangerButton,
        (pressed || disabled) && styles.buttonPressed
      ]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, variant === "secondary" && styles.secondaryText]}>{title}</Text>
    </Pressable>
  );
}

export function PillButton({ title, active, onPress }: { title: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.pill, active && styles.pillActive]} onPress={onPress}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    gap: spacing.xs
  },
  label: {
    color: colors.text,
    fontWeight: "800"
  },
  input: {
    minHeight: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16
  },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary
  },
  secondaryButton: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1
  },
  dangerButton: {
    backgroundColor: colors.danger
  },
  buttonPressed: {
    opacity: 0.7
  },
  buttonText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 16
  },
  secondaryText: {
    color: colors.text
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  pillActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark
  },
  pillText: {
    color: colors.text,
    fontWeight: "800"
  },
  pillTextActive: {
    color: colors.white
  }
});
