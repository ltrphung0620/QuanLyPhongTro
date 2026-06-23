import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getInvoicePdfUrl, getTenantInvoice } from '../../src/api';
import { VIETQR_ACCOUNT_NAME, VIETQR_ACCOUNT_NO, VIETQR_BANK_CODE } from '../../src/config';
import { buildVietQrUrl, formatDate, formatMoney, formatMonth } from '../../src/format';
import type { Invoice } from '../../src/types';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceId = Number(id);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!Number.isFinite(invoiceId)) {
      setError('Hóa đơn không hợp lệ.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      setInvoice(await getTenantInvoice(invoiceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải chi tiết hóa đơn.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#7f5f55" size="large" />
      </View>
    );
  }

  if (error || !invoice) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error || 'Không tìm thấy hóa đơn.'}</Text>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const qrUrl = buildVietQrUrl(
    VIETQR_BANK_CODE,
    VIETQR_ACCOUNT_NO,
    VIETQR_ACCOUNT_NAME,
    invoice.totalAmount,
    invoice.paymentCode,
  );
  const pdfUrl = getInvoicePdfUrl(invoice.invoiceId);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Hóa đơn tháng {formatMonth(invoice.billingMonth)}</Text>
          <Text style={styles.subtitle}>Phòng {invoice.roomCode || invoice.roomId}</Text>
        </View>
      </View>

      <View style={[styles.statusCard, invoice.status === 'paid' ? styles.paidCard : styles.unpaidCard]}>
        <Text style={styles.statusLabel}>{invoice.status === 'paid' ? 'Đã thanh toán' : 'Cần thanh toán'}</Text>
        <Text style={styles.total}>{formatMoney(invoice.totalAmount)}</Text>
        <Text style={styles.period}>Từ {formatDate(invoice.fromDate)} đến {formatDate(invoice.toDate)}</Text>
      </View>

      {invoice.status !== 'paid' && qrUrl ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quét QR thanh toán</Text>
          <Image source={{ uri: qrUrl }} resizeMode="contain" style={styles.qr} />
          <Text style={styles.paymentCode}>Nội dung: {invoice.paymentCode}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Chi tiết tiền</Text>
        <Line label="Tiền phòng" value={invoice.roomFee} />
        <Line label="Tiền điện" value={invoice.electricityFee} />
        <Line label="Tiền nước" value={invoice.waterFee} />
        <Line label="Tiền rác" value={invoice.trashFee} />
        <Line label="Phí khác" value={invoice.extraFee} />
        <Line label="Nợ kỳ trước" value={invoice.debtAmount + invoice.depositDebtAmount} />
        <Line label="Giảm giá" value={-invoice.discountAmount} />
      </View>

      {invoice.previousReading !== null && invoice.previousReading !== undefined ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Chỉ số điện</Text>
          <Text style={styles.note}>Cũ {invoice.previousReading} → mới {invoice.currentReading} · tiêu thụ {invoice.consumedUnits} kWh</Text>
        </View>
      ) : null}

      {invoice.extraFeeNote || invoice.note ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ghi chú</Text>
          {invoice.extraFeeNote ? <Text style={styles.note}>{invoice.extraFeeNote}</Text> : null}
          {invoice.note ? <Text style={styles.note}>{invoice.note}</Text> : null}
        </View>
      ) : null}

      {pdfUrl ? (
        <Pressable onPress={() => Linking.openURL(pdfUrl)} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Xem PDF hóa đơn</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{formatMoney(value)}</Text>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f0ec',
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#fff',
  },
  backText: {
    color: '#7f5f55',
    fontSize: 34,
    lineHeight: 34,
  },
  title: {
    color: '#241d1b',
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: '#73635d',
    marginTop: 2,
  },
  statusCard: {
    borderRadius: 22,
    padding: 18,
    gap: 6,
  },
  unpaidCard: {
    backgroundColor: '#fff0d6',
  },
  paidCard: {
    backgroundColor: '#e7f6ed',
  },
  statusLabel: {
    color: '#73635d',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  total: {
    color: '#241d1b',
    fontSize: 34,
    fontWeight: '900',
  },
  period: {
    color: '#73635d',
  },
  card: {
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#eadfd9',
  },
  sectionTitle: {
    color: '#241d1b',
    fontSize: 18,
    fontWeight: '900',
  },
  qr: {
    width: '100%',
    height: 320,
    borderRadius: 16,
    backgroundColor: '#fffaf7',
  },
  paymentCode: {
    color: '#7f5f55',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  lineLabel: {
    color: '#73635d',
    fontWeight: '700',
  },
  lineValue: {
    color: '#241d1b',
    fontWeight: '900',
  },
  note: {
    color: '#5e514c',
    lineHeight: 22,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#7f5f55',
    padding: 16,
    marginBottom: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 14,
  },
  secondaryButtonText: {
    color: '#7f5f55',
    fontWeight: '900',
  },
  error: {
    color: '#b42318',
    fontWeight: '700',
    textAlign: 'center',
  },
});
