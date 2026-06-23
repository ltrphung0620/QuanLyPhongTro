import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../src/AuthContext';

export default function ChangePasswordScreen() {
  const { changePassword, logout } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError('');
    if (newPassword.length < 6) {
      setError('Mật khẩu mới cần ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(oldPassword, newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đổi mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Đổi mật khẩu</Text>
        <Text style={styles.subtitle}>Bạn cần đổi mật khẩu mặc định trước khi xem thông tin phòng.</Text>

        <TextInput
          value={oldPassword}
          onChangeText={setOldPassword}
          secureTextEntry
          placeholder="Mật khẩu hiện tại"
          style={styles.input}
        />
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Mật khẩu mới"
          style={styles.input}
        />
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Nhập lại mật khẩu mới"
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={submitting || !oldPassword || !newPassword || !confirmPassword}
          onPress={submit}
          style={({ pressed }) => [
            styles.button,
            (pressed || submitting) && styles.buttonPressed,
            (!oldPassword || !newPassword || !confirmPassword) && styles.buttonDisabled,
          ]}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Lưu mật khẩu</Text>}
        </Pressable>

        <Pressable onPress={logout} style={styles.linkButton}>
          <Text style={styles.linkText}>Đăng xuất</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#f7f0ec',
    padding: 20,
  },
  card: {
    gap: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 22,
  },
  title: {
    color: '#241d1b',
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: '#73635d',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#e6d8d1',
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: '#fffaf7',
  },
  button: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#7f5f55',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    backgroundColor: '#c8b9b3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  linkButton: {
    alignItems: 'center',
    padding: 10,
  },
  linkText: {
    color: '#7f5f55',
    fontWeight: '800',
  },
  error: {
    color: '#b42318',
    fontWeight: '600',
  },
});
