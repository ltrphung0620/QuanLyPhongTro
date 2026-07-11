import React, { useState } from "react";
import { Alert } from "react-native";
import { AppInput, PrimaryButton } from "@/components/FormControls";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

export function ChangePasswordScreen() {
  const { refreshProfile, signOut } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (newPassword.length < 6) {
      Alert.alert("Mật khẩu mới", "Mật khẩu mới cần tối thiểu 6 ký tự.");
      return;
    }

    setSaving(true);
    try {
      await api.changePassword(oldPassword, newPassword);
      await refreshProfile();
      Alert.alert("Thành công", "Đã đổi mật khẩu.");
    } catch (error) {
      Alert.alert("Không đổi được mật khẩu", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Đổi mật khẩu" subtitle="Tài khoản cần đổi mật khẩu trước khi tiếp tục.">
      <AppInput label="Mật khẩu hiện tại" secureTextEntry value={oldPassword} onChangeText={setOldPassword} />
      <AppInput label="Mật khẩu mới" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
      <PrimaryButton title={saving ? "Đang lưu..." : "Lưu mật khẩu mới"} disabled={saving} onPress={submit} />
      <PrimaryButton title="Đăng xuất" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
