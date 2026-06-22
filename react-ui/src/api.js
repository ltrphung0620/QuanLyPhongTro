const macDinhApi = '/api'
const gocApi = (import.meta.env.VITE_API_BASE_URL || macDinhApi).replace(/\/$/, '')

function taoQuery(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value)
    }
  })

  const text = query.toString()
  return text ? `?${text}` : ''
}

async function goiApi(path, params = {}, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${gocApi}${path}${taoQuery(params)}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')
  }

  if (!response.ok) {
    let message = `Không thể tải dữ liệu (${response.status})`

    try {
      const error = await response.json()
      message = error.message || message
    } catch {
      // Bỏ qua lỗi parse để giữ message mặc định
    }

    throw new Error(message)
  }

  // Handle PDF downloads
  if (headers['Accept'] === 'application/pdf' || options.responseType === 'blob') {
    return response.blob()
  }

  return response.json()
}

// ===================================================================
// AUTH APIs
// ===================================================================
export function login(email, password) {
  return goiApi('/Auth/login', {}, { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function register(email, password) {
  return goiApi('/Auth/register', {}, { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function verifyOtp(email, otpCode) {
  return goiApi('/Auth/verify-otp', {}, { method: 'POST', body: JSON.stringify({ email, otpCode }) })
}

// ===================================================================
// ASSISTANT APIs
// ===================================================================
export function guiTinNhanAssistant(message) {
  return goiApi('/Assistant/agent', {}, { method: 'POST', body: JSON.stringify({ message }) })
}

export function thucThiLenhAssistant(commandId, strongConfirm = false) {
  return goiApi(`/Assistant/execute/${commandId}`, { strongConfirm }, { method: 'POST' })
}

export function resetAssistantSession() {
  return goiApi('/Assistant/reset', {}, { method: 'POST' })
}

// ===================================================================
// ROOMS APIs
// ===================================================================
export function layDanhSachPhong(status = null) {
  return goiApi('/Rooms', { status })
}

export function layChiTietPhong(id) {
  return goiApi(`/Rooms/${id}`)
}

export function layPhongTheoCode(roomCode) {
  return goiApi(`/Rooms/by-code/${roomCode}`)
}

export function themPhong(dto) {
  return goiApi('/Rooms', {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function suaPhong(id, dto) {
  return goiApi(`/Rooms/${id}`, {}, { method: 'PUT', body: JSON.stringify(dto) })
}

export function capNhatTrangThaiPhong(id, dto) {
  return goiApi(`/Rooms/${id}/status`, {}, { method: 'PATCH', body: JSON.stringify(dto) })
}

// ===================================================================
// TENANTS APIs
// ===================================================================
export function layDanhSachNguoiThue() {
  return goiApi('/Tenants')
}

export function layChiTietNguoiThue(id) {
  return goiApi(`/Tenants/${id}`)
}

export function themNguoiThue(dto) {
  return goiApi('/Tenants', {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function suaNguoiThue(id, dto) {
  return goiApi(`/Tenants/${id}`, {}, { method: 'PUT', body: JSON.stringify(dto) })
}

// ===================================================================
// CONTRACTS APIs
// ===================================================================
export function layDanhSachHopDong(status = null, roomId = null, includeArchived = false) {
  return goiApi('/Contracts', { status, roomId, includeArchived })
}

export function layChiTietHopDong(id) {
  return goiApi(`/Contracts/${id}`)
}

export function layHopDongActiveCuaPhong(roomCode) {
  return goiApi(`/Contracts/active-by-room/${roomCode}`)
}

export function taoHopDong(dto) {
  return goiApi('/Contracts', {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function suaHopDong(id, dto) {
  return goiApi(`/Contracts/${id}`, {}, { method: 'PUT', body: JSON.stringify(dto) })
}

export function xoaHopDong(id) {
  return goiApi(`/Contracts/${id}`, {}, { method: 'DELETE' })
}

export function huyHopDong(id, dto) {
  return goiApi(`/Contracts/${id}/cancel`, {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function layBaoCaoKetThucHopDong(id, dto) {
  return goiApi(`/Contracts/${id}/end-preview`, {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function ketThucHopDong(id, dto) {
  return goiApi(`/Contracts/${id}/end`, {}, { method: 'POST', body: JSON.stringify(dto) })
}

// ===================================================================
// METER READINGS APIs
// ===================================================================
export function layChiSoThang(thang, roomId = null) {
  return goiApi('/MeterReadings', { month: thang, roomId })
}

export function layChiSoConThieu(thang) {
  return goiApi('/MeterReadings/missing', { month: thang })
}

export function nhapChiSoDienNuoc(dto) {
  return goiApi('/MeterReadings', {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function nhapChiSoDienNuocBulk(dto) {
  return goiApi('/MeterReadings/bulk', {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function previewChiSoDienNuoc(dto) {
  return goiApi('/MeterReadings/preview', {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function xoaChiSoDienNuoc(id) {
  return goiApi(`/MeterReadings/${id}`, {}, { method: 'DELETE' })
}

// ===================================================================
// INVOICES APIs
// ===================================================================
export function layHoaDonThang(thang, roomId = null, status = null) {
  return goiApi('/Invoices', { month: thang, roomId, status })
}

export function layChiTietHoaDon(id) {
  return goiApi(`/Invoices/${id}`)
}

export function layHoaDonChuaThu(thang = null) {
  return goiApi('/Invoices/unpaid', { month: thang })
}

export function layHoaDonTheoPhongVaThang(roomId, thang) {
  return goiApi('/Invoices/by-room-and-month', { roomId, month: thang })
}

export function taoHoaDon(dto) {
  return goiApi('/Invoices', {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function previewHoaDon(dto) {
  return goiApi('/Invoices/preview', {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function taoHoaDonBulk(dto) {
  return goiApi('/Invoices/monthly-bulk', {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function previewHoaDonBulk(dto) {
  return goiApi('/Invoices/monthly-bulk-preview', {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function thanhToanHoaDon(id, dto = {}) {
  return goiApi(`/Invoices/${id}/mark-paid`, {}, { method: 'PATCH', body: JSON.stringify(dto) })
}

export function huyThanhToanHoaDon(id) {
  return goiApi(`/Invoices/${id}/mark-unpaid`, {}, { method: 'PATCH' })
}

export function xoaHoaDon(id) {
  return goiApi(`/Invoices/${id}`, {}, { method: 'DELETE' })
}

export async function downloadInvoicePdf(id) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${gocApi}/Invoices/${id}/pdf`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  if (!response.ok) throw new Error('Không thể tải PDF')
  return response.blob()
}

// ===================================================================
// PAYMENTS & TRANSACTIONS APIs
// ===================================================================
export function layDanhSachThanhToan(processStatus = null) {
  return goiApi('/Payments/transactions', { processStatus })
}

export function layChiTietThanhToan(id) {
  return goiApi(`/Payments/transactions/${id}`)
}

export function soKhopThanhToan(id, dto) {
  return goiApi(`/Payments/transactions/${id}/reconcile`, {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function xoaThanhToan(id) {
  return goiApi(`/Payments/transactions/${id}`, {}, { method: 'DELETE' })
}

export function layDanhSachGiaoDich(thang, type = null) {
  return goiApi('/Transactions', { month: thang, type })
}

export function themGiaoDichPhatSinh(dto) {
  return goiApi('/Transactions', {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function suaGiaoDichPhatSinh(id, dto) {
  return goiApi(`/Transactions/${id}`, {}, { method: 'PUT', body: JSON.stringify(dto) })
}

export function xoaGiaoDichPhatSinh(id) {
  return goiApi(`/Transactions/${id}`, {}, { method: 'DELETE' })
}

export function capNhatChiSoOriginal(dto) {
  return goiApi('/MeterReadings/current-reading', {}, { method: 'PATCH', body: JSON.stringify(dto) })
}

export async function uploadAnhChiSoOriginal(id, file) {
  const token = localStorage.getItem('token')
  const formData = new FormData()
  formData.append('image', file)
  
  const response = await fetch(`${gocApi}/MeterReadings/${id}/image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  })
  
  if (!response.ok) {
    let message = 'Không thể tải ảnh công tơ điện'
    try {
      const error = await response.json()
      message = error.message || message
    } catch {}
    throw new Error(message)
  }
  
  return response.json()
}

export function thayTheHoaDon(id, dto) {
  return goiApi(`/Invoices/${id}/replace`, {}, { method: 'POST', body: JSON.stringify(dto) })
}

export function suaHoaDon(id, dto) {
  return goiApi(`/Invoices/${id}`, {}, { method: 'PUT', body: JSON.stringify(dto) })
}

// ===================================================================
// REPORTS APIs
// ===================================================================
export async function layBaoCaoThang(thang) {
  const [doanhThu, chiPhi, loiNhuan, trangThaiThanhToan] = await Promise.all([
    goiApi('/Reports/monthly-revenue', { month: thang }),
    goiApi('/Reports/monthly-expense', { month: thang }),
    goiApi('/Reports/monthly-profit-loss', { month: thang }),
    goiApi('/Reports/payment-status', { month: thang }),
  ])

  return {
    doanhThu,
    chiPhi,
    loiNhuan,
    trangThaiThanhToan,
  }
}

export function laySalesLedger(fromMonth, toMonth) {
  return goiApi('/Reports/sales-ledger', { fromMonth, toMonth })
}

export async function downloadSalesLedgerPdf(fromMonth, toMonth, reportTitle = 'Báo cáo Sổ quỹ thu chi') {
  const token = localStorage.getItem('token')
  const response = await fetch(`${gocApi}/Reports/sales-ledger/pdf`, {
    method: 'POST',
    headers: {
      Accept: 'application/pdf',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ fromMonth, toMonth, reportTitle })
  })
  if (!response.ok) throw new Error('Không thể tải PDF báo cáo sổ quỹ')
  return response.blob()
}
