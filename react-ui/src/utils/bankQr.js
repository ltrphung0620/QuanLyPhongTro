const KIM_LOAN_ROOM_CODES = new Set([
  'A1',
  'A2',
  'A3',
  'Kios 110/2A',
  'B4',
  'B5',
  'B6',
  'B7',
  'B8'
])

const KIM_LOAN_ACCOUNT = {
  bankCode: 'acb',
  accountNumber: '226448',
  accountName: 'Trinh Thi Kim Loan'
}

const PHAM_SAI_ACCOUNT = {
  bankCode: 'acb',
  accountNumber: '194218449',
  accountName: 'Phạm Thị Sại'
}

export function getInvoiceBankAccount(roomCode) {
  const normalizedRoomCode = String(roomCode || '').trim()
  return KIM_LOAN_ROOM_CODES.has(normalizedRoomCode)
    ? KIM_LOAN_ACCOUNT
    : PHAM_SAI_ACCOUNT
}

export function buildInvoicePaymentContent(invoice) {
  const tenantName = String(invoice?.tenantName || '').trim() || 'Nguoi thue'
  const roomCode = String(invoice?.roomCode || '').trim() || `Phong ${invoice?.roomId || ''}`.trim()
  const billingMonth = String(invoice?.billingMonth || '').trim()
  const parts = billingMonth.split('-')
  const monthText = parts.length >= 2 ? `${parts[1]}/${parts[0]}` : billingMonth

  return `${tenantName} dai dien phong ${roomCode} chuyen tien thang ${monthText} theo hoa don`
}

export function buildInvoiceQrUrl(invoice) {
  const paymentContent = buildInvoicePaymentContent(invoice)
  if (!paymentContent) {
    return ''
  }

  const amount = Math.max(0, Math.round(Number(invoice.totalAmount || 0)))
  if (amount <= 0) {
    return ''
  }

  const account = getInvoiceBankAccount(invoice.roomCode)
  const query = new URLSearchParams({
    amount: String(amount),
    addInfo: paymentContent,
    accountName: account.accountName
  })

  return `https://img.vietqr.io/image/${account.bankCode}-${account.accountNumber}-compact2.jpg?${query.toString()}`
}
