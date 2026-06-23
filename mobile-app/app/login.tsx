import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { API_BASE_URL } from '../src/config';
import { useAuth } from '../src/AuthContext';

export default function LoginScreen() {
  const { loginTenant } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await loginTenant(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng nhập.');
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
        <Text style={styles.brand}>LPH Tenant</Text>
        <Text style={styles.title}>Đăng nhập khách thuê</Text>
        <Text style={styles.subtitle}>Xem hóa đơn, chỉ số điện nước và nhận thông báo thanh toán.</Text>

        {!API_BASE_URL ? (
          <View style={styles.warning}>
            <Text style={styles.warningText}>Chưa cấu hình EXPO_PUBLIC_API_BASE_URL.</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Tên đăng nhập hoặc email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Ví dụ: A1"
          style={styles.input}
        />

        <Text style={styles.label}>Mật khẩu</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Nhập mật khẩu"
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={submitting || !email.trim() || !password || !API_BASE_URL}
          onPress={submit}
          style={({ pressed }) => [
            styles.button,
            (pressed || submitting) && styles.buttonPressed,
            (!email.trim() || !password || !API_BASE_URL) && styles.buttonDisabled,
          ]}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Tiếp tục</Text>}
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
    shadowColor: '#2d2522',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
  brand: {
    color: '#7f5f55',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: '#241d1b',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#73635d',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  label: {
    color: '#3d3330',
    fontSize: 14,
    fontWeight: '700',
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
  error: {
    color: '#b42318',
    fontWeight: '600',
  },
  warning: {
    borderRadius: 12,
    backgroundColor: '#fff1d6',
    padding: 12,
  },
  warningText: {
    color: '#8a5200',
    fontWeight: '700',
  },
});
