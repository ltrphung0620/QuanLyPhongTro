import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getTenantMeterReadings, resolveAssetUrl } from '../../src/api';
import { formatMoney, formatMonth } from '../../src/format';
import type { MeterReading } from '../../src/types';

export default function MeterReadingsScreen() {
  const [items, setItems] = useState<MeterReading[]>([]);
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
      setItems(await getTenantMeterReadings());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải chỉ số.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#7f5f55" size="large" />
        <Text style={styles.centeredText}>Đang tải chỉ số...</Text>
      </View>
    );
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
        data={items}
        keyExtractor={(item) => String(item.meterReadingId)}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={<EmptyState />}
        renderItem={({ item }) => {
          const imageUrl = resolveAssetUrl(item.meterImagePath);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.room}>Phòng {item.roomCode || item.roomId}</Text>
                  <Text style={styles.month}>Kỳ {formatMonth(item.billingMonth)}</Text>
                </View>
                <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
              </View>

              <View style={styles.grid}>
                <Metric label="Chỉ số cũ" value={item.previousReading} />
                <Metric label="Chỉ số mới" value={item.currentReading} />
                <Metric label="Tiêu thụ" value={`${item.consumedUnits} kWh`} />
              </View>

              {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" /> : null}
            </View>
          );
        }}
      />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Chưa có chỉ số</Text>
      <Text style={styles.emptyText}>Chỉ số điện nước từng tháng sẽ hiển thị ở đây.</Text>
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
    gap: 14,
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
    marginTop: 2,
  },
  amount: {
    color: '#7f5f55',
    fontSize: 16,
    fontWeight: '900',
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#fffaf7',
    padding: 10,
  },
  metricLabel: {
    color: '#8b7c75',
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    color: '#241d1b',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  image: {
    height: 220,
    borderRadius: 16,
    backgroundColor: '#eee4df',
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
