export function formatMoney(value?: number | null) {
  return `${Math.round(Number(value || 0)).toLocaleString('vi-VN')}đ`;
}

export function formatMonth(value?: string | null) {
  if (!value) {
    return 'Chưa có kỳ';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 7);
  }

  return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function formatDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('vi-VN');
}

export function buildVietQrUrl(
  bankCode: string,
  accountNo: string,
  accountName: string,
  amount: number,
  paymentCode?: string | null,
) {
  if (!bankCode || !accountNo || !paymentCode || amount <= 0) {
    return null;
  }

  const query = new URLSearchParams({
    amount: String(Math.max(0, Math.round(amount))),
    addInfo: paymentCode.trim(),
    accountName,
  });

  return `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact2.jpg?${query.toString()}`;
}
