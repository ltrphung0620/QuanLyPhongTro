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
  accountName: 'Pham Thi Sai'
}

export function getInvoiceBankAccount(roomCode) {
  const normalizedRoomCode = String(roomCode || '').trim()
  return KIM_LOAN_ROOM_CODES.has(normalizedRoomCode)
    ? KIM_LOAN_ACCOUNT
    : PHAM_SAI_ACCOUNT
}

export function buildInvoiceQrUrl(invoice) {
  if (!invoice?.paymentCode || !String(invoice.paymentCode).trim()) {
    return ''
  }

  const amount = Math.max(0, Math.round(Number(invoice.totalAmount || 0)))
  if (amount <= 0) {
    return ''
  }

  const account = getInvoiceBankAccount(invoice.roomCode)
  const query = new URLSearchParams({
    amount: String(amount),
    addInfo: String(invoice.paymentCode).trim(),
    accountName: account.accountName
  })

  return `https://img.vietqr.io/image/${account.bankCode}-${account.accountNumber}-compact2.jpg?${query.toString()}`
}
