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

async function goiApi(path, params) {
  const response = await fetch(`${gocApi}${path}${taoQuery(params)}`, {
    headers: {
      Accept: 'application/json',
    },
  })

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

  return response.json()
}

export function layDanhSachPhong() {
  return goiApi('/Rooms')
}

export function layDanhSachNguoiThue() {
  return goiApi('/Tenants')
}

export function layDanhSachHopDong() {
  return goiApi('/Contracts')
}

export function layHoaDonThang(thang) {
  return goiApi('/Invoices', { month: thang })
}

export function layHoaDonChuaThu(thang) {
  return goiApi('/Invoices/unpaid', { month: thang })
}

export function layDanhSachThanhToan() {
  return goiApi('/Payments/transactions')
}

export function layDanhSachGiaoDich(thang) {
  return goiApi('/Transactions', { month: thang })
}

export function layChiSoThang(thang) {
  return goiApi('/MeterReadings', { month: thang })
}

export function layChiSoConThieu(thang) {
  return goiApi('/MeterReadings/missing', { month: thang })
}

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
