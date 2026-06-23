import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getTenantInvoices } from '../../src/api';
import { onInvoiceCreated } from '../../src/events';
import { formatDate, formatMoney, formatMonth } from '../../src/format';
import type { Invoice } from '../../src/types';

export default function InvoicesScreen() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      setInvoices(await getTenantInvoices());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải hóa đơn.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    return onInvoiceCreated(() => load(true));
  }, [load]);

  if (loading) {
    return <Centered message="Đang tải hóa đơn..." />;
  }

  return (
    <View style={styles.screen}>
      {error ? (
        <Pressable onPress={() => load()} style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retryText}>Chạm để thử lại</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={invoices}
        keyExtractor={(item) => String(item.invoiceId)}
        contentContainerStyle={invoices.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={<EmptyState />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/invoice/${item.invoiceId}`)} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.room}>Phòng {item.roomCode || item.roomId}</Text>
                <Text style={styles.month}>Tháng {formatMonth(item.billingMonth)}</Text>
              </View>
              <View style={[styles.badge, item.status === 'paid' ? styles.paidBadge : styles.unpaidBadge]}>
                <Text style={[styles.badgeText, item.status === 'paid' ? styles.paidText : styles.unpaidText]}>
                  {item.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                </Text>
              </View>
            </View>

            <Text style={styles.amount}>{formatMoney(item.totalAmount)}</Text>
            <Text style={styles.meta}>Từ {formatDate(item.fromDate)} đến {formatDate(item.toDate)}</Text>
            {item.paymentCode && item.status !== 'paid' ? (
              <Text style={styles.paymentCode}>Mã thanh toán: {item.paymentCode}</Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

function Centered({ message }: { message: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color="#7f5f55" size="large" />
      <Text style={styles.centeredText}>{message}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Chưa có hóa đơn</Text>
      <Text style={styles.emptyText}>Khi chủ trọ tạo hóa đơn mới, danh sách sẽ tự cập nhật tại đây.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f7f0ec',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f7f0ec',
  },
  centeredText: {
    color: '#73635d',
    fontWeight: '600',
  },
  card: {
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#eadfd9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  room: {
    color: '#241d1b',
    fontSize: 18,
    fontWeight: '800',
  },
  month: {
    color: '#73635d',
    fontSize: 14,
    marginTop: 2,
  },
  amount: {
    color: '#241d1b',
    fontSize: 26,
    fontWeight: '900',
  },
  meta: {
    color: '#73635d',
    fontSize: 13,
  },
  paymentCode: {
    color: '#7f5f55',
    fontWeight: '800',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unpaidBadge: {
    backgroundColor: '#fff0d6',
  },
  paidBadge: {
    backgroundColor: '#e7f6ed',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  unpaidText: {
    color: '#a15c00',
  },
  paidText: {
    color: '#26734d',
  },
  errorBox: {
    margin: 16,
    borderRadius: 14,
    backgroundColor: '#fff1f0',
    padding: 12,
  },
  errorText: {
    color: '#b42318',
    fontWeight: '700',
  },
  retryText: {
    color: '#7f5f55',
    marginTop: 4,
    fontWeight: '800',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: '#241d1b',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: '#73635d',
    textAlign: 'center',
    lineHeight: 22,
  },
});
