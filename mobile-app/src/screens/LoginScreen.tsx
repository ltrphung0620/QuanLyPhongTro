import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppInput, PrimaryButton } from "@/components/FormControls";
import { useAuth } from "@/context/AuthContext";
import { APP_NAME } from "@/config/env";
import { colors, spacing } from "@/theme";

export function LoginScreen() {
  const { signIn, isSigningIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={styles.container}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>LPH</Text>
          </View>
          <Text style={styles.brand}>Hệ thống quản lý phòng trọ</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Chào mừng trở lại</Text>
          <Text style={styles.subtitle}>Đăng nhập {APP_NAME} để quản lý nhà trọ trên điện thoại.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AppInput label="Email hoặc tên đăng nhập" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <AppInput label="Mật khẩu" secureTextEntry value={password} onChangeText={setPassword} />
          <PrimaryButton title={isSigningIn ? "Đang đăng nhập..." : "Tiếp tục đăng nhập"} disabled={isSigningIn} onPress={submit} />
        </View>
        <Text style={styles.footer}>Hệ thống thuộc về Lại Trình Phước Hưng</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "center",
    gap: spacing.lg
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  logo: {
    width: 42,
    height: 42,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1
  },
  logoText: {
    color: "#0e5aa7",
    fontWeight: "900"
  },
  brand: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: 16
  },
  card: {
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16
  },
  error: {
    color: colors.danger,
    backgroundColor: "#fff5f4",
    borderColor: "#eed2ce",
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: 12,
    fontWeight: "700"
  },
  footer: {
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 12
  }
});
