import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../src/AuthContext';

export default function AccountScreen() {
  const { user, refreshUser, changePassword, logout } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setMessage('');
    setError('');
    if (newPassword.length < 6) {
      setError('Mật khẩu mới cần ít nhất 6 ký tự.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setMessage('Đã đổi mật khẩu.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đổi mật khẩu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Thông tin tài khoản</Text>
        <Info label="Tên đăng nhập" value={user?.username} />
        <Info label="Email" value={user?.email} />
        <Info label="Tên hiển thị" value={user?.displayName} />
        <Info label="Vai trò" value={user?.role} />
        <Info label="Tenant ID" value={user?.tenantId ? String(user.tenantId) : '-'} />
        <Pressable onPress={() => refreshUser()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Làm mới thông tin</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Đổi mật khẩu</Text>
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Pressable
          disabled={saving || !oldPassword || !newPassword}
          onPress={submit}
          style={[styles.button, (!oldPassword || !newPassword) && styles.buttonDisabled]}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Lưu mật khẩu</Text>}
        </Pressable>
      </View>

      <Pressable onPress={logout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </Pressable>
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f7f0ec',
  },
  content: {
    padding: 16,
    gap: 14,
  },
  card: {
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#eadfd9',
  },
  title: {
    color: '#241d1b',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    color: '#73635d',
    fontWeight: '700',
  },
  infoValue: {
    flex: 1,
    color: '#241d1b',
    textAlign: 'right',
    fontWeight: '800',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#e6d8d1',
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: '#fffaf7',
  },
  button: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#7f5f55',
  },
  buttonDisabled: {
    backgroundColor: '#c8b9b3',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#f5ece7',
    padding: 12,
    marginTop: 6,
  },
  secondaryButtonText: {
    color: '#7f5f55',
    fontWeight: '900',
  },
  logoutButton: {
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#fff1f0',
    padding: 15,
    marginBottom: 24,
  },
  logoutText: {
    color: '#b42318',
    fontSize: 16,
    fontWeight: '900',
  },
  error: {
    color: '#b42318',
    fontWeight: '700',
  },
  message: {
    color: '#26734d',
    fontWeight: '700',
  },
});
