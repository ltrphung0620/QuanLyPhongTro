import { useEffect, useMemo, useState } from 'react'
import './App.css'

const MODULES = [
  { key: 'reports', title: 'Báo cáo', prefix: '/api/Reports' },
  { key: 'rooms', title: 'Phòng', prefix: '/api/Rooms' },
  { key: 'tenants', title: 'Người thuê', prefix: '/api/Tenants' },
  { key: 'contracts', title: 'Hợp đồng', prefix: '/api/Contracts' },
  { key: 'meterreadings', title: 'Chỉ số điện nước', prefix: '/api/MeterReadings' },
  { key: 'invoices', title: 'Hóa đơn', prefix: '/api/Invoices' },
  { key: 'payments', title: 'Thanh toán', prefix: '/api/Payments' },
  { key: 'transactions', title: 'Thu chi phát sinh', prefix: '/api/Transactions' },
  { key: 'tong-quan', title: 'Khai thuế', prefix: '' },
]

const METHOD_ORDER = ['get', 'post', 'put', 'patch', 'delete']
const MUI_GIO_VIET_NAM = 'Asia/Ho_Chi_Minh'
const BUILD_ID = '2026-04-18-1639'

const FALLBACK_METER_READING_UPDATE_ENDPOINT = {
  path: '/api/MeterReadings/current-reading',
  method: 'patch',
  operation: {
    summary: 'Sửa chỉ số điện gốc theo phòng',
    parameters: [],
    requestBody: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              meterReadingId: { type: 'integer', example: 12 },
              roomCode: { type: 'string', example: 'A01' },
              billingMonth: { type: 'string', format: 'date', example: taoThangMacDinh() },
              currentReading: { type: 'integer', example: 150 },
            },
            required: ['roomCode', 'billingMonth', 'currentReading'],
          },
        },
      },
    },
  },
}

function taoThangMacDinh() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function taoThoiGianMacDinh() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function taoNamHienTai() {
  return new Date().getFullYear()
}

function taoKySauThangHienTai() {
  return new Date().getMonth() + 1 <= 6 ? '1' : '2'
}

function formatJson(value) {
  return JSON.stringify(value, null, 2)
}

function tenDep(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function resolveSchema(schema, spec) {
  if (!schema) return null

  if (schema.$ref) {
    return schema.$ref
      .replace(/^#\//, '')
      .split('/')
      .reduce((current, part) => current?.[part], spec)
  }

  if (schema.allOf?.length) {
    return schema.allOf.reduce(
      (acc, item) => {
        const resolved = resolveSchema(item, spec) || {}
        return {
          ...acc,
          ...resolved,
          properties: { ...(acc.properties || {}), ...(resolved.properties || {}) },
          required: [...new Set([...(acc.required || []), ...(resolved.required || [])])],
        }
      },
      { properties: {}, required: [] },
    )
  }

  return schema
}

function sampleValue(schema, spec, name = '') {
  const resolved = resolveSchema(schema, spec) || {}

  if (resolved.example !== undefined) return resolved.example
  if (resolved.default !== undefined) return resolved.default
  if (resolved.enum?.length) return resolved.enum[0]

  const lowerName = name.toLowerCase()

  switch (resolved.type) {
    case 'string':
      if (resolved.format === 'date') return laFieldThang(name) ? taoGiaTriThangMacDinh() : taoThangMacDinh()
      if (resolved.format === 'date-time') return taoThoiGianMacDinh()
      if (resolved.format === 'binary') return ''
      if (lowerName.includes('phone')) return '0900000000'
      if (lowerName.includes('roomcode')) return 'A01'
      if (lowerName.includes('name')) return ''
      return ''
    case 'integer':
    case 'number':
      return 0
    case 'boolean':
      return false
    case 'array':
      return [sampleValue(resolved.items, spec, name)]
    default:
      if (resolved.properties) {
        return Object.fromEntries(
          Object.entries(resolved.properties).map(([key, value]) => [key, sampleValue(value, spec, key)]),
        )
      }
      return {}
  }
}

function typeLabel(schema) {
  if (!schema) return 'Không xác định'
  if (schema.type === 'array') return `Danh sách ${typeLabel(schema.items)}`
  if (schema.format === 'binary') return 'Tệp'
  if (schema.enum?.length) return `Chọn một trong: ${schema.enum.join(', ')}`
  if (schema.properties) return 'Đối tượng'
  return schema.type || 'Không xác định'
}

function normalizeValue(value, schema, spec, fieldName = '') {
  const resolved = resolveSchema(schema, spec) || {}
  if (value === '' || value === null || value === undefined) return value

  if (resolved.format === 'date' && laFieldThang(fieldName)) {
    return chuanHoaGiaTriThang(value)
  }

  if (resolved.type === 'integer') {
    if (laFieldTien(fieldName)) return chuyenTienVeSo(value)
    return Number.parseInt(value, 10)
  }
  if (resolved.type === 'number') {
    if (laFieldTien(fieldName)) return chuyenTienVeSo(value)
    return Number.parseFloat(value)
  }
  if (resolved.type === 'boolean') return value === true || value === 'true'
  return value
}

function kieuInput(schema, spec, fieldName = '') {
  const resolved = resolveSchema(schema, spec) || {}

  if (resolved.format === 'date') return laFieldThang(fieldName) ? 'month' : 'date'
  if (resolved.format === 'date-time') return 'datetime-local'
  if (resolved.type === 'number' || resolved.type === 'integer') return 'number'
  return 'text'
}

function giaTriInput(schema, spec, fieldName, value) {
  const resolved = resolveSchema(schema, spec) || {}
  if (value === null || value === undefined) return ''
  if (resolved.format === 'date' && laFieldThang(fieldName)) {
    return String(value).slice(0, 7)
  }
  return value
}

function placeholderInput(schema, spec, fieldName, fallback) {
  const resolved = resolveSchema(schema, spec) || {}
  if (resolved.format === 'date' && laFieldThang(fieldName)) return 'YYYY-MM'
  if (resolved.format === 'date') return 'YYYY-MM-DD'
  return fallback
}

function thongDiepLoi(error) {
  if (error instanceof Error) return error.message
  return 'Có lỗi xảy ra khi gọi API.'
}

function tachMaPhongDeSapXep(roomCode) {
  const raw = String(roomCode || '').trim()
  const normalized = raw.toLowerCase()

  const kiosMatch = normalized.match(/^(kios|kiosk|kiot|kiots)\s*[-_ ]*(\d+)?$/i)
  if (kiosMatch) {
    return {
      group: 0,
      prefix: 'kios',
      number: Number.parseInt(kiosMatch[2] || '0', 10),
      raw,
    }
  }

  const alphaNumMatch = normalized.match(/^([a-z]+)\s*[-_ ]*(\d+)$/i)
  if (alphaNumMatch) {
    return {
      group: 1,
      prefix: alphaNumMatch[1],
      number: Number.parseInt(alphaNumMatch[2], 10),
      raw,
    }
  }

  const numOnlyMatch = normalized.match(/^(\d+)$/)
  if (numOnlyMatch) {
    return {
      group: 1,
      prefix: '',
      number: Number.parseInt(numOnlyMatch[1], 10),
      raw,
    }
  }

  return {
    group: 2,
    prefix: normalized,
    number: Number.POSITIVE_INFINITY,
    raw,
  }
}

function soSanhMaPhong(a, b) {
  const roomA = tachMaPhongDeSapXep(a)
  const roomB = tachMaPhongDeSapXep(b)

  if (roomA.group !== roomB.group) return roomA.group - roomB.group

  if (roomA.prefix !== roomB.prefix) {
    return roomA.prefix.localeCompare(roomB.prefix, 'vi', { sensitivity: 'base' })
  }

  if (roomA.number !== roomB.number) return roomA.number - roomB.number

  return roomA.raw.localeCompare(roomB.raw, 'vi', { numeric: true, sensitivity: 'base' })
}

function laFormTaoPhong(moduleKey, method, path) {
  return moduleKey === 'rooms' && method === 'post' && path.toLowerCase() === '/api/rooms'
}

function laFormNguoiThue(moduleKey, method, path) {
  return moduleKey === 'tenants' && method === 'post' && path.toLowerCase() === '/api/tenants'
}

function laFormHopDong(moduleKey, method, path) {
  return moduleKey === 'contracts' && method === 'post' && path.toLowerCase() === '/api/contracts'
}

function laFormChiSoDienNuoc(moduleKey, method, path) {
  return (
    moduleKey === 'meterreadings' &&
    method === 'post' &&
    (path.toLowerCase() === '/api/meterreadings' || path.toLowerCase() === '/api/meterreadings/preview')
  )
}

function laFormSuaChiSoDienGoc(moduleKey, method, path) {
  return moduleKey === 'meterreadings' && method === 'patch' && path.toLowerCase() === '/api/meterreadings/current-reading'
}

function laFormHoaDon(moduleKey, method, path) {
  return (
    moduleKey === 'invoices' &&
    method === 'post' &&
    (path.toLowerCase() === '/api/invoices' || path.toLowerCase() === '/api/invoices/preview')
  )
}

function laFormMonthlyBulkPreview(moduleKey, method, path) {
  return moduleKey === 'invoices' && method === 'post' && path.toLowerCase() === '/api/invoices/monthly-bulk-preview'
}

function laFormMonthlyBulk(moduleKey, method, path) {
  return moduleKey === 'invoices' && method === 'post' && path.toLowerCase() === '/api/invoices/monthly-bulk'
}

function laPhongChuaThue(room) {
  const status = String(room?.status ?? room?.Status ?? '')
    .trim()
    .toLowerCase()

  return status === 'vacant'
}

function nhanTruong(moduleKey, path, field) {
  const normalize = (value) => String(value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  const normalizedField = normalize(field)
  const normalizedPath = String(path || '').toLowerCase()

  if (
    moduleKey === 'contracts' &&
    normalizedField === 'currentreading' &&
    (normalizedPath.includes('/end-preview') || normalizedPath.includes('/end'))
  ) {
    return 'Số điện lúc kết thúc hợp đồng'
  }

  const map = {
    rooms: {
      roomcode: 'Mã phòng',
      listedprice: 'Giá phòng',
      status: 'Trạng thái',
    },
    tenants: {
      fullname: 'Họ và tên',
      phone: 'Số điện thoại',
      cccd: 'Căn cước công dân',
    },
    contracts: {
      contractid: 'Mã hợp đồng',
      roomid: 'Mã phòng',
      roomcode: 'Mã phòng',
      tenantid: 'Mã người thuê',
      tenantname: 'Tên người thuê',
      startdate: 'Ngày bắt đầu',
      expectedenddate: 'Ngày kết thúc dự kiến',
      actualenddate: 'Ngày kết thúc thực tế',
      depositamount: 'Tiền đặt cọc',
      occupantcount: 'Số khách',
      actualroomprice: 'Giá phòng thực tế',
      status: 'Trạng thái',
      createdat: 'Ngày tạo',
      updatedat: 'Ngày cập nhật',

      numberofdays: 'Số ngày ở thực tế',
      roomfee: 'Tiền phòng',
      electricityfee: 'Tiền điện',
      waterfee: 'Tiền nước',
      trashfee: 'Tiền rác',
      finalinvoiceamount: 'Tổng tiền hóa đơn chốt',
      deductedamount: 'Số tiền khấu trừ',
      refundedamount: 'Số tiền hoàn trả',
      remainingamount: 'Số tiền khách còn phải thanh toán',
    },
    meterreadings: {
      meterreadingid: 'Mã bản ghi chỉ số',
      roomselector: 'Mã phòng',
      roomid: 'Mã phòng',
      roomcode: 'Mã phòng',
      contractid: 'Mã hợp đồng',
      billingmonth: 'Tháng ghi chỉ số',
      previousreading: 'Chỉ số cũ',
      currentreading: 'Chỉ số hiện tại',
      consumedunits: 'Số lượng tiêu thụ',
      unitprice: 'Đơn giá',
      amount: 'Thành tiền',
      createdat: 'Ngày tạo',
    },
    invoices: {
      invoiceid: 'Mã hóa đơn',
      roomid: 'Mã phòng',
      roomcode: 'Phòng',
      contractid: 'Mã hợp đồng',
      invoicetype: 'Loại hóa đơn',
      billingmonth: 'Tháng',
      fromdate: 'Từ ngày',
      todate: 'Đến ngày',
      roomfee: 'Tiền phòng',
      electricityfee: 'Tiền điện',
      waterfee: 'Tiền nước',
      trashfee: 'Tiền rác',
      extrafee: 'Phí phát sinh',
      extrafeenote: 'Ghi chú phí phát sinh',
      discountamount: 'Giảm trừ',
      debtamount: 'Nợ cũ',
      recognizedrevenue: 'Doanh thu ghi nhận',
      totalamount: 'Tổng tiền',
      status: 'Trạng thái thanh toán',
      paymentcode: 'Mã thanh toán',
      paidat: 'Thời gian thanh toán',
      paidamount: 'Số tiền đã thanh toán',
      paymentmethod: 'Phương thức thanh toán',
      paymentreference: 'Mã tham chiếu',
      note: 'Ghi chú',
      createdat: 'Ngày tạo',
      tenantname: 'Tên người thuê',
      defaultdiscountamount: 'Giảm trừ mặc định',
      defaultdebtamount: 'Nợ cũ mặc định',
    },
  }

  const common = {
    roomselector: 'Mã phòng',
    contractid: 'Mã hợp đồng',
    roomid: 'Mã phòng',
    roomcode: 'Mã phòng',
    invoiceid: 'Mã hóa đơn',
    invoicetype: 'Loại hóa đơn',
    billingmonth: 'Tháng',
    fromdate: 'Từ ngày',
    todate: 'Đến ngày',
    roomfee: 'Tiền phòng',
    electricityfee: 'Tiền điện',
    waterfee: 'Tiền nước',
    trashfee: 'Tiền rác',
    discountamount: 'Giảm trừ',
    debtamount: 'Nợ cũ',
    recognizedrevenue: 'Doanh thu ghi nhận',
    totalamount: 'Tổng tiền',
    paymentcode: 'Mã thanh toán',
    paidat: 'Thời gian thanh toán',
    paidamount: 'Số tiền đã thanh toán',
    paymentmethod: 'Phương thức thanh toán',
    paymentreference: 'Mã tham chiếu',
    note: 'Ghi chú',
    tenantid: 'Mã người thuê',
    tenantname: 'Tên người thuê',
    fullname: 'Họ và tên',
    phone: 'Số điện thoại',
    cccd: 'Căn cước công dân',
    startdate: 'Ngày bắt đầu',
    expectedenddate: 'Ngày kết thúc dự kiến',
    actualenddate: 'Ngày kết thúc thực tế',
    depositamount: 'Tiền đặt cọc',
    occupantcount: 'Số khách',
    actualroomprice: 'Giá phòng thực tế',
    status: 'Trạng thái',
    createdat: 'Ngày tạo',
    updatedat: 'Ngày cập nhật',
  }

  return map[moduleKey]?.[normalizedField] || common[normalizedField] || tenDep(field)
}

function laDanhSachPhong(moduleKey, method, path) {
  return moduleKey === 'rooms' && method === 'get' && path.toLowerCase() === '/api/rooms'
}

function laDanhSachHopDong(moduleKey, method, path) {
  return moduleKey === 'contracts' && method === 'get' && path.toLowerCase() === '/api/contracts'
}

function laDanhSachHoaDon(moduleKey, method, path) {
  return moduleKey === 'invoices' && method === 'get' && path.toLowerCase() === '/api/invoices'
}

function nenHienThiEndpoint(moduleKey, method, path) {
  const normalizedPath = path.toLowerCase()

  if (
    moduleKey === 'rooms' &&
    method === 'get' &&
    normalizedPath.startsWith('/api/rooms/')
  ) {
    return false
  }

  if (
    moduleKey === 'tenants' &&
    method === 'get' &&
    normalizedPath.startsWith('/api/tenants/') &&
    normalizedPath.includes('{')
  ) {
    return false
  }

  if (moduleKey === 'invoices') {
    const allowedInvoiceEndpoints = new Set([
      'get /api/invoices',
      'get /api/invoices/{id:int}',
      'get /api/invoices/{id}',
      // 'get /api/invoices/by-room-and-month',
      'patch /api/invoices/{id:int}/mark-paid',
      'patch /api/invoices/{id}/mark-paid',
      'patch /api/invoices/{id:int}/mark-unpaid',
      'patch /api/invoices/{id}/mark-unpaid',
      'post /api/invoices/monthly-bulk-preview',
      'post /api/invoices/monthly-bulk',
    ])

    return allowedInvoiceEndpoints.has(`${method} ${normalizedPath}`)
  }

  if (moduleKey === 'contracts') {
    if (method === 'get' && normalizedPath === '/api/contracts/active-by-room/{roomcode}') {
      return false
    }

    if (
      method === 'get' &&
      normalizedPath.startsWith('/api/contracts/') &&
      normalizedPath.includes('{') &&
      !normalizedPath.includes('/end-preview')
    ) {
      return false
    }

    if (
      method === 'post' &&
      !normalizedPath.includes('/end-preview') && normalizedPath.includes('/end')
    ) {
      return false
    }
  }

  if (moduleKey === 'payments' && method === 'post' && normalizedPath === '/api/payments/sepay/webhook') {
    return false
  }

  return true
}

function sapXepEndpoint(moduleKey, a, b) {
  if (moduleKey === 'invoices') {
    const order = {
      'get /api/invoices': 0,
      'get /api/invoices/by-room-and-month': 1,
      'get /api/invoices/{id:int}': 2,
      'get /api/invoices/{id}': 2,
      'patch /api/invoices/{id:int}/mark-paid': 3,
      'patch /api/invoices/{id}/mark-paid': 3,
      'patch /api/invoices/{id:int}/mark-unpaid': 4,
      'patch /api/invoices/{id}/mark-unpaid': 4,
      'post /api/invoices/monthly-bulk-preview': 5,
      'post /api/invoices/monthly-bulk': 6,
    }

    const keyA = `${a.method.toLowerCase()} ${a.path.toLowerCase()}`
    const keyB = `${b.method.toLowerCase()} ${b.path.toLowerCase()}`
    const rankA = Object.prototype.hasOwnProperty.call(order, keyA) ? order[keyA] : 99
    const rankB = Object.prototype.hasOwnProperty.call(order, keyB) ? order[keyB] : 99

    if (rankA !== rankB) return rankA - rankB
    if (a.method !== b.method) return METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method)
    return a.path.localeCompare(b.path)
  }

  if (moduleKey === 'contracts') {
    const order = {
      'get /api/contracts': 0,
      'post /api/contracts': 1,
      'put /api/contracts/{id:int}': 2,
      'put /api/contracts/{id}': 2,
      'post /api/contracts/{id:int}/end-preview': 3,
      'post /api/contracts/{id}/end-preview': 3,
      'post /api/contracts/{id:int}/end': 4,
      'post /api/contracts/{id}/end': 4,
      'delete /api/contracts/{id:int}': 5,
      'delete /api/contracts/{id}': 5,
    }

    const keyA = `${a.method.toLowerCase()} ${a.path.toLowerCase()}`
    const keyB = `${b.method.toLowerCase()} ${b.path.toLowerCase()}`
    const rankA = Object.prototype.hasOwnProperty.call(order, keyA) ? order[keyA] : 99
    const rankB = Object.prototype.hasOwnProperty.call(order, keyB) ? order[keyB] : 99

    if (rankA !== rankB) return rankA - rankB
    if (a.method !== b.method) return METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method)
    return a.path.localeCompare(b.path)
  }

  if (moduleKey !== 'rooms') return 0

  const order = {
    'post /api/rooms': 0,
    'put /api/rooms/{id:int}': 1,
    'put /api/rooms/{id}': 1,
    'patch /api/rooms/{id:int}/status': 2,
    'patch /api/rooms/{id}/status': 2,
    'get /api/rooms': 3,
    'get /api/rooms/by-code/{roomcode}': 4,
  }

  const keyA = `${a.method.toLowerCase()} ${a.path.toLowerCase()}`
  const keyB = `${b.method.toLowerCase()} ${b.path.toLowerCase()}`
  const rankA = Object.prototype.hasOwnProperty.call(order, keyA) ? order[keyA] : 99
  const rankB = Object.prototype.hasOwnProperty.call(order, keyB) ? order[keyB] : 99

  if (rankA !== rankB) return rankA - rankB
  if (a.method !== b.method) return METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method)
  return a.path.localeCompare(b.path)
}

function laGiaTriDon(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
}

function nhanKieu(value) {
  if (Array.isArray(value)) return `Danh sách ${value.length} mục`
  if (value === null) return 'Giá trị rỗng'
  if (typeof value === 'object') return `${Object.keys(value).length} trường dữ liệu`
  if (typeof value === 'boolean') return value ? 'Đúng' : 'Sai'
  return typeof value
}

function laFieldTien(field = '') {
  const normalized = String(field || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  const moneyFields = new Set([
    'listedprice',
    'depositamount',
    'actualroomprice',
    'price',
    'amount',
    'totalamount',
    'subtotal',
    'unitprice',
    'monthlyrent',
    'electricitycost',
    'watercost',
    'servicefee',
    'otherfee',
    'penaltyamount',
    'paidamount',
    'finalinvoiceamount',
    'deductedamount',
    'refundedamount',
    'remainingamount',
    'revenue',
    'expense',
    'profit',
    'roomfee',
    'electricityfee',
    'waterfee',
    'trashfee',
    'discountamount',
    'debtamount',
    'defaultdiscountamount',
    'defaultdebtamount',
    'transferamount',
  ])

  return moneyFields.has(normalized)
}

function tachGiaTriTienNhap(value) {
  if (value === null || value === undefined || value === '') return ''

  if (typeof value === 'number') {
    return String(Math.round(value))
  }

  const rawText = String(value ?? '').trim()
  if (!rawText) return ''

  const normalized = rawText.replace(/\s|VND/gi, '')
  const hasComma = normalized.includes(',')
  const hasDot = normalized.includes('.')
  const decimalMatch = normalized.match(/^(\d+)([.,])(\d{1,2})$/)

  if (hasComma && hasDot) {
    const decimalSeparator = hasComma ? ',' : '.'
    const thousandSeparator = decimalSeparator === ',' ? '.' : ','
    const withoutThousands = normalized.split(thousandSeparator).join('')
    const decimalAsDot = withoutThousands.replace(decimalSeparator, '.')
    const parsed = Number.parseFloat(decimalAsDot)
    if (Number.isFinite(parsed)) {
      return String(Math.round(parsed))
    }
  }

  if (decimalMatch) {
    const parsed = Number.parseFloat(`${decimalMatch[1]}.${decimalMatch[3]}`)
    if (Number.isFinite(parsed)) {
      const wholePart = Number.parseInt(decimalMatch[1], 10)
      if (Number.isFinite(wholePart) && wholePart >= 0 && wholePart < 1000) {
        return String(Math.round(parsed * 1000000))
      }
      return String(Math.round(parsed))
    }
  }

  return normalized.replace(/[^\d]/g, '')
}

function dinhDangTienKhongDonVi(value) {
  if (value === null || value === undefined || value === '') return ''

  const raw = tachGiaTriTienNhap(value)
  if (!raw) return ''

  return new Intl.NumberFormat('vi-VN').format(Number(raw))
}

function laCuPhapTienRutGon(value) {
  return /^\d+[.,]\d{1,2}$/.test(String(value ?? '').trim())
}

function chuanHoaTienKhiNhap(value) {
  if (laCuPhapTienRutGon(value)) {
    return String(value ?? '').trim()
  }

  return dinhDangTienKhongDonVi(value)
}

function chuyenTienVeSo(value) {
  if (value === null || value === undefined || value === '') return 0

  const raw = tachGiaTriTienNhap(value)
  if (!raw) return 0

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function laFieldNgay(field = '') {
  const normalized = String(field || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return new Set(['fromdate', 'todate', 'paidat', 'createdat', 'updatedat', 'startdate', 'expectedenddate', 'actualenddate']).has(
    normalized,
  )
}

function laFieldThang(field = '') {
  const normalized = String(field || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return normalized === 'month' || normalized.endsWith('month') || normalized === 'frommonth' || normalized === 'tomonth'
}

function chuyenNgayGioServer(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  const textValue = String(value).trim()
  if (!textValue) return null

  const coMuiGio = /(?:Z|[+-]\d{2}:\d{2})$/i.test(textValue)
  const normalizedValue = !coMuiGio && /^\d{4}-\d{2}-\d{2}T/.test(textValue)
    ? `${textValue}Z`
    : textValue

  const date = new Date(normalizedValue)
  return Number.isNaN(date.getTime()) ? null : date
}

function layMocThoiGian(value) {
  const date = chuyenNgayGioServer(value)
  return date ? date.getTime() : 0
}

function dinhDangNgay(value) {
  if (value === null || value === undefined || value === '') return 'Không có dữ liệu'

  const date = chuyenNgayGioServer(value)
  if (!date) return String(value)

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: MUI_GIO_VIET_NAM,
  }).format(date)
}

function dinhDangNgayGio(value) {
  if (value === null || value === undefined || value === '') return 'Không có dữ liệu'

  const date = chuyenNgayGioServer(value)
  if (!date) return String(value)

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: MUI_GIO_VIET_NAM,
  }).format(date)
}

function dinhDangThang(value) {
  if (value === null || value === undefined || value === '') return 'Không có dữ liệu'

  const textValue = String(value)
  const match = textValue.match(/^(\d{4})-(\d{2})/)
  if (!match) return textValue

  return `Tháng ${match[2]}/${match[1]}`
}

function taoGiaTriThangMacDinh(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function taoKhoangThangMacDinh() {
  const now = new Date()
  const month = now.getMonth() + 1

  if (month <= 6) {
    return {
      fromMonth: `${now.getFullYear()}-01`,
      toMonth: `${now.getFullYear()}-06`,
    }
  }

  return {
    fromMonth: `${now.getFullYear()}-07`,
    toMonth: `${now.getFullYear()}-12`,
  }
}

const DANH_SACH_THANG_KE_KHAI = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, '0'),
  label: `Tháng ${String(index + 1).padStart(2, '0')}`,
}))

function chuanHoaGiaTriThang(value) {
  if (!value) return ''
  return /^\d{4}-\d{2}$/.test(String(value)) ? `${value}-01` : String(value)
}

function tachGiaTriThang(value) {
  const normalized = String(value || '')
  const match = normalized.match(/^(\d{4})-(\d{2})/)

  if (!match) {
    const year = String(taoNamHienTai())
    return { year, month: '01' }
  }

  return {
    year: match[1],
    month: match[2],
  }
}

function taoDanhSachNamKeKhai(fromMonth, toMonth) {
  const currentYear = taoNamHienTai()
  const years = new Set([
    currentYear - 3,
    currentYear - 2,
    currentYear - 1,
    currentYear,
    currentYear + 1,
    currentYear + 2,
    Number(tachGiaTriThang(fromMonth).year),
    Number(tachGiaTriThang(toMonth).year),
  ])

  return [...years]
    .filter((year) => Number.isFinite(year))
    .sort((left, right) => left - right)
    .map((year) => String(year))
}

function capNhatGiaTriThang(value, nextPart) {
  const current = tachGiaTriThang(value)
  const nextYear = nextPart.year ?? current.year
  const nextMonth = nextPart.month ?? current.month
  return `${nextYear}-${nextMonth}`
}

function taoDanhSachNamChon(value, selectedYear = '') {
  const currentYear = taoNamHienTai()
  const valueYear = Number(tachGiaTriThang(value).year)
  const draftYear = Number(selectedYear)
  const years = new Set([
    currentYear - 3,
    currentYear - 2,
    currentYear - 1,
    currentYear,
    currentYear + 1,
    currentYear + 2,
    valueYear,
    draftYear,
  ])

  return Array.from(years)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .map(String)
}

function MonthYearFilter({ label, value, onChange, allowEmpty = true }) {
  const parts = value ? tachGiaTriThang(value) : { month: '', year: '' }
  const [draftMonth, setDraftMonth] = useState(parts.month)
  const [draftYear, setDraftYear] = useState(parts.year)
  const yearOptions = taoDanhSachNamChon(value, draftYear)

  useEffect(() => {
    if (value) {
      const nextParts = tachGiaTriThang(value)
      setDraftMonth(nextParts.month)
      setDraftYear(nextParts.year)
    } else if (!allowEmpty) {
      const nextParts = tachGiaTriThang(taoGiaTriThangMacDinh())
      setDraftMonth(nextParts.month)
      setDraftYear(nextParts.year)
      onChange(`${nextParts.year}-${nextParts.month}`)
    }
  }, [allowEmpty, onChange, value])

  const updateValue = ({ month = draftMonth, year = draftYear }) => {
    setDraftMonth(month)
    setDraftYear(year)

    if (!month || !year) {
      onChange('')
      return
    }

    onChange(`${year}-${month}`)
  }

  return (
    <label className="invoice-search invoice-search--month">
      <span>{label}</span>
      <div className="month-year-filter">
        <select
          value={draftMonth}
          onChange={(event) => updateValue({ month: event.target.value })}
        >
          {allowEmpty ? <option value="">Chọn tháng</option> : null}
          {DANH_SACH_THANG_KE_KHAI.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          value={draftYear}
          onChange={(event) => updateValue({ year: event.target.value })}
        >
          {allowEmpty ? <option value="">Chọn năm</option> : null}
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              Năm {year}
            </option>
          ))}
        </select>
      </div>
    </label>
  )
}

function dinhDangKyKeKhaiSauThang(fromMonth, toMonth) {
  if (!fromMonth || !toMonth) return ''
  return `${dinhDangThang(chuanHoaGiaTriThang(fromMonth))} đến ${dinhDangThang(chuanHoaGiaTriThang(toMonth))}`
}

function dinhDangLoaiHoaDon(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (normalized === 'monthly') return 'Hóa đơn tháng'
  if (normalized === 'final') return 'Hóa đơn chốt'
  return value || 'Không có dữ liệu'
}

function dinhDangTien(value) {
  if (value === null || value === undefined || value === '') return 'Không có dữ liệu'

  const number =
    typeof value === 'number'
      ? value
      : Number.parseFloat(String(value).replace(/\./g, '').replace(/,/g, ''))

  if (Number.isNaN(number)) return String(value)

  return `${new Intl.NumberFormat('vi-VN').format(number)} VND`
}

function giaTriDep(value, field = '') {
  if (value === null || value === undefined || value === '') return 'Không có dữ liệu'
  if (typeof value === 'boolean') return value ? 'Đúng' : 'Sai'

  const normalizedField = String(field || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

  if (laFieldThang(field)) return dinhDangThang(value)
  if (laFieldNgay(field)) return dinhDangNgay(value)
  if (normalizedField === 'status') {
    const normalized = String(value || '').trim().toLowerCase()

    if (normalized === 'paid') return 'Đã thanh toán'
    if (normalized === 'unpaid') return 'Chưa thanh toán'
    if (normalized === 'active') return 'Còn hiệu lực'
    if (normalized === 'ended') return 'Hết hạn'

    return value || 'Không có dữ liệu'
  }
  if (normalizedField === 'invoicetype') return dinhDangLoaiHoaDon(value)
  if (laFieldTien(field)) return dinhDangTien(value)
  return String(value)
}

function laHopDongConHieuLuc(contract) {
  const status = String(contract?.status ?? contract?.Status ?? '')
    .trim()
    .toLowerCase()

  return status !== 'ended'
}

function trangThaiHopDongClass(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'active' || normalized.includes('còn') || normalized.includes('con')) {
    return 'active'
  }
  if (normalized === 'ended' || normalized.includes('hết') || normalized.includes('het')) {
    return 'ended'
  }
  return ''
}

function XemDuLieu({ title, data, emptyText = 'Chưa có dữ liệu.' }) {
  if (data === undefined || data === null || data === '') {
    return <div className="khung-du-lieu khung-du-lieu--trong">{emptyText}</div>
  }

  if (Array.isArray(data)) {
    if (!data.length) {
      return <div className="khung-du-lieu khung-du-lieu--trong">{emptyText}</div>
    }

    const primitiveArray = data.every((item) => laGiaTriDon(item))
    if (primitiveArray) {
      return (
        <div className="khung-du-lieu">
          <div className="chip-wrap">
            {data.map((item, index) => (
              <span key={`${title || 'value'}-${index}`} className="chip">
                {giaTriDep(item, title)}
              </span>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="khung-du-lieu danh-sach-ban-ghi">
        {data.map((item, index) => {
          const roomCode = item.roomCode ?? item.RoomCode
          const headerLabel = roomCode ? `Mã phòng: ${roomCode}` : `Mục ${index + 1}`
          return (
            <section key={`${title || 'item'}-${index}`} className="ban-ghi">
              <header className="ban-ghi__dau">
                <strong className={roomCode ? 'ban-ghi__dau-noi-bat' : ''}>{headerLabel}</strong>
                <span>{nhanKieu(item)}</span>
              </header>
              <XemDuLieu data={item} />
            </section>
          )
        })}
      </div>
    )
  }

  if (typeof data === 'object') {
    const hiddenFields = new Set([
      'roomid',
      'contractid',
      'createdat',
      'updatedat',
      'tenantid',
    ])
    const entries = Object.entries(data).filter(([key]) => !hiddenFields.has(key.toLowerCase()))
    return (
      <div className="khung-du-lieu">
        {title ? (
          <div className="ban-ghi__dau">
            <strong>{tenDep(title)}</strong>
            <span>{nhanKieu(data)}</span>
          </div>
        ) : null}
        <div className="ban-ghi-row">
          {entries.map(([key, value]) => {
            const normalizedKey = String(key || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

            const laTruongNoiBat = new Set([
              'roomcode',
              'tenantname',
              'actualroomprice',
              'depositamount',
            ]).has(normalizedKey)

            const laTrangThaiHopDong = normalizedKey === 'status'
            const statusValue = String(value || '').trim().toLowerCase()

            let statusClass = ''
            if (laTrangThaiHopDong) {
              if (statusValue === 'active') statusClass = 'trang-thai-hop-dong trang-thai-hop-dong--active'
              else if (statusValue === 'ended') statusClass = 'trang-thai-hop-dong trang-thai-hop-dong--ended'
            }

            return (
              <div key={key} className="ban-ghi__field">
                <span>{nhanTruong('', '', key)}</span>
                {laGiaTriDon(value) ? (
                  <strong className={`${laTruongNoiBat ? 'gia-tri-noi-bat' : ''} ${statusClass}`.trim()}>
                    {laTruongNoiBat ? '★ ' : ''}
                    {giaTriDep(value, key)}
                  </strong>
                ) : (
                  <XemDuLieu title={key} data={value} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return <div className="khung-du-lieu gia-tri-don">{giaTriDep(data, title)}</div>
}

function trangThaiPhong(value) {
  const status = String(value || '').toLowerCase()
  if (status === 'occupied') {
    return { label: 'Đã cho thuê', css: 'da-cho-thue' }
  }
  if (status === 'vacant') {
    return { label: 'Chưa cho thuê', css: 'chua-cho-thue' }
  }
  return { label: value || 'Chưa rõ', css: 'mac-dinh' }
}

function XemDanhSachPhong({ data, hideSearch = false, initialSearch = '' }) {
  const [search, setSearch] = useState(initialSearch)

  if (!Array.isArray(data) || !data.length) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Không có phòng nào.</div>
  }

  const filtered = [...data]
    .sort((a, b) => soSanhMaPhong(a.roomCode ?? a.RoomCode, b.roomCode ?? b.RoomCode))
    .filter((room) =>
      !search.trim() ||
      String(room.roomCode ?? room.RoomCode ?? '')
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    )

  return (
    <div className="danh-sach-phong-wrap">
      {!hideSearch ? (
        <div className="bo-loc-hop-dong" style={{ marginBottom: '12px' }}>
          <label className="truong">
            <span>Tìm theo mã phòng</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nhập mã phòng, ví dụ: A01"
            />
          </label>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="khung-du-lieu khung-du-lieu--trong">Không tìm thấy phòng phù hợp.</div>
      ) : (
        <div className="danh-sach-phong">
          {filtered.map((room, index) => {
            const status = trangThaiPhong(room.status ?? room.Status)
            return (
              <div key={`${room.roomCode || room.RoomCode || 'room'}-${index}`} className="dong-phong invoice-card">
                <div className="dong-phong__o">
                  <span>Mã phòng</span>
                  <strong>{room.roomCode ?? room.RoomCode ?? 'Không có dữ liệu'}</strong>
                </div>
                <div className="dong-phong__o">
                  <span>Giá phòng</span>
                  <strong>{giaTriDep(room.listedPrice ?? room.ListedPrice, 'listedPrice')}</strong>
                </div>
                <div className="dong-phong__o">
                  <span>Tình trạng phòng</span>
                  <strong className={`trang-thai-phong trang-thai-phong--${status.css}`}>{status.label}</strong>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function laDuLieuPhong(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return 'roomCode' in value || 'listedPrice' in value || 'status' in value || 'RoomCode' in value
}

function XemPhong({ data }) {
  if (!data) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Chưa có phản hồi từ máy chủ.</div>
  }

  if (Array.isArray(data)) {
    return <XemDanhSachPhong data={data} />
  }

  const roomCode = data.roomCode ?? data.RoomCode
  const listedPrice = data.listedPrice ?? data.ListedPrice
  const statusValue = data.status ?? data.Status
  const status = trangThaiPhong(statusValue)

  return (
    <div className="danh-sach-phong">
      <div className="dong-phong">
        <div className="dong-phong__o">
          <span>Mã phòng</span>
          <strong>{roomCode || 'Không có dữ liệu'}</strong>
        </div>
        <div className="dong-phong__o">
          <span>Giá phòng</span>
          <strong>{giaTriDep(listedPrice, 'listedPrice')}</strong>
        </div>
        <div className="dong-phong__o">
          <span>Tình trạng phòng</span>
          <strong className={`trang-thai-phong trang-thai-phong--${status.css}`}>{status.label}</strong>
        </div>
      </div>
    </div>
  )
}

function laDuLieuNguoiThue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return 'fullName' in value || 'phone' in value || 'cccd' in value || 'FullName' in value
}

function laDuLieuHoaDon(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  return (
    'invoiceId' in value ||
    'InvoiceId' in value ||
    'billingMonth' in value ||
    'BillingMonth' in value ||
    'totalAmount' in value ||
    'TotalAmount' in value
  )
}

function laDuLieuHopDong(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  return (
    'contractId' in value ||
    'ContractId' in value ||
    'tenantName' in value ||
    'TenantName' in value ||
    'expectedEndDate' in value ||
    'ExpectedEndDate' in value
  )
}

function XemDanhSachHopDong({ data, hideFilters = false, initialSearch = '', initialStatus = 'all' }) {
  const [searchText, setSearchText] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [popupContract, setPopupContract] = useState(null)
  if (!Array.isArray(data) || !data.length) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Không có hợp đồng nào.</div>
  }

  const normalizedSearch = searchText.trim().toLowerCase()
  const filteredContracts = data.filter((contract) => {
    const status = String(contract.status ?? contract.Status ?? '').trim().toLowerCase()
    const roomCode = String(contract.roomCode ?? contract.RoomCode ?? '').trim().toLowerCase()
    const tenantName = String(contract.tenantName ?? contract.TenantName ?? '').trim().toLowerCase()
    const contractId = String(contract.contractId ?? contract.ContractId ?? '').trim().toLowerCase()

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && status === 'active') ||
      (statusFilter === 'ended' && status === 'ended')

    const matchesSearch =
      !normalizedSearch ||
      roomCode.includes(normalizedSearch) ||
      tenantName.includes(normalizedSearch) ||
      contractId.includes(normalizedSearch)

    return matchesStatus && matchesSearch
  })

  return (
    <div className="danh-sach-hop-dong-wrap">
      {!hideFilters ? (
        <div className="bo-loc-hop-dong">
          <label className="truong">
            <span>Tìm hợp đồng</span>
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Tìm theo mã phòng, người thuê hoặc mã hợp đồng"
            />
          </label>
          <label className="truong">
            <span>Lọc trạng thái</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Còn hiệu lực</option>
              <option value="ended">Hết hạn</option>
            </select>
          </label>
        </div>
      ) : null}

      {!filteredContracts.length ? (
        <div className="khung-du-lieu khung-du-lieu--trong">Không có hợp đồng phù hợp với bộ lọc.</div>
      ) : (
        <div className="danh-sach-phong">
          {filteredContracts.map((contract, index) => {
            const contractId = contract.contractId ?? contract.ContractId ?? index
            const roomCode = contract.roomCode ?? contract.RoomCode
            const tenantName = contract.tenantName ?? contract.TenantName
            const status = contract.status ?? contract.Status

            return (
              <div key={contractId} className="hop-dong-item">
                <div className="dong-phong dong-phong--hop-dong">
                  <div className="dong-phong__o">
                    <span>Mã phòng</span>
                    <strong>{roomCode || 'Không có dữ liệu'}</strong>
                  </div>
                  <div className="dong-phong__o">
                    <span>Người thuê</span>
                    <strong>{tenantName || 'Không có dữ liệu'}</strong>
                  </div>
                  <div className="dong-phong__o">
                    <span>Trạng thái</span>
                    <strong className={`trang-thai-hop-dong ${trangThaiHopDongClass(status) ? `trang-thai-hop-dong--${trangThaiHopDongClass(status)}` : ''}`.trim()}>
                      {giaTriDep(status, 'status')}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="nut nut--phu nut-hop-dong"
                  onClick={() => setPopupContract(contract)}
                >
                  Xem chi tiết
                </button>

                {popupContract ? (
                  <div className="lop-phu-endpoint" onClick={() => setPopupContract(null)}>
                    <div className="hop-endpoint-mo" onClick={(e) => e.stopPropagation()}>
                      <div className="the-endpoint the-endpoint--mo">
                        <div className="the-endpoint__dau">
                          <h3>Chi tiết hợp đồng</h3>
                          <button
                            type="button"
                            className="nut-dong-endpoint"
                            onClick={() => setPopupContract(null)}
                          >
                            ×
                          </button>
                        </div>
                        <XemHopDong data={popupContract} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function XemHopDong({ data, hienThiSoTienPhaiDong = false }) {
  if (!data) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Chưa có dữ liệu.</div>
  }

  if (Array.isArray(data)) {
    return <XemDanhSachHopDong data={data} />
  }

  const hiddenFields = new Set(['contractid', 'roomid', 'tenantid', 'createdat', 'updatedat'])
  const entries = Object.entries(data).filter(([key]) => !hiddenFields.has(key.toLowerCase()))

  const finalInvoice = Number(data.finalInvoiceAmount ?? data.FinalInvoiceAmount ?? 0)
  const deposit = Number(data.depositAmount ?? data.DepositAmount ?? 0)
  const deductedAmount = Number(data.deductedAmount ?? data.DeductedAmount ?? 0)
  const refundedAmount = Number(data.refundedAmount ?? data.RefundedAmount ?? 0)
  const remainingAmount = Number(data.remainingAmount ?? data.RemainingAmount ?? Math.max(finalInvoice - deductedAmount, 0))
  const coQuyetToan =
    'finalInvoiceAmount' in data ||
    'FinalInvoiceAmount' in data ||
    'deductedAmount' in data ||
    'DeductedAmount' in data ||
    'refundedAmount' in data ||
    'RefundedAmount' in data ||
    'remainingAmount' in data ||
    'RemainingAmount' in data

  return (
    <div className="danh-sach-phong">
      <div className="dong-phong dong-phong--nguoi-thue">
        {entries.map(([key, value]) => {
          const normalizedKey = String(key).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
          const laHoanTra = normalizedKey === 'refundedamount'

          return (
            <div key={key} className="dong-phong__o">
              <span>{nhanTruong('contracts', '', key)}</span>
              <strong
                className={String(key).toLowerCase() === 'status' ? `trang-thai-hop-dong ${trangThaiHopDongClass(value) ? `trang-thai-hop-dong--${trangThaiHopDongClass(value)}` : ''}`.trim() : ''}
                style={laHoanTra ? { color: '#16a34a' } : undefined}
              >
                {giaTriDep(value, key)}
              </strong>
            </div>
          )
        })}

        {hienThiSoTienPhaiDong && finalInvoice > deposit ? (
          <div className="dong-phong__o">
            <span>Số tiền phải đóng thêm</span>
            <strong style={{ color: '#dc2626' }}>
              {dinhDangTien(remainingAmount)}
            </strong>
          </div>
        ) : null}
      </div>

      {coQuyetToan ? (
        <div className="contract-settlement">
          <div className="contract-settlement__item">
            <span>Tổng phí tháng chốt</span>
            <strong>{dinhDangTien(finalInvoice)}</strong>
          </div>
          <div className="contract-settlement__item">
            <span>Tiền cọc đã cấn trừ</span>
            <strong>{dinhDangTien(deductedAmount)}</strong>
          </div>
          <div className="contract-settlement__item contract-settlement__item--refund">
            <span>Tiền hoàn lại khách</span>
            <strong>{dinhDangTien(refundedAmount)}</strong>
          </div>
          <div className={`contract-settlement__item ${remainingAmount > 0 ? 'contract-settlement__item--due' : 'contract-settlement__item--done'}`}>
            <span>{remainingAmount > 0 ? 'Khách còn phải thanh toán' : 'Đã tất toán bằng tiền cọc'}</span>
            <strong>{remainingAmount > 0 ? dinhDangTien(remainingAmount) : 'Không phát sinh thêm'}</strong>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// Component danh sách hóa đơn có nút mark-paid / mark-unpaid
function XemDanhSachHoaDonCoNut({ data, onReload }) {
  const [dangXuLy, setDangXuLy] = useState({})
  const [thongBao, setThongBao] = useState({})
  const [chiTietHoaDon, setChiTietHoaDon] = useState({})
  const [dangTaiChiTiet, setDangTaiChiTiet] = useState({})
  const [dangTaiPdf, setDangTaiPdf] = useState({})
  const [dangXoa, setDangXoa] = useState({})
  const [dangLuuSua, setDangLuuSua] = useState({})
  const [modalHoaDon, setModalHoaDon] = useState(null)
  const [duLieuSua, setDuLieuSua] = useState({})
  const [xacNhanThanhToan, setXacNhanThanhToan] = useState(null)

  useEffect(() => {
    if (!modalHoaDon) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setModalHoaDon(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [modalHoaDon])

  if (!Array.isArray(data) || !data.length) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Không có hóa đơn nào.</div>
  }

  const layInvoiceId = (invoice, fallback = '') => invoice?.invoiceId ?? invoice?.InvoiceId ?? fallback

  const taiChiTietHoaDon = async (invoiceId) => {
    setDangTaiChiTiet((prev) => ({ ...prev, [invoiceId]: true }))
    setThongBao((prev) => ({ ...prev, [invoiceId]: null }))
    try {
      const result = await guiRequest(`/api/Invoices/${invoiceId}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      setChiTietHoaDon((prev) => ({ ...prev, [invoiceId]: result.payload }))
      return result.payload
    } catch (err) {
      setThongBao((prev) => ({ ...prev, [invoiceId]: { ok: false, text: err.message } }))
      throw err
    } finally {
      setDangTaiChiTiet((prev) => ({ ...prev, [invoiceId]: false }))
    }
  }

  const moModalChiTiet = async (invoice) => {
    const invoiceId = layInvoiceId(invoice)
    setModalHoaDon({ id: invoiceId, mode: 'detail' })
    if (!chiTietHoaDon[invoiceId]) {
      try {
        await taiChiTietHoaDon(invoiceId)
      } catch {
        return
      }
    }
  }

  const moModalSua = async (invoice) => {
    const invoiceId = layInvoiceId(invoice)
    setModalHoaDon({ id: invoiceId, mode: 'edit' })
    try {
      const detail = chiTietHoaDon[invoiceId] || (await taiChiTietHoaDon(invoiceId))
      setDuLieuSua((prev) => ({ ...prev, [invoiceId]: { ...detail } }))
    } catch {
      return
    }
  }

  const capNhatDuLieuSua = (invoiceId, field, value) => {
    setDuLieuSua((prev) => ({
      ...prev,
      [invoiceId]: {
        ...(prev[invoiceId] || {}),
        [field]: value,
      },
    }))
  }

  const moThanhToanTienMat = (invoice) => {
    const invoiceId = layInvoiceId(invoice)
    const totalAmount = Number(invoice.totalAmount ?? invoice.TotalAmount ?? 0)
    const paidAmount = Number(invoice.paidAmount ?? invoice.PaidAmount ?? 0)

    setXacNhanThanhToan({
      invoiceId,
      roomCode: invoice.roomCode ?? invoice.RoomCode ?? '',
      totalAmount,
      amount: dinhDangTienKhongDonVi(totalAmount),
      note: paidAmount > 0 && paidAmount < totalAmount
        ? `Khách đã thanh toán trước ${dinhDangTien(paidAmount)}.`
        : '',
    })
  }

  const xacNhanThanhToanTienMat = async () => {
    const invoiceId = xacNhanThanhToan?.invoiceId
    if (!invoiceId) return

    const amount = chuyenTienVeSo(xacNhanThanhToan.amount ?? 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      setThongBao((prev) => ({
        ...prev,
        [invoiceId]: { ok: false, text: 'Số tiền thực thu phải lớn hơn 0.' },
      }))
      return
    }

    setDangXuLy((prev) => ({ ...prev, [invoiceId]: true }))
    setThongBao((prev) => ({ ...prev, [invoiceId]: null }))

    try {
      await guiRequest(`/api/Invoices/${invoiceId}/mark-paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          amount,
          paymentMethod: 'Tiền mặt',
          note: xacNhanThanhToan.note ?? '',
        }),
      })

      setThongBao((prev) => ({
        ...prev,
        [invoiceId]: { ok: true, text: 'Đã ghi nhận thanh toán tiền mặt.' },
      }))
      setXacNhanThanhToan(null)
      if (onReload) onReload()
    } catch (err) {
      setThongBao((prev) => ({
        ...prev,
        [invoiceId]: { ok: false, text: thongDiepLoi(err) },
      }))
    } finally {
      setDangXuLy((prev) => ({ ...prev, [invoiceId]: false }))
    }
  }

  const luuChinhSua = async (invoiceId) => {
    const payload = duLieuSua[invoiceId]
    if (!payload) return

    setDangLuuSua((prev) => ({ ...prev, [invoiceId]: true }))
    setThongBao((prev) => ({ ...prev, [invoiceId]: null }))
    const updatePayload = {
      roomFee: chuyenTienVeSo(payload.roomFee ?? payload.RoomFee ?? 0),
      electricityFee: chuyenTienVeSo(payload.electricityFee ?? payload.ElectricityFee ?? 0),
      waterFee: chuyenTienVeSo(payload.waterFee ?? payload.WaterFee ?? 0),
      trashFee: chuyenTienVeSo(payload.trashFee ?? payload.TrashFee ?? 0),
      discountAmount: chuyenTienVeSo(payload.discountAmount ?? payload.DiscountAmount ?? 0),
      debtAmount: chuyenTienVeSo(payload.debtAmount ?? payload.DebtAmount ?? 0),
      note: payload.note ?? payload.Note ?? null,
    }

    try {
      const result = await guiRequest(`/api/Invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain' },
        body: JSON.stringify(updatePayload),
      })
      setChiTietHoaDon((prev) => ({ ...prev, [invoiceId]: result.payload }))
      setDuLieuSua((prev) => ({ ...prev, [invoiceId]: result.payload }))
      setThongBao((prev) => ({ ...prev, [invoiceId]: { ok: true, text: 'Cập nhật hóa đơn thành công' } }))
      setModalHoaDon({ id: invoiceId, mode: 'detail' })
      if (onReload) onReload()
    } catch (err) {
      setThongBao((prev) => ({ ...prev, [invoiceId]: { ok: false, text: err.message } }))
    } finally {
      setDangLuuSua((prev) => ({ ...prev, [invoiceId]: false }))
    }
  }

  const taiPdfHoaDon = async (invoice) => {
    const invoiceId = layInvoiceId(invoice)
    setDangTaiPdf((prev) => ({ ...prev, [invoiceId]: true }))
    setThongBao((prev) => ({ ...prev, [invoiceId]: null }))

    try {
      await taiHoaDonPdf(invoice)
      setThongBao((prev) => ({ ...prev, [invoiceId]: { ok: true, text: 'Đã tải PDF hóa đơn.' } }))
    } catch (err) {
      setThongBao((prev) => ({ ...prev, [invoiceId]: { ok: false, text: thongDiepLoi(err) } }))
    } finally {
      setDangTaiPdf((prev) => ({ ...prev, [invoiceId]: false }))
    }
  }

  const xoaHoaDon = async (invoiceId) => {
    setDangXoa((prev) => ({ ...prev, [invoiceId]: true }))
    setThongBao((prev) => ({ ...prev, [invoiceId]: null }))
    try {
      const result = await guiRequest(`/api/Invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json, text/plain' },
      })
      const successMessage = typeof result.payload === 'string' && result.payload.trim() ? result.payload : 'Xóa hóa đơn thành công'
      setThongBao((prev) => ({ ...prev, [invoiceId]: { ok: true, text: successMessage } }))
      setChiTietHoaDon((prev) => {
        const next = { ...prev }
        delete next[invoiceId]
        return next
      })
      setDuLieuSua((prev) => {
        const next = { ...prev }
        delete next[invoiceId]
        return next
      })
      setModalHoaDon(null)
      if (onReload) onReload()
    } catch (err) {
      setThongBao((prev) => ({ ...prev, [invoiceId]: { ok: false, text: err.message } }))
    } finally {
      setDangXoa((prev) => ({ ...prev, [invoiceId]: false }))
    }
  }

  const modalInvoiceId = modalHoaDon?.id
  const modalMode = modalHoaDon?.mode
  const modalDetail = modalInvoiceId != null ? chiTietHoaDon[modalInvoiceId] : null
  const modalDraft = modalInvoiceId != null ? duLieuSua[modalInvoiceId] : null
  const modalDangTai = modalInvoiceId != null ? !!dangTaiChiTiet[modalInvoiceId] : false
  const modalDangTaiPdf = modalInvoiceId != null ? !!dangTaiPdf[modalInvoiceId] : false
  const modalDangXoa = modalInvoiceId != null ? !!dangXoa[modalInvoiceId] : false
  const modalDangLuu = modalInvoiceId != null ? !!dangLuuSua[modalInvoiceId] : false
  const modalThongBao = modalInvoiceId != null ? thongBao[modalInvoiceId] : null
  const editableFields = new Set(['roomfee', 'electricityfee', 'waterfee', 'trashfee', 'discountamount', 'debtamount', 'note'])

  return (
    <>
      <div className="danh-sach-phong">
        {data.map((invoice, index) => {
          const invoiceId = layInvoiceId(invoice, index)
          const roomCode = invoice.roomCode ?? invoice.RoomCode
          const roomId = invoice.roomId ?? invoice.RoomId
          const billingMonth = invoice.billingMonth ?? invoice.BillingMonth
          const totalAmount = invoice.totalAmount ?? invoice.TotalAmount
          const extraFee = layPhiPhatSinhHoaDon(invoice)
          const extraFeeNote = layGhiChuPhiPhatSinhHoaDon(invoice)
          const invoiceType = layLoaiHoaDon(invoice)
          const status = layTrangThaiHoaDon(invoice)
          const isPaid = status === 'paid'
          const isLoading = !!dangXuLy[invoiceId]
          const isDeleting = !!dangXoa[invoiceId]
          const msg = thongBao[invoiceId]

          return (
            <div key={invoiceId} className="dong-phong invoice-card">
              <div className="invoice-card__info">
                <div className="dong-phong__o invoice-card__meta-item">
                  <span>Phòng</span>
                  <strong>{roomCode || (roomId != null ? `Phòng #${roomId}` : 'Không có dữ liệu')}</strong>
                </div>
                <div className="dong-phong__o invoice-card__meta-item">
                  <span>Tháng</span>
                  <strong>{giaTriDep(billingMonth, 'billingMonth')}</strong>
                </div>
                <div className="dong-phong__o invoice-card__meta-item">
                  <span>Loại</span>
                  <strong>{giaTriDep(invoiceType, 'invoiceType')}</strong>
                </div>
                <div className="dong-phong__o invoice-card__amount">
                  <span>Tổng tiền</span>
                  <strong className={isPaid ? 'invoice-amount invoice-amount--paid' : 'invoice-amount invoice-amount--unpaid'}>
                    {giaTriDep(totalAmount, 'totalAmount')}
                  </strong>
                </div>
                <div className="dong-phong__o invoice-card__meta-item">
                  <span>Phí phát sinh</span>
                  <strong>{dinhDangTienKhongDonVi(extraFee) || '0'}</strong>
                </div>
                <div className="dong-phong__o invoice-card__meta-item transaction-description">
                  <span>Ghi chú phí phát sinh</span>
                  <strong>{extraFeeNote || 'Không có dữ liệu'}</strong>
                </div>
                <div className="dong-phong__o invoice-card__meta-item">
                  <span>Trạng thái</span>
                  <strong className={isPaid ? 'trang-thai-hop-dong trang-thai-hop-dong--active' : 'trang-thai-hop-dong trang-thai-hop-dong--ended'}>
                    {isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                  </strong>
                </div>
                <div className="invoice-card__button-row">
                  <button
                    type="button"
                    className="nut invoice-inline-button"
                    disabled={isDeleting || Boolean(dangTaiChiTiet[invoiceId])}
                    onClick={() => moModalChiTiet(invoice)}
                  >
                    {Boolean(dangTaiChiTiet[invoiceId]) ? 'Đang tải...' : 'Chi tiết'}
                  </button>
                  <button
                    type="button"
                    className="nut invoice-inline-button invoice-inline-button--secondary"
                    disabled={isDeleting || isLoading || Boolean(dangTaiPdf[invoiceId])}
                    onClick={() => taiPdfHoaDon(invoice)}
                  >
                    {Boolean(dangTaiPdf[invoiceId]) ? 'Đang tải PDF...' : 'Tải PDF'}
                  </button>
                  <button
                    type="button"
                    className="nut invoice-inline-button invoice-inline-button--secondary"
                    disabled={isDeleting || Boolean(dangLuuSua[invoiceId])}
                    onClick={() => moModalSua(invoice)}
                  >
                    {Boolean(dangLuuSua[invoiceId]) ? 'Đang lưu...' : 'Sửa'}
                  </button>
                  <button
                    type="button"
                    className="nut invoice-inline-button invoice-action-button invoice-action-button--paid"
                    disabled={isLoading || isPaid || isDeleting}
                    onClick={() => moThanhToanTienMat(invoice)}
                  >
                    Thanh toán
                  </button>
                  <button
                    type="button"
                    className="nut invoice-inline-button invoice-action-button invoice-action-button--unpaid"
                    disabled={isDeleting || isLoading}
                    onClick={() => xoaHoaDon(invoiceId)}
                  >
                    {isDeleting ? 'Đang xóa...' : 'Xóa'}
                  </button>
                </div>
                {msg ? (
                  <div className="invoice-inline-message" style={{ color: msg.ok ? '#16a34a' : '#dc2626' }}>
                    {msg.text}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {modalHoaDon ? (
        <div className="lop-phu-endpoint" onClick={() => setModalHoaDon(null)}>
          <div className="hop-endpoint-mo" onClick={(event) => event.stopPropagation()}>
            <article className="the-endpoint the-endpoint--mo invoice-modal-card">
              <div className="the-endpoint__dau">
                <div>
                  <span className="method-tag method-tag--get">{modalMode === 'edit' ? 'PUT' : 'GET'}</span>
                  <h3>{modalMode === 'edit' ? 'Sửa chi tiết hóa đơn' : 'Chi tiết hóa đơn'}</h3>
                </div>
                <button type="button" className="nut-dong-endpoint" onClick={() => setModalHoaDon(null)}>
                  x
                </button>
              </div>

              {modalDangTai ? (
                <div className="khung-du-lieu khung-du-lieu--trong">Đang tải chi tiết hóa đơn...</div>
              ) : modalMode === 'edit' ? (
                modalDraft ? (
                  <div className="invoice-edit-form">
                    {Object.entries(modalDraft)
                      .filter(([key, value]) => editableFields.has(String(key).toLowerCase()) && typeof value !== 'object')
                      .map(([key, value]) => (
                        <label key={key} className="truong">
                          <span>{nhanTruong('invoices', '', key)}</span>
                          <input
                            type={laFieldTien(key) ? 'text' : typeof value === 'number' ? 'number' : 'text'}
                            value={laFieldTien(key) ? dinhDangTienKhongDonVi(value) : value ?? ''}
                            onChange={(event) => {
                              const nextValue = laFieldTien(key)
                                ? chuanHoaTienKhiNhap(event.target.value)
                                : typeof value === 'number'
                                  ? Number(event.target.value)
                                  : event.target.value
                              capNhatDuLieuSua(modalInvoiceId, key, nextValue)
                            }}
                          />
                        </label>
                      ))}
                  </div>
                ) : (
                  <div className="khung-du-lieu khung-du-lieu--trong">Không tải được dữ liệu sửa hóa đơn.</div>
                )
              ) : modalDetail ? (
                <XemHoaDonChiTiet
                  data={modalDetail}
                  actions={
                    <button type="button" className="nut" disabled={modalDangTaiPdf} onClick={() => taiPdfHoaDon(modalDetail)}>
                      {modalDangTaiPdf ? 'Đang tải PDF...' : 'Tải PDF'}
                    </button>
                  }
                />
              ) : (
                <div className="khung-du-lieu khung-du-lieu--trong">Không tải được chi tiết hóa đơn.</div>
              )}

              {modalThongBao ? (
                <div className="invoice-inline-message" style={{ marginTop: '12px', color: modalThongBao.ok ? '#16a34a' : '#dc2626' }}>
                  {modalThongBao.text}
                </div>
              ) : null}

              <div className="invoice-modal-actions">
                <button type="button" className="nut nut--phu" onClick={() => setModalHoaDon(null)}>
                  Đóng
                </button>
                {modalMode === 'edit' ? (
                  <button type="button" className="nut" onClick={() => luuChinhSua(modalInvoiceId)} disabled={modalDangLuu}>
                    {modalDangLuu ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                ) : null}
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {xacNhanThanhToan ? (
        <div className="lop-phu-endpoint" onClick={() => setXacNhanThanhToan(null)}>
          <div className="hop-endpoint-mo" onClick={(event) => event.stopPropagation()}>
            <article className="the-endpoint the-endpoint--mo invoice-modal-card">
              <div className="the-endpoint__dau">
                <div>
                  <span className="method-tag method-tag--patch">PATCH</span>
                  <h3>Ghi nhận thanh toán tiền mặt</h3>
                </div>
                <button type="button" className="nut-dong-endpoint" onClick={() => setXacNhanThanhToan(null)}>
                  x
                </button>
              </div>

              <div className="invoice-edit-form">
                <label className="truong">
                  <span>Phòng</span>
                  <input type="text" value={xacNhanThanhToan.roomCode || 'Không có dữ liệu'} readOnly />
                </label>
                <label className="truong">
                  <span>Tổng tiền hóa đơn</span>
                  <input type="text" value={dinhDangTien(xacNhanThanhToan.totalAmount)} readOnly />
                </label>
                <label className="truong">
                  <span>Số tiền thực thu</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={xacNhanThanhToan.amount}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => setXacNhanThanhToan((prev) => ({ ...prev, amount: chuanHoaTienKhiNhap(event.target.value) }))}
                  />
                </label>
                <label className="truong truong--full">
                  <span>Ghi chú</span>
                  <textarea
                    rows="5"
                    value={xacNhanThanhToan.note}
                    onChange={(event) => setXacNhanThanhToan((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="Ví dụ: Khách trả một phần, phần còn lại chuyển thành nợ cũ của tháng sau."
                  />
                </label>
              </div>

              <div className="invoice-modal-actions">
                <button type="button" className="nut nut--phu" onClick={() => setXacNhanThanhToan(null)}>
                  Hủy
                </button>
                <button
                  type="button"
                  className="nut"
                  onClick={xacNhanThanhToanTienMat}
                  disabled={!!dangXuLy[xacNhanThanhToan.invoiceId]}
                >
                  {!!dangXuLy[xacNhanThanhToan.invoiceId] ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
                </button>
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </>
  )
}
function XemDanhSachHoaDon({ data }) {
  if (!Array.isArray(data) || !data.length) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Không có hóa đơn nào.</div>
  }

  return (
    <div className="danh-sach-phong">
      {data.map((invoice, index) => {
        const roomCode = invoice.roomCode ?? invoice.RoomCode
        const roomId = invoice.roomId ?? invoice.RoomId
        const billingMonth = invoice.billingMonth ?? invoice.BillingMonth
        const totalAmount = invoice.totalAmount ?? invoice.TotalAmount
        const extraFee = layPhiPhatSinhHoaDon(invoice)
        const extraFeeNote = layGhiChuPhiPhatSinhHoaDon(invoice)
        const invoiceType = layLoaiHoaDon(invoice)

        return (
          <div key={`${invoice.invoiceId ?? invoice.InvoiceId ?? index}`} className="dong-phong">
            <div className="dong-phong__o">
              <span>Phòng</span>
              <strong>{roomCode || (roomId != null ? `Phòng #${roomId}` : 'Không có dữ liệu')}</strong>
            </div>
            <div className="dong-phong__o">
              <span>Tháng</span>
              <strong>{giaTriDep(billingMonth, 'billingMonth')}</strong>
            </div>
            <div className="dong-phong__o">
              <span>Tổng tiền</span>
              <strong>{giaTriDep(totalAmount, 'totalAmount')}</strong>
            </div>
            <div className="dong-phong__o">
              <span>Phí phát sinh</span>
              <strong>{giaTriDep(extraFee) || '0'}</strong>
            </div>
            <div className="dong-phong__o">
              <span>Loại hóa đơn</span>
              <strong>{giaTriDep(invoiceType, 'invoiceType')}</strong>
            </div>
            <div className="dong-phong__o">
              <span>Ghi chú phí phát sinh</span>
              <strong>{extraFeeNote || 'Không có dữ liệu'}</strong>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function XemHoaDonChiTiet({ data, actions = null }) {
  if (!data) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Chưa có dữ liệu.</div>
  }

  if (Array.isArray(data)) {
    return <XemDanhSachHoaDon data={data} />
  }

  const hiddenFields = new Set(['invoiceid', 'contractid', 'roomid'])
  const entries = Object.entries(data).filter(([key]) => !hiddenFields.has(key.toLowerCase()))
  const vietQrUrl = taoUrlVietQrHoaDon(data)
  const vietQrAddInfo = taoNoiDungVietQrHoaDon(data)

  return (
    <div className="danh-sach-phong invoice-cards">
      <div className="dong-phong dong-phong--nguoi-thue invoice-detail-layout__info">
        {entries.map(([key, value]) => (
          <div key={key} className="dong-phong__o">
            <span>{nhanTruong('invoices', '', key)}</span>
            <strong>{giaTriDep(value, key)}</strong>
          </div>
        ))}
      </div>
      {vietQrUrl ? (
        <div className="invoice-qr-card">
          <div className="invoice-qr-card__header">
            <strong>QR thanh toán hóa đơn</strong>
            <span>VietQR MB Bank 556062006</span>
          </div>
          <div className="invoice-qr-card__body">
            <img src={vietQrUrl} alt="QR thanh toán hóa đơn" className="invoice-qr-card__image" />
            <div className="invoice-qr-card__meta">
              <div className="dong-phong__o">
                <span>Ngân hàng</span>
                <strong>MB Bank</strong>
              </div>
              <div className="dong-phong__o">
                <span>Số tài khoản</span>
                <strong>556062006</strong>
              </div>
              <div className="dong-phong__o">
                <span>Chủ tài khoản</span>
                <strong>LaiTrinhPhuocHung</strong>
              </div>
              <div className="dong-phong__o">
                <span>Nội dung chuyển khoản</span>
                <strong>{vietQrAddInfo}</strong>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {actions ? <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>{actions}</div> : null}
    </div>
  )
}
function layTrangThaiHoaDon(invoice) {
  return String(invoice?.status ?? invoice?.Status ?? '').trim().toLowerCase()
}

function layLoaiHoaDon(invoice) {
  return String(invoice?.invoiceType ?? invoice?.InvoiceType ?? '').trim().toLowerCase()
}

function layTongTienHoaDon(invoice) {
  return Number(invoice?.totalAmount ?? invoice?.TotalAmount ?? 0)
}

function layPhiPhatSinhHoaDon(invoice) {
  return Number(invoice?.extraFee ?? invoice?.ExtraFee ?? 0)
}

function layGhiChuPhiPhatSinhHoaDon(invoice) {
  return String(invoice?.extraFeeNote ?? invoice?.ExtraFeeNote ?? '').trim()
}

function lamTronSoTien(value) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.round(number))
}

function layMaHoaDonQr(invoice) {
  const paymentCode = String(invoice?.paymentCode ?? invoice?.PaymentCode ?? '').trim()
  if (paymentCode) return paymentCode

  const invoiceId = invoice?.invoiceId ?? invoice?.InvoiceId
  if (invoiceId === null || invoiceId === undefined || invoiceId === '') return ''
  return `HD${invoiceId}`
}

function taoNoiDungVietQrHoaDon(invoice) {
  return layMaHoaDonQr(invoice)
}

function taoUrlVietQrHoaDon(invoice) {
  const totalAmount = lamTronSoTien(invoice?.totalAmount ?? invoice?.TotalAmount)
  const addInfo = taoNoiDungVietQrHoaDon(invoice)

  if (!totalAmount || !addInfo) return ''

  const params = new URLSearchParams({
    amount: String(totalAmount),
    addInfo,
    accountName: 'LaiTrinhPhuocHung',
  })

  return `https://img.vietqr.io/image/mbbank-556062006-compact2.jpg?${params.toString()}`
}

function layTenTepTuHeader(disposition) {
  if (!disposition) return null

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const plainMatch = disposition.match(/filename="?([^\";]+)"?/i)
  return plainMatch?.[1] ? plainMatch[1] : null
}

function kichHoatTaiTep(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function taiHoaDonPdf(invoice) {
  const invoiceId = invoice?.invoiceId ?? invoice?.InvoiceId
  if (!invoiceId) {
    throw new Error('Không tìm thấy mã hóa đơn để tải PDF.')
  }

  const defaultName = `HoaDon-${layMaHoaDonQr(invoice) || invoiceId}.pdf`
  const response = await fetch(`/api/Invoices/${invoiceId}/pdf`, {
    method: 'GET',
    headers: { Accept: 'application/pdf' },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.message || `Lỗi tải PDF hóa đơn ${invoiceId}.`)
  }

  const blob = await response.blob()
  const fileName = layTenTepTuHeader(response.headers.get('Content-Disposition')) || defaultName
  kichHoatTaiTep(blob, fileName)
}

async function taiNhieuHoaDonPdf(invoices) {
  const danhSach = (Array.isArray(invoices) ? invoices : [invoices]).filter(Boolean)
  if (!danhSach.length) {
    throw new Error('Không có hóa đơn nào để tải PDF.')
  }

  for (const invoice of danhSach) {
    await taiHoaDonPdf(invoice)
    await new Promise((resolve) => window.setTimeout(resolve, 250))
  }
}

async function taiSoDoanhThuPdf(payload) {
  const response = await fetch('/api/Reports/sales-ledger/pdf', {
    method: 'POST',
    headers: {
      Accept: 'application/pdf',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}))
    throw new Error(errorPayload?.message || 'Không thể tạo PDF sổ doanh thu.')
  }

  const blob = await response.blob()
  const fileName =
    layTenTepTuHeader(response.headers.get('Content-Disposition')) ||
    `SoDoanhThu-${payload?.fromMonth || taoGiaTriThangMacDinh()}-den-${payload?.toMonth || taoGiaTriThangMacDinh()}.pdf`

  kichHoatTaiTep(blob, fileName)
}

function XemNguoiThue({ data }) {
  if (!data) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Chưa có dữ liệu.</div>
  }

  const hiddenFields = new Set(['tenantid', 'roomid', 'createdat', 'updatedat'])
  const entries = Object.entries(data).filter(([key]) => !hiddenFields.has(key.toLowerCase()))

  return (
    <div className="danh-sach-phong">
      <div className="dong-phong dong-phong--nguoi-thue">
        {entries.map(([key, value]) => (
          <div key={key} className="dong-phong__o">
            <span>{nhanTruong('tenants', '', key)}</span>
            <strong>{giaTriDep(value, key)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function ContractsWorkspace({ spec }) {
  const [contracts, setContracts] = useState([])
  const [tuKhoaFilter, setTuKhoaFilter] = useState('')
  const [trangThaiFilter, setTrangThaiFilter] = useState('active')
  const [dangTai, setDangTai] = useState(false)
  const [loi, setLoi] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const contractActions = useMemo(() => {
    return Object.entries(spec?.paths || {})
      .filter(([path]) => path.toLowerCase().startsWith('/api/contracts'))
      .flatMap(([path, pathItem]) =>
        METHOD_ORDER.filter((method) => pathItem[method]).map((method) => ({
          path,
          method,
          operation: pathItem[method],
        })),
      )
      .filter((item) => nenHienThiEndpoint('contracts', item.method, item.path))
      .filter((item) => !(item.method.toLowerCase() === 'get' && item.path.toLowerCase() === '/api/contracts'))
      .sort((a, b) => sapXepEndpoint('contracts', a, b))
  }, [spec])

  useEffect(() => {
    let ignore = false

    async function taiDanhSachHopDong() {
      setDangTai(true)
      setLoi('')
      try {
        const result = await guiRequest('/api/Contracts', { method: 'GET' })
        if (!ignore) {
          setContracts(Array.isArray(result.payload) ? result.payload : [])
        }
      } catch (error) {
        if (!ignore) {
          setLoi(error.message || 'Không tải được danh sách hợp đồng.')
          setContracts([])
        }
      } finally {
        if (!ignore) {
          setDangTai(false)
        }
      }
    }

    taiDanhSachHopDong()
    return () => {
      ignore = true
    }
  }, [reloadKey])

  const danhSachLoc = useMemo(() => {
    const normalizedSearch = tuKhoaFilter.trim().toLowerCase()
    return contracts.filter((contract) => {
      const status = String(contract.status ?? contract.Status ?? '').trim().toLowerCase()
      const roomCode = String(contract.roomCode ?? contract.RoomCode ?? '').trim().toLowerCase()
      const tenantName = String(contract.tenantName ?? contract.TenantName ?? '').trim().toLowerCase()
      const contractId = String(contract.contractId ?? contract.ContractId ?? '').trim().toLowerCase()

      const matchesStatus =
        trangThaiFilter === 'all' ||
        (trangThaiFilter === 'active' && status === 'active') ||
        (trangThaiFilter === 'ended' && status === 'ended')

      const matchesSearch =
        !normalizedSearch ||
        roomCode.includes(normalizedSearch) ||
        tenantName.includes(normalizedSearch) ||
        contractId.includes(normalizedSearch)

      return matchesStatus && matchesSearch
    })
  }, [contracts, tuKhoaFilter, trangThaiFilter])

  return (
    <div className="invoice-workspace contracts-workspace">
      <section className="invoice-hero khung">
        <div className="invoice-hero__main">
          <p className="nhan">Hợp đồng</p>
          <div className="invoice-toolbar contracts-toolbar">
            <label className="invoice-search">
              <span>Tìm hợp đồng</span>
              <input
                type="text"
                value={tuKhoaFilter}
                onChange={(event) => setTuKhoaFilter(event.target.value)}
                placeholder="Tìm theo mã phòng, người thuê hoặc mã hợp đồng"
              />
            </label>
            <label className="invoice-search invoice-search--status">
              <span>Trạng thái hợp đồng</span>
              <select value={trangThaiFilter} onChange={(event) => setTrangThaiFilter(event.target.value)}>
                <option value="all">Tất cả</option>
                <option value="active">Còn hiệu lực</option>
                <option value="ended">Hết hạn</option>
              </select>
            </label>
            <button type="button" className="nut nut--phu contracts-toolbar-refresh" onClick={() => setReloadKey((value) => value + 1)} disabled={dangTai}>
              {dangTai ? 'Đang tải...' : 'Làm mới danh sách'}
            </button>
          </div>
        </div>
      </section>

      {contractActions.length ? (
        <section className="khung contracts-actions-card">
          <div className="danh-sach-endpoint contract-actions-inline">
            {contractActions.map((item) => (
              <EndpointCard
                key={`${item.method}-${item.path}`}
                method={item.method}
                moduleKey="contracts"
                operation={item.operation}
                path={item.path}
                spec={spec}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="khung">
        <div className="xem-truoc__dau">
          <strong>Danh sách hợp đồng</strong>
          <span>{`Hiển thị ${danhSachLoc.length}/${contracts.length} hợp đồng`}</span>
        </div>
        {loi ? <div className="thong-bao-loi">{loi}</div> : null}
        {dangTai ? (
          <div className="khung-du-lieu khung-du-lieu--trong">Đang tải danh sách hợp đồng...</div>
        ) : danhSachLoc.length ? (
          <XemDanhSachHopDong data={danhSachLoc} hideFilters />
        ) : (
          <div className="khung-du-lieu khung-du-lieu--trong">Không có hợp đồng nào khớp với bộ lọc hiện tại.</div>
        )}
      </section>
    </div>
  )
}

function XemDanhSachNguoiThue({ data, hideSearch = false, initialSearch = '' }) {
  const [search, setSearch] = useState(initialSearch)

  if (!Array.isArray(data) || !data.length) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Không có người thuê.</div>
  }

  const hiddenFields = new Set(['tenantid', 'roomid', 'createdat', 'updatedat'])
  const filtered = data.filter((tenant) => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return true

    const fullName = String(tenant.fullName ?? tenant.FullName ?? '').trim().toLowerCase()
    const phone = String(tenant.phone ?? tenant.Phone ?? '').trim().toLowerCase()
    const cccd = String(tenant.cccd ?? tenant.CCCD ?? '').trim().toLowerCase()
    return fullName.includes(keyword) || phone.includes(keyword) || cccd.includes(keyword)
  })

  return (
    <div className="danh-sach-phong-wrap">
      {!hideSearch ? (
        <div className="bo-loc-hop-dong" style={{ marginBottom: '12px' }}>
          <label className="truong">
            <span>Tìm người thuê</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nhập tên, số điện thoại hoặc CCCD"
            />
          </label>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="khung-du-lieu khung-du-lieu--trong">Không tìm thấy người thuê phù hợp.</div>
      ) : (
        <div className="danh-sach-phong">
          {filtered.map((tenant, index) => {
            const fullName = tenant.fullName ?? tenant.FullName
            const phone = tenant.phone ?? tenant.Phone
            const cccd = tenant.cccd ?? tenant.CCCD

            return (
              <div key={`${tenant.id ?? tenant.Id ?? tenant.tenantId ?? tenant.TenantId ?? index}`} className="dong-phong dong-phong--tenant-compact invoice-card">
                <div className="dong-phong__o">
                  <span>Tên người thuê</span>
                  <strong className="tenant-name-highlight">{fullName || 'Không có dữ liệu'}</strong>
                </div>
                <div className="dong-phong__o">
                  <span>Số điện thoại</span>
                  <strong>{phone || 'Không có dữ liệu'}</strong>
                </div>
                <div className="dong-phong__o">
                  <span>CCCD</span>
                  <strong>{cccd || 'Không có dữ liệu'}</strong>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TenantsWorkspace({ spec }) {
  const [tenants, setTenants] = useState([])
  const [tuKhoaFilter, setTuKhoaFilter] = useState('')
  const [dangTai, setDangTai] = useState(false)
  const [loi, setLoi] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const tenantActions = useMemo(() => {
    const actions = Object.entries(spec?.paths || {})
      .filter(([path]) => path.toLowerCase().startsWith('/api/tenants'))
      .flatMap(([path, pathItem]) =>
        METHOD_ORDER.filter((method) => pathItem[method]).map((method) => ({
          path,
          method,
          operation: pathItem[method],
        })),
      )
      .filter((item) => {
        const method = item.method.toLowerCase()
        const path = item.path.toLowerCase()
        return (
          (method === 'post' && path === '/api/tenants') ||
          (method === 'put' && (path === '/api/tenants/{id:int}' || path === '/api/tenants/{id}'))
        )
      })
      .sort((a, b) => sapXepEndpoint('tenants', a, b))

    const seen = new Set()
    return actions.filter((item) => {
      const normalizedPath = item.path.toLowerCase().replace('{id:int}', '{id}')
      const key = `${item.method.toLowerCase()} ${normalizedPath}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [spec])

  useEffect(() => {
    let ignore = false

    async function taiDanhSachNguoiThue() {
      setDangTai(true)
      setLoi('')
      try {
        const result = await guiRequest('/api/Tenants', { method: 'GET' })
        if (!ignore) {
          setTenants(Array.isArray(result.payload) ? result.payload : [])
        }
      } catch (error) {
        if (!ignore) {
          setLoi(error.message || 'Không tải được danh sách người thuê.')
          setTenants([])
        }
      } finally {
        if (!ignore) {
          setDangTai(false)
        }
      }
    }

    taiDanhSachNguoiThue()
    return () => {
      ignore = true
    }
  }, [reloadKey])

  const danhSachLoc = useMemo(() => {
    const keyword = tuKhoaFilter.trim().toLowerCase()
    return tenants.filter((tenant) => {
      if (!keyword) return true
      const fullName = String(tenant.fullName ?? tenant.FullName ?? '').trim().toLowerCase()
      const phone = String(tenant.phone ?? tenant.Phone ?? '').trim().toLowerCase()
      const cccd = String(tenant.cccd ?? tenant.CCCD ?? '').trim().toLowerCase()
      return fullName.includes(keyword) || phone.includes(keyword) || cccd.includes(keyword)
    })
  }, [tenants, tuKhoaFilter])

  return (
    <div className="invoice-workspace tenants-workspace">
      <section className="invoice-hero khung">
        <div className="invoice-hero__main">
          <p className="nhan">Người thuê</p>
          <div className="invoice-toolbar tenants-toolbar">
            <label className="invoice-search">
              <span>Tìm người thuê</span>
              <input
                type="text"
                value={tuKhoaFilter}
                onChange={(event) => setTuKhoaFilter(event.target.value)}
                placeholder="Nhập tên, số điện thoại hoặc CCCD"
              />
            </label>
            <button type="button" className="nut nut--phu tenants-toolbar-refresh" onClick={() => setReloadKey((value) => value + 1)} disabled={dangTai}>
              {dangTai ? 'Đang tải...' : 'Làm mới danh sách'}
            </button>
          </div>
        </div>
      </section>

      {tenantActions.length ? (
        <section className="khung tenants-actions-card">
          <div className="danh-sach-endpoint tenant-actions-inline">
            {tenantActions.map((item) => (
              <EndpointCard
                key={`${item.method}-${item.path}`}
                method={item.method}
                moduleKey="tenants"
                operation={item.operation}
                path={item.path}
                spec={spec}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="khung">
        <div className="xem-truoc__dau">
          <strong>Danh sách người thuê</strong>
          <span>{`Hiển thị ${danhSachLoc.length}/${tenants.length} người thuê`}</span>
        </div>
        {loi ? <div className="thong-bao-loi">{loi}</div> : null}
        {dangTai ? (
          <div className="khung-du-lieu khung-du-lieu--trong">Đang tải danh sách người thuê...</div>
        ) : danhSachLoc.length ? (
          <XemDanhSachNguoiThue data={danhSachLoc} hideSearch />
        ) : (
          <div className="khung-du-lieu khung-du-lieu--trong">Không có người thuê nào khớp với bộ lọc hiện tại.</div>
        )}
      </section>
    </div>
  )
}

// Component monthly-bulk riêng biệt
function MonthlyBulkCard({ onSuccess, compact = false }) {
  const [billingMonth, setBillingMonth] = useState(taoThangMacDinh())
  const [defaultDiscountAmount, setDefaultDiscountAmount] = useState(0)
  const [defaultDebtAmount, setDefaultDebtAmount] = useState(0)
  const [previewData, setPreviewData] = useState(null)
  const [createdInvoices, setCreatedInvoices] = useState([])
  const [dangTaiPdfLoat, setDangTaiPdfLoat] = useState(false)
  const [dangXemTruoc, setDangXemTruoc] = useState(false)
  const [dangTao, setDangTao] = useState(false)
  const [hienXacNhan, setHienXacNhan] = useState(false)
  const [trangThai, setTrangThai] = useState('')
  const [mauTrangThai, setMauTrangThai] = useState('')
  const [dangMo, setDangMo] = useState(false)

  useEffect(() => {
    if (!dangMo) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setDangMo(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [dangMo])

  const doPreview = async () => {
    setDangXemTruoc(true)
    setTrangThai('')
    setMauTrangThai('')
    setPreviewData(null)
    setCreatedInvoices([])
    setHienXacNhan(false)
    try {
      const res = await fetch('/api/Invoices/monthly-bulk-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingMonth, defaultDiscountAmount: chuyenTienVeSo(defaultDiscountAmount), defaultDebtAmount: chuyenTienVeSo(defaultDebtAmount) }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.message || `Lỗi ${res.status}`)
      setPreviewData(Array.isArray(payload) ? payload : payload?.data ?? payload?.items ?? [])
      setCreatedInvoices([])
      setTrangThai(`Xem trước thành công — ${Array.isArray(payload) ? payload.length : '?'} hóa đơn`)
      setMauTrangThai('thanh-cong')
    } catch (err) {
      setTrangThai(err.message)
      setMauTrangThai('that-bai')
    } finally {
      setDangXemTruoc(false)
    }
  }

  const doConfirm = async () => {
    setDangTao(true)
    setHienXacNhan(false)
    setTrangThai('Đang tạo hóa đơn hàng loạt...')
    setMauTrangThai('')
    try {
      const res = await fetch('/api/Invoices/monthly-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingMonth, defaultDiscountAmount: chuyenTienVeSo(defaultDiscountAmount), defaultDebtAmount: chuyenTienVeSo(defaultDebtAmount) }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.message || `Lỗi ${res.status}`)
      const created = Array.isArray(payload) ? payload : payload?.data ?? payload?.items ?? []
      setTrangThai('Tạo hóa đơn hàng loạt thành công!')
      setMauTrangThai('thanh-cong')
      setPreviewData(null)
      setCreatedInvoices(Array.isArray(created) ? created : [])
      if (onSuccess) onSuccess()
    } catch (err) {
      setTrangThai(err.message)
      setMauTrangThai('that-bai')
    } finally {
      setDangTao(false)
    }
  }

  const taiTatCaPdfVuaTao = async () => {
    setDangTaiPdfLoat(true)
    setTrangThai('')
    setMauTrangThai('')

    try {
      await taiNhieuHoaDonPdf(createdInvoices)
      setTrangThai(`Đã tải ${createdInvoices.length} file PDF hóa đơn.`)
      setMauTrangThai('thanh-cong')
    } catch (err) {
      setTrangThai(thongDiepLoi(err))
      setMauTrangThai('that-bai')
    } finally {
      setDangTaiPdfLoat(false)
    }
  }

  const tongTien = previewData?.reduce((acc, inv) => acc + (inv.totalAmount ?? inv.TotalAmount ?? 0), 0) ?? 0

  const noiDung = (
    <article className="the-endpoint the-endpoint--mo">
      <div className="the-endpoint__dau">
        <div>
          <span className="method-tag method-tag--post">POST</span>
          <h3>Tạo hóa đơn hàng loạt theo tháng</h3>
        </div>
        <button type="button" className="nut-dong-endpoint" onClick={() => setDangMo(false)}>×</button>
      </div>

      <div className="khoi-form">
        <section className="khoi-con">
          <div className="luoi-input">
            <label className="truong">
              <span>Tháng lập hóa đơn</span>
              <input type="month" value={String(billingMonth || '').slice(0, 7)} onChange={(e) => setBillingMonth(chuanHoaGiaTriThang(e.target.value))} />
              <small>Chọn tháng, hệ thống tự gửi ngày đầu tháng.</small>
            </label>
            <label className="truong">
              <span>Giảm trừ mặc định</span>
              <input type="text" value={defaultDiscountAmount} onChange={(e) => setDefaultDiscountAmount(chuanHoaTienKhiNhap(e.target.value))} />
              <small>Áp dụng cho tất cả hóa đơn trong tháng</small>
            </label>
            <label className="truong">
              <span>Nợ cũ mặc định</span>
              <input type="text" value={defaultDebtAmount} onChange={(e) => setDefaultDebtAmount(chuanHoaTienKhiNhap(e.target.value))} />
              <small>Áp dụng cho tất cả hóa đơn trong tháng</small>
            </label>
          </div>
        </section>
      </div>

      <div className="cum-nut-endpoint">
        <button type="button" className="nut nut--chinh" disabled={dangXemTruoc || dangTao} onClick={doPreview}>
          {dangXemTruoc ? 'Đang xem trước...' : 'Xem trước'}
        </button>
      </div>

      {trangThai ? <div className={`thanh-trang-thai ${mauTrangThai}`}>{trangThai}</div> : null}

      {createdInvoices.length ? (
        <div className="invoice-modal-actions" style={{ marginTop: '12px' }}>
          <button type="button" className="nut" disabled={dangTaiPdfLoat} onClick={taiTatCaPdfVuaTao}>
            {dangTaiPdfLoat ? 'Đang tải PDF...' : `Tải ${createdInvoices.length} file PDF vừa tạo`}
          </button>
        </div>
      ) : null}

      {previewData && previewData.length > 0 ? (
        <section className="khoi-con">
          <h4>Danh sách hóa đơn sẽ tạo ({previewData.length} hóa đơn)</h4>
          <div className="xem-truoc">
            <div className="danh-sach-phong">
              {previewData.map((inv, idx) => {
                const roomCode = inv.roomCode ?? inv.RoomCode
                const tenantName = inv.tenantName ?? inv.TenantName
                const total = inv.totalAmount ?? inv.TotalAmount

                return (
                  <div key={`${roomCode}-${idx}`} className="dong-phong" style={{ flexWrap: 'wrap', gap: '6px' }}>
                    <div className="dong-phong__o">
                      <span>Phòng</span>
                      <strong>{roomCode}</strong>
                    </div>
                    <div className="dong-phong__o">
                      <span>Người thuê</span>
                      <strong>{tenantName || '—'}</strong>
                    </div>
                    <div className="dong-phong__o">
                      <span>Tiền phòng</span>
                      <strong>{dinhDangTien(inv.roomFee ?? inv.RoomFee)}</strong>
                    </div>
                    <div className="dong-phong__o">
                      <span>Tiền điện</span>
                      <strong>{dinhDangTien(inv.electricityFee ?? inv.ElectricityFee)}</strong>
                    </div>
                    <div className="dong-phong__o">
                      <span>Tiền nước</span>
                      <strong>{dinhDangTien(inv.waterFee ?? inv.WaterFee)}</strong>
                    </div>
                    <div className="dong-phong__o">
                      <span>Tiền rác</span>
                      <strong>{dinhDangTien(inv.trashFee ?? inv.TrashFee)}</strong>
                    </div>
                    <div className="dong-phong__o">
                      <span>Tổng tiền</span>
                      <strong style={{ color: '#0369a1', fontWeight: 700 }}>{dinhDangTien(total)}</strong>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: '12px', padding: '12px', background: 'var(--mau-nen-2, #f1f5f9)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Tổng cộng {previewData.length} hóa đơn</strong>
              <strong style={{ color: '#0369a1', fontSize: '16px' }}>{dinhDangTien(tongTien)}</strong>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            {!hienXacNhan ? (
              <button
                type="button"
                className="nut nut--chinh"
                style={{ width: '100%' }}
                disabled={dangTao}
                onClick={() => setHienXacNhan(true)}
              >
                Xác nhận tạo {previewData.length} hóa đơn
              </button>
            ) : (
              <div className="khung-du-lieu" style={{ background: '#fef9c3', border: '1px solid #ca8a04', borderRadius: '8px', padding: '16px' }}>
                <p style={{ marginBottom: '12px', fontWeight: 600 }}>
                  Bạn có chắc muốn tạo {previewData.length} hóa đơn cho tháng {dinhDangThang(billingMonth)}?
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="nut nut--chinh" style={{ flex: 1 }} onClick={doConfirm} disabled={dangTao}>
                    {dangTao ? 'Đang tạo...' : 'Xác nhận tạo'}
                  </button>
                  <button type="button" className="nut nut--phu" style={{ flex: 1 }} onClick={() => setHienXacNhan(false)} disabled={dangTao}>
                    Huỷ
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </article>
  )

  return (
    <>
      <button type="button" className={compact ? 'nut nut--chinh invoice-bulk-trigger' : 'the-endpoint-rut-gon'} onClick={() => setDangMo(true)}>
        {!compact ? <span className="method-tag method-tag--post">POST</span> : null}
        <strong>Tạo hóa đơn hàng loạt theo tháng</strong>
        <span className="the-endpoint-rut-gon__mo-ta">Xem trước và xác nhận tạo hàng loạt hóa đơn tháng</span>
      </button>

      {dangMo ? (
        <div className="lop-phu-endpoint" onClick={() => setDangMo(false)}>
          <div className="hop-endpoint-mo" onClick={(e) => e.stopPropagation()}>
            {noiDung}
          </div>
        </div>
      ) : null}
    </>
  )
}

function InvoiceWorkspace() {
  const [hoaDon, setHoaDon] = useState([])
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [phongFilter, setPhongFilter] = useState('')
  const [thangNamFilter, setThangNamFilter] = useState('')
  const [trangThaiFilter, setTrangThaiFilter] = useState('all')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let conHieuLuc = true

    async function taiDanhSachHoaDon() {
      setDangTai(true)
      setLoi('')

      try {
        const invoiceResult = await guiRequest('/api/Invoices', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })

        const invoicePayload = invoiceResult.payload
        const danhSach = Array.isArray(invoicePayload)
          ? invoicePayload
          : Array.isArray(invoicePayload?.data)
            ? invoicePayload.data
            : Array.isArray(invoicePayload?.items)
              ? invoicePayload.items
              : []
        if (conHieuLuc) {
          setHoaDon(danhSach)
        }
      } catch (error) {
        if (conHieuLuc) {
          setLoi(thongDiepLoi(error))
          setHoaDon([])
        }
      } finally {
        if (conHieuLuc) {
          setDangTai(false)
        }
      }
    }

    taiDanhSachHoaDon()

    return () => {
      conHieuLuc = false
    }
  }, [reloadKey])

  const danhSachLoc = useMemo(() => {
    const phongDaLoc = String(phongFilter || '').trim().toLowerCase()

    return hoaDon.filter((invoice) => {
      const roomCode = String(invoice.roomCode ?? invoice.RoomCode ?? '').trim().toLowerCase()
      const status = layTrangThaiHoaDon(invoice)
      const billingMonth = String(invoice.billingMonth ?? invoice.BillingMonth ?? '')
      const monthValue = billingMonth ? String(billingMonth).slice(0, 7) : ''

      const hopPhong = !phongDaLoc || roomCode.includes(phongDaLoc)
      const hopThang = !thangNamFilter || monthValue === thangNamFilter
      const hopTrangThai = trangThaiFilter === 'all' || status === trangThaiFilter

      return hopPhong && hopThang && hopTrangThai
    })
  }, [hoaDon, phongFilter, thangNamFilter, trangThaiFilter])

  const tongHoaDon = danhSachLoc.length
  const hoaDonDaThanhToan = danhSachLoc.filter((invoice) => layTrangThaiHoaDon(invoice) === 'paid').length
  const hoaDonChuaThanhToan = danhSachLoc.filter((invoice) => layTrangThaiHoaDon(invoice) !== 'paid').length
  const tongGiaTriChuaThanhToan = danhSachLoc
    .filter((invoice) => layTrangThaiHoaDon(invoice) !== 'paid')
    .reduce((tong, invoice) => tong + layTongTienHoaDon(invoice), 0)
  const tongGiaTriDaThanhToan = danhSachLoc
    .filter((invoice) => layTrangThaiHoaDon(invoice) === 'paid')
    .reduce((tong, invoice) => tong + layTongTienHoaDon(invoice), 0)
  const tongGiaTri = danhSachLoc.reduce((tong, invoice) => tong + layTongTienHoaDon(invoice), 0)

  return (
    <div className="invoice-workspace">
      <section className="invoice-hero khung">
        <div className="invoice-hero__main">
          <p className="nhan">Hóa đơn</p>
          <h2>Quản lý hóa đơn đang có trong hệ thống</h2>
          <p className="mo-ta-trang">
            Danh sách được tải tự động khi mở trang. Bạn có thể tìm nhanh theo mã hóa đơn, phòng, tháng, người thuê hoặc trạng thái.
          </p>

          <div className="invoice-toolbar invoice-toolbar--invoices">
            <label className="invoice-search">
              <span>Tìm theo phòng</span>
              <input
                type="text"
                value={phongFilter}
                onChange={(event) => setPhongFilter(event.target.value)}
                placeholder="Ví dụ: A01, P101..."
              />
            </label>
            <MonthYearFilter label="Tháng - năm" value={thangNamFilter} onChange={setThangNamFilter} />
            <label className="invoice-search invoice-search--status">
              <span>Trạng thái</span>
              <select value={trangThaiFilter} onChange={(event) => setTrangThaiFilter(event.target.value)}>
                <option value="all">Tất cả</option>
                <option value="paid">Đã thanh toán</option>
                <option value="unpaid">Chưa thanh toán</option>
              </select>
            </label>

            <button
              type="button"
              className="nut nut--phu meter-toolbar-inline-button"
              onClick={() => setReloadKey((value) => value + 1)}
              disabled={dangTai}
            >
              {dangTai ? 'Đang tải...' : 'Làm mới danh sách'}
            </button>
            <MonthlyBulkCard onSuccess={() => setReloadKey((value) => value + 1)} compact />
          </div>
        </div>

        <div className="invoice-hero__action">
          <div className="invoice-bulk-card">
            <p className="invoice-bulk-card__label">Tác vụ nhanh</p>
            <strong>Tạo hóa đơn hàng loạt theo tháng</strong>
            <span>Khối thao tác ở góc phải để bạn chốt kỳ mới mà không phải rời khỏi danh sách.</span>
            <MonthlyBulkCard onSuccess={() => setReloadKey((value) => value + 1)} />
          </div>
        </div>
      </section>

      <section className="invoice-stats">
        <article className="invoice-stat-card">
          <span>Tổng hóa đơn</span>
          <strong>{tongHoaDon}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Đã thanh toán</span>
          <strong>{hoaDonDaThanhToan}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Chưa thanh toán</span>
          <strong>{hoaDonChuaThanhToan}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Tổng giá trị</span>
          <strong>{dinhDangTien(tongGiaTri)}</strong>
        </article>
      </section>

      <section className="khung">
        <div className="xem-truoc__dau">
          <strong>Danh sách hóa đơn</strong>
          <span>
            {phongFilter.trim() || thangNamFilter || trangThaiFilter !== 'all'
              ? `Hiển thị ${danhSachLoc.length}/${hoaDon.length} hóa đơn`
              : `Hiển thị ${tongHoaDon} hóa đơn`}
          </span>
        </div>

        {loi ? <div className="thong-bao-loi">{loi}</div> : null}

        {dangTai ? (
          <div className="khung-du-lieu khung-du-lieu--trong">Đang tải danh sách hóa đơn...</div>
        ) : danhSachLoc.length ? (
          <div className="invoice-list-wrap">
            <XemDanhSachHoaDonCoNut data={danhSachLoc} onReload={() => setReloadKey((value) => value + 1)} />
          </div>
        ) : (
          <div className="khung-du-lieu khung-du-lieu--trong">
            {phongFilter.trim() || thangNamFilter || trangThaiFilter !== 'all'
              ? 'Không có hóa đơn nào khớp với bộ lọc hiện tại.'
              : 'Chưa có hóa đơn nào trong hệ thống.'}
          </div>
        )}
      </section>
    </div>
  )
}

function laDuLieuChiSoDien(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  return (
    'meterReadingId' in value ||
    'MeterReadingId' in value ||
    'currentReading' in value ||
    'CurrentReading' in value ||
    'consumedUnits' in value ||
    'ConsumedUnits' in value
  )
}

function XemDanhSachChiSoDien({ data, onEdit = null, editingId = null, onDelete = null, deletingId = null }) {
  if (!Array.isArray(data) || !data.length) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Không có chỉ số điện nào.</div>
  }

  return (
    <div className="meter-list-table-wrap">
      <table className="meter-list-table">
        <thead>
          <tr>
            <th>Phòng</th>
            <th>Tháng ghi số</th>
            <th>Chỉ số tháng trước</th>
            <th>Chỉ số mới</th>
            <th>Tiêu thụ</th>
            {onEdit || onDelete ? <th>Thao tác</th> : null}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const meterReadingId = item.meterReadingId ?? item.MeterReadingId ?? index
            const roomCode = item.roomCode ?? item.RoomCode
            const billingMonth = item.billingMonth ?? item.BillingMonth
            const currentReading = item.currentReading ?? item.CurrentReading
            const previousReading = item.previousReading ?? item.PreviousReading
            const consumedUnits = item.consumedUnits ?? item.ConsumedUnits

            return (
              <tr key={meterReadingId}>
                <td>
                  <strong>{roomCode || 'Không có dữ liệu'}</strong>
                </td>
                <td>{giaTriDep(billingMonth, 'billingMonth')}</td>
                <td>{giaTriDep(previousReading, 'previousReading')}</td>
                <td>{giaTriDep(currentReading, 'currentReading')}</td>
                <td>{giaTriDep(consumedUnits, 'consumedUnits')}</td>
                {onEdit || onDelete ? (
                  <td>
                    <div className="meter-table-actions">
                      {onEdit ? (
                        <button
                          type="button"
                          className="nut nut--phu meter-card__delete"
                          onClick={() => onEdit(item)}
                          disabled={editingId === meterReadingId || deletingId === meterReadingId}
                        >
                          {editingId === meterReadingId ? 'Đang sửa...' : 'Sửa chỉ số'}
                        </button>
                      ) : null}
                      {onDelete ? (
                        <button
                          type="button"
                          className="nut nut--phu meter-card__delete"
                          onClick={() => onDelete(item)}
                          disabled={editingId === meterReadingId || deletingId === meterReadingId}
                        >
                          {deletingId === meterReadingId ? 'Đang xóa...' : 'Xóa'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function XemChiSoDien({ data }) {
  if (!data) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Chưa có dữ liệu.</div>
  }

  if (Array.isArray(data)) {
    return <XemDanhSachChiSoDien data={data} />
  }

  const hiddenFields = new Set(['meterreadingid'])
  const entries = Object.entries(data).filter(([key]) => !hiddenFields.has(key.toLowerCase()))

  return (
    <div className="danh-sach-phong invoice-cards">
      <div className="dong-phong dong-phong--nguoi-thue invoice-detail-layout__info">
        {entries.map(([key, value]) => (
          <div key={key} className="dong-phong__o">
            <span>{nhanTruong('meterreadings', '', key)}</span>
            <strong>{giaTriDep(value, key)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function layTrangThaiGiaoDichThanhToan(item) {
  return String(item?.processStatus ?? item?.ProcessStatus ?? '')
    .trim()
    .toLowerCase()
}

function laPaymentCodeHoaDonHopLe(value) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()

  return /^(?:FINAL)?[A-Z0-9]+(?:0[1-9]|1[0-2])\d{4}(?:\d{2})?$/.test(normalized)
}

function dinhDangTrangThaiGiaoDichThanhToan(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (!normalized) return 'Chưa xử lý'
  if (normalized === 'paid') return 'Đã thanh toán'
  if (normalized === 'pending') return 'Chờ xử lý'
  if (normalized === 'processed') return 'Đã xử lý'
  if (normalized === 'ignored') return 'Bỏ qua'
  if (normalized === 'failed') return 'Thất bại'
  return value || 'Không có dữ liệu'
}

function laySoTienGiaoDichThanhToan(item) {
  return Number(item?.transferAmount ?? item?.TransferAmount ?? 0)
}

function XemDanhSachGiaoDichThanhToan({ data, onDelete, deletingId }) {
  if (!Array.isArray(data) || !data.length) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Không có giao dịch thanh toán nào.</div>
  }

  return (
    <div className="danh-sach-phong invoice-cards">
      {data.map((item, index) => {
        const paymentTransactionId = item.paymentTransactionId ?? item.PaymentTransactionId ?? index
        const provider = item.provider ?? item.Provider
        const providerTransactionId = item.providerTransactionId ?? item.ProviderTransactionId
        const paymentCode = item.paymentCode ?? item.PaymentCode
        const referenceCode = item.referenceCode ?? item.ReferenceCode
        const accountNumber = item.accountNumber ?? item.AccountNumber
        const transferType = item.transferType ?? item.TransferType
        const transactionDate = item.transactionDate ?? item.TransactionDate
        const createdAt = item.createdAt ?? item.CreatedAt
        const content = item.content ?? item.Content
        const processStatus = item.processStatus ?? item.ProcessStatus
        const statusClass = layTrangThaiGiaoDichThanhToan(item)
        const isDeleting = deletingId === paymentTransactionId

        return (
          <div key={paymentTransactionId} className="dong-phong invoice-card">
            <div className="invoice-card__info">
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Mã giao dịch</span>
                <strong>{providerTransactionId || 'Không có dữ liệu'}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Nhà cung cấp</span>
                <strong>{provider || 'Không có dữ liệu'}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Trạng thái</span>
                <strong className={`payment-status payment-status--${statusClass || 'default'}`}>
                  {dinhDangTrangThaiGiaoDichThanhToan(processStatus)}
                </strong>
              </div>
              <div className="dong-phong__o invoice-card__amount">
                <span>Số tiền chuyển</span>
                <strong className="invoice-amount">{giaTriDep(item.transferAmount ?? item.TransferAmount, 'transferAmount')}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Mã thanh toán</span>
                <strong>{paymentCode || referenceCode || 'Không có dữ liệu'}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Mã giao dịch nhà cung cấp</span>
                <strong>{providerTransactionId || 'Không có dữ liệu'}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Số tài khoản</span>
                <strong>{accountNumber || 'Không có dữ liệu'}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Loại chuyển khoản</span>
                <strong>{transferType || 'Không có dữ liệu'}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Thời điểm giao dịch</span>
                <strong>{dinhDangNgayGio(transactionDate)}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Ngày ghi nhận</span>
                <strong>{dinhDangNgayGio(createdAt)}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Nội dung chuyển khoản</span>
                <strong>{content || 'Không có dữ liệu'}</strong>
              </div>
            </div>
            <div className="invoice-inline-actions">
              <button
                type="button"
                className="nut nut--phu invoice-inline-button invoice-action-button invoice-action-button--unpaid"
                onClick={() => onDelete?.(item)}
                disabled={!onDelete || isDeleting}
                title="Xóa giao dịch thanh toán"
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PaymentReconcileButton({ transactions, onSuccess }) {
  const [dangMo, setDangMo] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [dangGui, setDangGui] = useState(false)
  const [trangThai, setTrangThai] = useState('')
  const [mauTrangThai, setMauTrangThai] = useState('')

  useEffect(() => {
    if (!dangMo) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDangMo(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dangMo])

  useEffect(() => {
    if (!dangMo) return
    if (!transactions.length) {
      setSelectedTransactionId('')
      return
    }

    setSelectedTransactionId((current) => {
      if (current && transactions.some((item) => String(item.paymentTransactionId ?? item.PaymentTransactionId) === current)) {
        return current
      }

      return String(transactions[0].paymentTransactionId ?? transactions[0].PaymentTransactionId ?? '')
    })
  }, [dangMo, transactions])

  const doiSoat = async () => {
    setDangGui(true)
    setTrangThai('')
    setMauTrangThai('')

    try {
      await guiRequest(`/api/Payments/transactions/${selectedTransactionId}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: Number(invoiceId),
        }),
      })

      setTrangThai('Đã đối soát giao dịch thanh toán thành công.')
      setMauTrangThai('thanh-cong')
      setInvoiceId('')
      if (onSuccess) onSuccess()
    } catch (error) {
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
    } finally {
      setDangGui(false)
    }
  }

  return (
    <>
      <button type="button" className="nut nut--phu payment-toolbar-button" onClick={() => setDangMo(true)}>
        Đối soát giao dịch thanh toán
      </button>

      {dangMo ? (
        <div className="lop-phu-endpoint" onClick={() => setDangMo(false)}>
          <div className="hop-endpoint-mo" onClick={(event) => event.stopPropagation()}>
            <article className="the-endpoint the-endpoint--mo invoice-modal-card">
              <div className="the-endpoint__dau">
                <div>
                  <span className="method-tag method-tag--post">POST</span>
                  <h3>Đối soát giao dịch thanh toán</h3>
                </div>
                <button type="button" className="nut-dong-endpoint" onClick={() => setDangMo(false)}>
                  ×
                </button>
              </div>

              <div className="invoice-edit-form payment-reconcile-form">
                <label className="truong">
                  <span>Giao dịch thanh toán</span>
                  <select
                    value={selectedTransactionId}
                    onChange={(event) => setSelectedTransactionId(event.target.value)}
                    disabled={!transactions.length}
                  >
                    <option value="">{transactions.length ? 'Chọn giao dịch cần đối soát' : 'Không có giao dịch trong danh sách lọc'}</option>
                    {transactions.map((item) => {
                      const transactionId = item.paymentTransactionId ?? item.PaymentTransactionId
                      const amount = item.transferAmount ?? item.TransferAmount
                      const code = item.paymentCode ?? item.PaymentCode ?? item.referenceCode ?? item.ReferenceCode
                      return (
                        <option key={transactionId} value={transactionId}>
                          {`#${transactionId} • ${dinhDangTien(amount)} • ${code || 'Không có mã'}`}
                        </option>
                      )
                    })}
                  </select>
                </label>

                <label className="truong">
                  <span>InvoiceId</span>
                  <input type="number" min="1" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} placeholder="Nhập mã hóa đơn cần khớp" />
                </label>
              </div>

              {trangThai ? <div className={`thanh-trang-thai ${mauTrangThai}`}>{trangThai}</div> : null}

              <div className="invoice-modal-actions">
                <button
                  type="button"
                  className="nut"
                  onClick={doiSoat}
                  disabled={dangGui || !selectedTransactionId || !invoiceId}
                >
                  {dangGui ? 'Đang đối soát...' : 'Xác nhận đối soát'}
                </button>
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </>
  )
}

function MeterReadingCreateButton({ onSuccess }) {
  const [dangMo, setDangMo] = useState(false)
  const [roomOptions, setRoomOptions] = useState([])
  const [roomOptionsLoading, setRoomOptionsLoading] = useState(true)
  const [meterReadingHistory, setMeterReadingHistory] = useState([])
  const [billingMonth, setBillingMonth] = useState(taoThangMacDinh())
  const [bulkReadings, setBulkReadings] = useState({})
  const [bulkImageFiles, setBulkImageFiles] = useState({})
  const [dangLuuTungDong, setDangLuuTungDong] = useState({})
  const [dangLuuTatCa, setDangLuuTatCa] = useState(false)
  const [trangThai, setTrangThai] = useState('')
  const [mauTrangThai, setMauTrangThai] = useState('')

  useEffect(() => {
    if (!dangMo) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDangMo(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dangMo])

  useEffect(() => {
    if (!dangMo) return undefined

    let active = true

    async function taiPhongDangActive() {
      setRoomOptionsLoading(true)
      try {
        const result = await guiRequest('/api/Contracts?status=active', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })

        const payload = result.payload
        const historyResult = await guiRequest('/api/MeterReadings', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        const historyPayload = historyResult.payload
        const contracts = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.items)
              ? payload.items
              : []
        const history = Array.isArray(historyPayload)
          ? historyPayload
          : Array.isArray(historyPayload?.data)
            ? historyPayload.data
            : Array.isArray(historyPayload?.items)
              ? historyPayload.items
              : []

        if (!active) return

        const nextOptions = contracts
          .map((contract) => {
            const roomCode = contract.roomCode ?? contract.RoomCode
            const roomId = contract.roomId ?? contract.RoomId
            const contractId = contract.contractId ?? contract.ContractId
            const tenantName = contract.tenantName ?? contract.TenantName

            if (!roomCode || roomId == null || contractId == null) return null

            return {
              value: String(roomCode),
              label: tenantName ? `${roomCode} - ${tenantName}` : String(roomCode),
              roomId: Number(roomId),
              contractId: Number(contractId),
            }
          })
          .filter(Boolean)
          .sort((a, b) => soSanhMaPhong(a.value, b.value))

        setRoomOptions(nextOptions)
        setMeterReadingHistory(history)
      } catch (error) {
        if (!active) return
        setTrangThai(thongDiepLoi(error))
        setMauTrangThai('that-bai')
        setRoomOptions([])
        setMeterReadingHistory([])
      } finally {
        if (active) setRoomOptionsLoading(false)
      }
    }

    taiPhongDangActive()
    return () => {
      active = false
    }
  }, [dangMo])

  useEffect(() => {
    setBulkReadings((current) => {
      const next = {}
      roomOptions.forEach((option) => {
        const key = `${option.roomId}-${option.contractId}`
        next[key] = current[key] ?? ''
      })
      return next
    })
  }, [roomOptions])

  const resetMessages = () => {
    setTrangThai('')
    setMauTrangThai('')
  }

  const chiSoThangTruocTheoPhong = useMemo(() => {
    const map = new Map()

    meterReadingHistory.forEach((item) => {
      const roomId = Number(item.roomId ?? item.RoomId)
      const billingDate = String(item.billingMonth ?? item.BillingMonth ?? '')
      const currentReading = item.currentReading ?? item.CurrentReading

      if (!Number.isFinite(roomId) || !billingDate || currentReading == null) return

      const currentBest = map.get(roomId)
      if (!currentBest || billingDate > currentBest.billingDate) {
        map.set(roomId, {
          billingDate,
          currentReading,
        })
      }
    })

    return map
  }, [meterReadingHistory])

  const capNhatChiSoDong = (rowKey, value) => {
    setBulkReadings((current) => ({
      ...current,
      [rowKey]: value,
    }))
  }

  const capNhatAnhDong = (rowKey, file) => {
    setBulkImageFiles((current) => ({
      ...current,
      [rowKey]: file || null,
    }))
  }

  const uploadAnhCongTo = async (meterReadingId, imageFile) => {
    if (!imageFile) return
    if (!meterReadingId) {
      throw new Error('Không lấy được mã bản ghi để lưu ảnh công tơ.')
    }

    const formData = new FormData()
    formData.append('image', imageFile)

    await guiRequest(`/api/MeterReadings/${meterReadingId}/image`, {
      method: 'POST',
      body: formData,
    })
  }

  const luuMotDong = async (option) => {
    const rowKey = `${option.roomId}-${option.contractId}`
    const readingValue = bulkReadings[rowKey]

    if (readingValue === '' || readingValue === null || readingValue === undefined) {
      setTrangThai(`Vui lòng nhập chỉ số điện cho phòng ${option.value}.`)
      setMauTrangThai('that-bai')
      return
    }

    setDangLuuTungDong((current) => ({ ...current, [rowKey]: true }))
    resetMessages()

    try {
      const result = await guiRequest('/api/MeterReadings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: Number(option.roomId),
          contractId: Number(option.contractId),
          billingMonth,
          currentReading: Number(readingValue),
        }),
      })
      const meterReadingId = result.payload?.meterReadingId ?? result.payload?.MeterReadingId
      await uploadAnhCongTo(meterReadingId, bulkImageFiles[rowKey])

      setTrangThai(`Đã lưu chỉ số điện cho phòng ${option.value}.`)
      setMauTrangThai('thanh-cong')
      if (onSuccess) onSuccess()
    } catch (error) {
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
    } finally {
      setDangLuuTungDong((current) => ({ ...current, [rowKey]: false }))
    }
  }

  const luuTatCa = async () => {
    const rowsToSave = roomOptions
      .map((option) => ({
        option,
        rowKey: `${option.roomId}-${option.contractId}`,
        readingValue: bulkReadings[`${option.roomId}-${option.contractId}`],
        imageFile: bulkImageFiles[`${option.roomId}-${option.contractId}`],
      }))
      .filter((item) => item.readingValue !== '' && item.readingValue !== null && item.readingValue !== undefined)

    if (!rowsToSave.length) {
      setTrangThai('Vui lòng nhập ít nhất một chỉ số điện trước khi lưu tất cả.')
      setMauTrangThai('that-bai')
      return
    }

    setDangLuuTatCa(true)
    resetMessages()

    let thanhCong = 0
    let thatBai = 0
    for (const item of rowsToSave) {
      try {
        const result = await guiRequest('/api/MeterReadings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: Number(item.option.roomId),
            contractId: Number(item.option.contractId),
            billingMonth,
            currentReading: Number(item.readingValue),
          }),
        })
        const meterReadingId = result.payload?.meterReadingId ?? result.payload?.MeterReadingId
        await uploadAnhCongTo(meterReadingId, item.imageFile)
        thanhCong += 1
      } catch {
        thatBai += 1
      }
    }

    if (thanhCong > 0 && onSuccess) onSuccess()
    if (thatBai === 0) {
      setTrangThai(`Đã lưu thành công ${thanhCong} phòng.`)
      setMauTrangThai('thanh-cong')
    } else {
      setTrangThai(`Đã lưu ${thanhCong} phòng, lỗi ${thatBai} phòng.`)
      setMauTrangThai(thanhCong > 0 ? 'thanh-cong' : 'that-bai')
    }
    setDangLuuTatCa(false)
  }

  return (
    <>
      <button type="button" className="nut nut--phu meter-toolbar-button meter-toolbar-button--create" onClick={() => setDangMo(true)}>
        Tạo bản ghi chỉ số
      </button>

      {dangMo ? (
        <div className="lop-phu-endpoint" onClick={() => setDangMo(false)}>
          <div className="hop-endpoint-mo" onClick={(event) => event.stopPropagation()}>
            <article className="the-endpoint the-endpoint--mo invoice-modal-card">
              <div className="the-endpoint__dau">
                <div>
                  <span className="method-tag method-tag--post">POST</span>
                  <h3>Tạo bản ghi chỉ số điện nước</h3>
                </div>
                <button type="button" className="nut-dong-endpoint" onClick={() => setDangMo(false)}>
                  ×
                </button>
              </div>

              <div className="invoice-edit-form meter-capture-form">
                <label className="truong">
                  <span>Tháng ghi chỉ số</span>
                  <input
                    type="month"
                    value={String(billingMonth || '').slice(0, 7)}
                    onChange={(event) => setBillingMonth(chuanHoaGiaTriThang(event.target.value))}
                  />
                </label>
              </div>

              <div className="meter-bulk-table-wrap">
                <table className="meter-bulk-table meter-bulk-table--images">
                  <thead>
                    <tr>
                      <th>Phòng</th>
                      <th>Chỉ số điện tháng trước</th>
                      <th>Ảnh công tơ</th>
                      <th>Chỉ số điện ghi nhận</th>
                      <th>Lưu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomOptionsLoading ? (
                      <tr>
                        <td colSpan="5">Đang tải danh sách phòng active...</td>
                      </tr>
                    ) : roomOptions.length ? (
                      roomOptions.map((option) => {
                        const rowKey = `${option.roomId}-${option.contractId}`
                        const previousReading = chiSoThangTruocTheoPhong.get(Number(option.roomId))
                        const selectedFile = bulkImageFiles[rowKey]
                        return (
                          <tr key={rowKey}>
                            <td>{option.value}</td>
                            <td>
                              {previousReading
                                ? giaTriDep(previousReading.currentReading, 'currentReading')
                                : 'Chưa có chỉ số trước đó'}
                            </td>
                            <td>
                              <div className="meter-bulk-table__image-cell">
                                <input type="file" accept="image/*" onChange={(event) => capNhatAnhDong(rowKey, event.target.files?.[0] || null)} />
                                <small>{selectedFile ? selectedFile.name : 'Chưa chọn ảnh công tơ'}</small>
                              </div>
                            </td>
                            <td>
                              <div className="meter-bulk-table__reading-cell">
                                <input
                                  type="number"
                                  min="0"
                                  value={bulkReadings[rowKey] ?? ''}
                                  onChange={(event) => capNhatChiSoDong(rowKey, event.target.value)}
                                  placeholder="Nhập chỉ số điện"
                                />
                                <small>Nhập thủ công, ảnh chỉ dùng để lưu đối chiếu.</small>
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="nut nut--phu meter-bulk-table__save"
                                onClick={() => luuMotDong(option)}
                                disabled={!!dangLuuTungDong[rowKey] || dangLuuTatCa}
                              >
                                {dangLuuTungDong[rowKey] ? 'Đang lưu...' : 'Lưu'}
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan="5">Không có phòng đang active.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {trangThai ? <div className={`thanh-trang-thai ${mauTrangThai}`}>{trangThai}</div> : null}

              <div className="invoice-modal-actions">
                <button type="button" className="nut" onClick={luuTatCa} disabled={dangLuuTatCa || roomOptionsLoading || !roomOptions.length}>
                  {dangLuuTatCa ? 'Đang lưu tất cả...' : 'Lưu tất cả'}
                </button>
              </div>
            </article>
          </div>
        </div>
      ) : null}

    </>
  )
}

function RoomsWorkspace({ spec }) {
  const [rooms, setRooms] = useState([])
  const [phongFilter, setPhongFilter] = useState('')
  const [trangThaiFilter, setTrangThaiFilter] = useState('all')
  const [dangTai, setDangTai] = useState(false)
  const [loi, setLoi] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const roomActions = useMemo(() => {
    const actions = Object.entries(spec?.paths || {})
      .filter(([path]) => path.toLowerCase().startsWith('/api/rooms'))
      .flatMap(([path, pathItem]) =>
        METHOD_ORDER.filter((method) => pathItem[method]).map((method) => ({
          path,
          method,
          operation: pathItem[method],
        })),
      )
      .filter((item) => {
        const method = item.method.toLowerCase()
        const path = item.path.toLowerCase()
        return (
          (method === 'post' && path === '/api/rooms') ||
          (method === 'put' && (path === '/api/rooms/{id:int}' || path === '/api/rooms/{id}')) ||
          (method === 'patch' && (path === '/api/rooms/{id:int}/status' || path === '/api/rooms/{id}/status'))
        )
      })
      .sort((a, b) => sapXepEndpoint('rooms', a, b))

    const seen = new Set()
    return actions.filter((item) => {
      const key = `${item.method.toLowerCase()} ${item.path.toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [spec])

  useEffect(() => {
    let ignore = false

    async function taiDanhSachPhong() {
      setDangTai(true)
      setLoi('')
      try {
        const query = new URLSearchParams()
        if (trangThaiFilter !== 'all') {
          query.set('status', trangThaiFilter)
        }

        const result = await guiRequest(`/api/Rooms${query.toString() ? `?${query.toString()}` : ''}`, {
          method: 'GET',
        })

        if (!ignore) {
          setRooms(Array.isArray(result.payload) ? result.payload : [])
        }
      } catch (error) {
        if (!ignore) {
          setLoi(error.message || 'Không tải được danh sách phòng.')
          setRooms([])
        }
      } finally {
        if (!ignore) {
          setDangTai(false)
        }
      }
    }

    taiDanhSachPhong()
    return () => {
      ignore = true
    }
  }, [reloadKey, trangThaiFilter])

  const danhSachLoc = useMemo(() => {
    const phongDaLoc = phongFilter.trim().toLowerCase()
    return rooms
      .filter((room) => {
        const roomCode = String(room.roomCode ?? room.RoomCode ?? '').trim().toLowerCase()
        return !phongDaLoc || roomCode.includes(phongDaLoc)
      })
      .sort((a, b) => soSanhMaPhong(a.roomCode ?? a.RoomCode, b.roomCode ?? b.RoomCode))
  }, [rooms, phongFilter])

  const tongPhong = rooms.length
  const phongDaChoThue = rooms.filter((room) => String(room.status ?? room.Status ?? '').toLowerCase() === 'occupied').length
  const phongConTrong = rooms.filter((room) => String(room.status ?? room.Status ?? '').toLowerCase() === 'vacant').length

  return (
    <div className="invoice-workspace rooms-workspace">
      <section className="invoice-hero khung">
        <div className="invoice-hero__main">
          <p className="nhan">Phòng</p>
          <div className="invoice-toolbar rooms-toolbar">
            <label className="invoice-search">
              <span>Mã phòng</span>
              <input type="text" value={phongFilter} onChange={(event) => setPhongFilter(event.target.value)} placeholder="Nhập mã phòng" />
            </label>
            <label className="invoice-search invoice-search--status">
              <span>Trạng thái phòng</span>
              <select value={trangThaiFilter} onChange={(event) => setTrangThaiFilter(event.target.value)}>
                <option value="all">Tất cả</option>
                <option value="occupied">Đã cho thuê</option>
                <option value="vacant">Chưa cho thuê</option>
              </select>
            </label>
            <button type="button" className="nut nut--phu rooms-toolbar-refresh" onClick={() => setReloadKey((value) => value + 1)} disabled={dangTai}>
              {dangTai ? 'Đang tải...' : 'Làm mới danh sách'}
            </button>
          </div>
        </div>
      </section>

      {roomActions.length ? (
        <section className="khung invoice-actions-card">
          <div className="danh-sach-endpoint invoice-actions-inline">
            {roomActions.map((item) => (
              <EndpointCard
                key={`${item.method}-${item.path}`}
                method={item.method}
                moduleKey="rooms"
                operation={item.operation}
                path={item.path}
                spec={spec}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="invoice-stats">
        <article className="invoice-stat-card">
          <span>Tổng số phòng</span>
          <strong>{tongPhong}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Đã cho thuê</span>
          <strong>{phongDaChoThue}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Chưa cho thuê</span>
          <strong>{phongConTrong}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Hiển thị</span>
          <strong>{`${danhSachLoc.length}/${rooms.length}`}</strong>
        </article>
      </section>

      <section className="khung">
        <div className="xem-truoc__dau">
          <strong>Danh sách phòng</strong>
          <span>{`Hiển thị ${danhSachLoc.length}/${rooms.length} phòng`}</span>
        </div>
        {loi ? <div className="thong-bao-loi">{loi}</div> : null}
        {dangTai ? (
          <div className="khung-du-lieu khung-du-lieu--trong">Đang tải danh sách phòng...</div>
        ) : danhSachLoc.length ? (
          <XemDanhSachPhong data={danhSachLoc} hideSearch />
        ) : (
          <div className="khung-du-lieu khung-du-lieu--trong">Không có phòng nào khớp với bộ lọc hiện tại.</div>
        )}
      </section>
    </div>
  )
}

function MeterReadingWorkspace() {
  const [meterReadings, setMeterReadings] = useState([])
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [dangSuaId, setDangSuaId] = useState(null)
  const [dangXoaId, setDangXoaId] = useState(null)
  const [chiSoDangSua, setChiSoDangSua] = useState(null)
  const [chiSoDangXoa, setChiSoDangXoa] = useState(null)
  const [chiSoMoi, setChiSoMoi] = useState('')
  const [phongFilter, setPhongFilter] = useState('')
  const [thangNamFilter, setThangNamFilter] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    async function taiDanhSachChiSo() {
      setDangTai(true)
      setLoi('')

      try {
        const result = await guiRequest('/api/MeterReadings', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })

        const payload = result.payload
        const danhSach = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.items)
              ? payload.items
              : []

        if (active) setMeterReadings(danhSach)
      } catch (error) {
        if (active) {
          setLoi(thongDiepLoi(error))
          setMeterReadings([])
        }
      } finally {
        if (active) setDangTai(false)
      }
    }

    taiDanhSachChiSo()
    return () => {
      active = false
    }
  }, [reloadKey])

  const danhSachLoc = useMemo(() => {
    const phongDaLoc = String(phongFilter || '').trim().toLowerCase()

    return meterReadings.filter((item) => {
      const roomCode = String(item.roomCode ?? item.RoomCode ?? '').trim().toLowerCase()
      const billingMonth = String(item.billingMonth ?? item.BillingMonth ?? '')
      const monthValue = billingMonth ? billingMonth.slice(0, 7) : ''

      return (!phongDaLoc || roomCode.includes(phongDaLoc)) && (!thangNamFilter || monthValue === thangNamFilter)
    })
  }, [meterReadings, phongFilter, thangNamFilter])

  const moSuaChiSo = (item) => {
    setChiSoDangSua(item)
    setChiSoMoi(String(item.currentReading ?? item.CurrentReading ?? ''))
    setLoi('')
  }

  const dongSuaChiSo = () => {
    if (dangSuaId) return
    setChiSoDangSua(null)
    setChiSoMoi('')
  }

  const moXoaChiSo = (item) => {
    setChiSoDangXoa(item)
    setLoi('')
  }

  const dongXoaChiSo = () => {
    if (dangXoaId) return
    setChiSoDangXoa(null)
  }

  const thucHienSuaChiSo = async () => {
    if (!chiSoDangSua) return

    const meterReadingId = chiSoDangSua.meterReadingId ?? chiSoDangSua.MeterReadingId
    const roomCode = chiSoDangSua.roomCode ?? chiSoDangSua.RoomCode
    const billingMonth = chiSoDangSua.billingMonth ?? chiSoDangSua.BillingMonth

    setDangSuaId(meterReadingId)
    setLoi('')

    try {
      await guiRequest('/api/MeterReadings/current-reading', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meterReadingId: Number(meterReadingId),
          roomCode,
          billingMonth,
          currentReading: Number(chiSoMoi),
        }),
      })
      setChiSoDangSua(null)
      setChiSoMoi('')
      setReloadKey((value) => value + 1)
    } catch (error) {
      setLoi(thongDiepLoi(error))
    } finally {
      setDangSuaId(null)
    }
  }

  const thucHienXoaChiSo = async () => {
    if (!chiSoDangXoa) return

    const meterReadingId = chiSoDangXoa.meterReadingId ?? chiSoDangXoa.MeterReadingId
    setDangXoaId(meterReadingId)
    setLoi('')

    try {
      await guiRequest(`/api/MeterReadings/${meterReadingId}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      })
      setChiSoDangXoa(null)
      setReloadKey((value) => value + 1)
    } catch (error) {
      setLoi(thongDiepLoi(error))
    } finally {
      setDangXoaId(null)
    }
  }

  return (
    <div className="invoice-workspace meter-workspace">
      <section className="invoice-hero khung">
        <div className="invoice-hero__main">
          <div className="meter-toolbar-actions">
            <div className="meter-toolbar-group">
              <MeterReadingCreateButton onSuccess={() => setReloadKey((value) => value + 1)} />
            </div>
          </div>
        </div>
      </section>

      <section className="khung">
        <div className="xem-truoc__dau">
          <strong>Danh sách chỉ số điện</strong>
        </div>
        <div className="meter-list-filters">
          <label className="invoice-search">
            <span>Phòng</span>
            <input type="text" value={phongFilter} onChange={(event) => setPhongFilter(event.target.value)} placeholder="Nhập mã phòng" />
          </label>
          <MonthYearFilter label="Tháng - năm" value={thangNamFilter} onChange={setThangNamFilter} />
          <button
            type="button"
            className="nut nut--phu meter-toolbar-inline-button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={dangTai}
          >
            {dangTai ? 'Đang tải...' : 'Làm mới danh sách'}
          </button>
        </div>
        {loi ? <div className="thong-bao-loi">{loi}</div> : null}
        {dangTai ? (
          <div className="khung-du-lieu khung-du-lieu--trong">Đang tải danh sách chỉ số điện...</div>
        ) : danhSachLoc.length ? (
          <div className="invoice-list-wrap">
            <XemDanhSachChiSoDien
              data={danhSachLoc}
              onEdit={moSuaChiSo}
              editingId={dangSuaId}
              onDelete={moXoaChiSo}
              deletingId={dangXoaId}
            />
          </div>
        ) : (
          <div className="khung-du-lieu khung-du-lieu--trong">
            {phongFilter.trim() || thangNamFilter ? 'Không có bản ghi chỉ số nào khớp với bộ lọc hiện tại.' : 'Chưa có chỉ số điện nào trong hệ thống.'}
          </div>
        )}
      </section>

      {chiSoDangSua ? (
        <div className="lop-phu-endpoint" onClick={dongSuaChiSo}>
          <div className="hop-endpoint-mo" onClick={(event) => event.stopPropagation()}>
            <article className="the-endpoint the-endpoint--mo invoice-modal-card">
              <div className="the-endpoint__dau">
                <div>
                  <span className="method-tag method-tag--patch">PATCH</span>
                  <h3>Sửa chỉ số</h3>
                </div>
                <button type="button" className="nut-dong-endpoint" onClick={dongSuaChiSo} disabled={!!dangSuaId}>
                  ×
                </button>
              </div>

              <div className="invoice-edit-form meter-capture-form meter-original-edit-form">
                <label className="truong">
                  <span>Phòng</span>
                  <input type="text" value={chiSoDangSua.roomCode ?? chiSoDangSua.RoomCode ?? ''} readOnly />
                </label>
                <label className="truong">
                  <span>Tháng cần sửa</span>
                  <input type="text" value={giaTriDep(chiSoDangSua.billingMonth ?? chiSoDangSua.BillingMonth, 'billingMonth')} readOnly />
                </label>
                <label className="truong">
                  <span>Chỉ số tháng trước</span>
                  <input type="text" value={giaTriDep(chiSoDangSua.previousReading ?? chiSoDangSua.PreviousReading, 'previousReading')} readOnly />
                </label>
                <label className="truong">
                  <span>Chỉ số điện mới</span>
                  <input type="number" min="0" value={chiSoMoi} onChange={(event) => setChiSoMoi(event.target.value)} placeholder="Ví dụ: 1530" />
                </label>
              </div>

              <div className="invoice-modal-actions">
                <button type="button" className="nut nut--phu" onClick={dongSuaChiSo} disabled={!!dangSuaId}>
                  Hủy
                </button>
                <button type="button" className="nut" onClick={thucHienSuaChiSo} disabled={!!dangSuaId || chiSoMoi === ''}>
                  {dangSuaId ? 'Đang cập nhật...' : 'Cập nhật'}
                </button>
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {chiSoDangXoa ? (
        <div className="lop-phu-endpoint" onClick={dongXoaChiSo}>
          <div className="hop-endpoint-mo" onClick={(event) => event.stopPropagation()}>
            <article className="the-endpoint the-endpoint--mo invoice-modal-card">
              <div className="the-endpoint__dau">
                <div>
                  <span className="method-tag method-tag--delete">DELETE</span>
                  <h3>Xóa chỉ số</h3>
                </div>
                <button type="button" className="nut-dong-endpoint" onClick={dongXoaChiSo} disabled={!!dangXoaId}>
                  ×
                </button>
              </div>

              <p>
                Bạn có chắc muốn xóa chỉ số điện phòng <strong>{chiSoDangXoa.roomCode ?? chiSoDangXoa.RoomCode ?? 'này'}</strong> tháng{' '}
                <strong>{giaTriDep(chiSoDangXoa.billingMonth ?? chiSoDangXoa.BillingMonth, 'billingMonth')}</strong> không?
              </p>

              <div className="invoice-modal-actions">
                <button type="button" className="nut nut--phu" onClick={dongXoaChiSo} disabled={!!dangXoaId}>
                  Hủy
                </button>
                <button type="button" className="nut" onClick={thucHienXoaChiSo} disabled={!!dangXoaId}>
                  {dangXoaId ? 'Đang xóa...' : 'Xóa chỉ số'}
                </button>
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PaymentWorkspace() {
  const [transactions, setTransactions] = useState([])
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [tuKhoaFilter, setTuKhoaFilter] = useState('')
  const [trangThaiFilter, setTrangThaiFilter] = useState('all')
  const [reloadKey, setReloadKey] = useState(0)
  const [xacNhanXoa, setXacNhanXoa] = useState(null)
  const [dangXoaId, setDangXoaId] = useState(null)
  const realtimeReloadKey = useRealtimeReload(['payments', 'invoices'])

  useEffect(() => {
    let active = true

    async function taiDanhSachGiaoDich() {
      setDangTai(true)
      setLoi('')

      try {
        const query = new URLSearchParams()
        if (trangThaiFilter !== 'all') query.set('processStatus', trangThaiFilter)

        const result = await guiRequest(`/api/Payments/transactions${query.toString() ? `?${query.toString()}` : ''}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })

        const payload = result.payload
        const danhSach = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.items)
              ? payload.items
              : []

        if (active) setTransactions(danhSach)
      } catch (error) {
        if (active) {
          setLoi(thongDiepLoi(error))
          setTransactions([])
        }
      } finally {
        if (active) setDangTai(false)
      }
    }

    taiDanhSachGiaoDich()
    return () => {
      active = false
    }
  }, [reloadKey, realtimeReloadKey, trangThaiFilter])

  const giaoDichHopLe = useMemo(() => {
    return transactions.filter((item) => {
      const paymentCode = item.paymentCode ?? item.PaymentCode
      return laPaymentCodeHoaDonHopLe(paymentCode)
    })
  }, [transactions])

  const danhSachLoc = useMemo(() => {
    const keyword = String(tuKhoaFilter || '').trim().toLowerCase()
    if (!keyword) return giaoDichHopLe

    return giaoDichHopLe.filter((item) => {
      const targets = [
        item.provider ?? item.Provider,
        item.providerTransactionId ?? item.ProviderTransactionId,
        item.referenceCode ?? item.ReferenceCode,
        item.paymentCode ?? item.PaymentCode,
        item.accountNumber ?? item.AccountNumber,
        item.content ?? item.Content,
        item.matchedInvoiceId ?? item.MatchedInvoiceId,
      ]

      return targets.some((value) => String(value ?? '').toLowerCase().includes(keyword))
    })
  }, [giaoDichHopLe, tuKhoaFilter])

  const moXacNhanXoa = (transaction) => {
    const paymentTransactionId = transaction?.paymentTransactionId ?? transaction?.PaymentTransactionId
    if (!paymentTransactionId) return

    setXacNhanXoa({
      paymentTransactionId,
      paymentCode: transaction?.paymentCode ?? transaction?.PaymentCode ?? '',
    })
  }

  const xoaGiaoDichThanhToan = async () => {
    const paymentTransactionId = xacNhanXoa?.paymentTransactionId
    if (!paymentTransactionId) return

    setDangXoaId(paymentTransactionId)
    setLoi('')

    try {
      await guiRequest(`/api/Payments/transactions/${paymentTransactionId}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      })
      setXacNhanXoa(null)
      setReloadKey((value) => value + 1)
    } catch (error) {
      setLoi(thongDiepLoi(error))
    } finally {
      setDangXoaId(null)
    }
  }

  return (
    <div className="invoice-workspace payment-workspace">
      <section className="invoice-hero khung">
        <div className="invoice-hero__main">
          <p className="nhan">Thanh toán</p>
          <div className="invoice-toolbar payment-toolbar">
            <label className="invoice-search payment-search">
              <span>Tra cứu giao dịch</span>
              <input
                type="text"
                value={tuKhoaFilter}
                onChange={(event) => setTuKhoaFilter(event.target.value)}
                placeholder="Mã giao dịch, mã thanh toán, nội dung..."
              />
            </label>
            <label className="invoice-search invoice-search--status">
              <span>Trạng thái xử lý</span>
              <select value={trangThaiFilter} onChange={(event) => setTrangThaiFilter(event.target.value)}>
                <option value="all">Tất cả</option>
                <option value="paid">Đã thanh toán</option>
                <option value="pending">Chờ xử lý</option>
                <option value="processed">Đã xử lý</option>
                <option value="ignored">Bỏ qua</option>
                <option value="failed">Thất bại</option>
              </select>
            </label>
            <button type="button" className="nut nut--phu payment-toolbar-refresh" onClick={() => setReloadKey((value) => value + 1)} disabled={dangTai}>
              {dangTai ? 'Đang tải...' : 'Làm mới danh sách'}
            </button>
          </div>
        </div>
      </section>

      <section className="khung">
        <div className="xem-truoc__dau">
          <strong>Danh sách giao dịch thanh toán</strong>
            <span>
              {tuKhoaFilter.trim() || trangThaiFilter !== 'all'
                ? `Hiển thị ${danhSachLoc.length}/${giaoDichHopLe.length} giao dịch`
                : `Hiển thị ${giaoDichHopLe.length} giao dịch`}
            </span>
          </div>
        {loi ? <div className="thong-bao-loi">{loi}</div> : null}
        {dangTai ? (
          <div className="khung-du-lieu khung-du-lieu--trong">Đang tải danh sách giao dịch thanh toán...</div>
        ) : danhSachLoc.length ? (
          <div className="invoice-list-wrap">
            <XemDanhSachGiaoDichThanhToan data={danhSachLoc} onDelete={moXacNhanXoa} deletingId={dangXoaId} />
          </div>
        ) : (
          <div className="khung-du-lieu khung-du-lieu--trong">
            {tuKhoaFilter.trim() || trangThaiFilter !== 'all'
              ? 'Không có giao dịch nào khớp với bộ lọc hiện tại.'
              : 'Chưa có giao dịch thanh toán nào trong hệ thống.'}
          </div>
        )}
      </section>

      {xacNhanXoa ? (
        <div className="lop-phu-endpoint" onClick={() => !dangXoaId && setXacNhanXoa(null)}>
          <div className="hop-endpoint-mo" onClick={(event) => event.stopPropagation()}>
            <article className="the-endpoint the-endpoint--mo invoice-modal-card">
              <div className="the-endpoint__dau">
                <div>
                  <span className="method-tag method-tag--delete">DELETE</span>
                  <h3>Xóa giao dịch thanh toán</h3>
                </div>
                <button type="button" className="nut-dong-endpoint" onClick={() => setXacNhanXoa(null)} disabled={!!dangXoaId}>
                  ×
                </button>
              </div>

              <p>
                Bạn có chắc muốn xóa giao dịch thanh toán này
                {xacNhanXoa.paymentCode ? (
                  <>
                    {' '}
                    với mã <strong>{xacNhanXoa.paymentCode}</strong>
                  </>
                ) : null}
                ?
              </p>

              <div className="invoice-modal-actions">
                <button type="button" className="nut nut--phu" onClick={() => setXacNhanXoa(null)} disabled={!!dangXoaId}>
                  Hủy
                </button>
                <button type="button" className="nut" onClick={xoaGiaoDichThanhToan} disabled={!!dangXoaId}>
                  {dangXoaId ? 'Đang xóa...' : 'Xác nhận xóa'}
                </button>
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function dinhDangLoaiThuChi(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (normalized === 'income') return 'Thu'
  if (normalized === 'expense') return 'Chi'
  return value || 'Không có dữ liệu'
}

function dinhDangDanhMucThuChi(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (normalized === 'operating') return 'Vận hành'
  if (normalized === 'other') return 'Khác'
  return value || 'Không có dữ liệu'
}

function layLoaiThuChi(item) {
  return String(item?.transactionDirection ?? item?.TransactionDirection ?? '')
    .trim()
    .toLowerCase()
}

function TransactionCreateButton({ onSuccess }) {
  const [dangMo, setDangMo] = useState(false)
  const [transactionDirection, setTransactionDirection] = useState('income')
  const [category, setCategory] = useState('operating')
  const [amount, setAmount] = useState('')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [relatedRoomId, setRelatedRoomId] = useState('')
  const [rooms, setRooms] = useState([])
  const [dangTaiPhong, setDangTaiPhong] = useState(false)
  const [dangGui, setDangGui] = useState(false)
  const [trangThai, setTrangThai] = useState('')
  const [mauTrangThai, setMauTrangThai] = useState('')

  useEffect(() => {
    if (!dangMo) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDangMo(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dangMo])

  useEffect(() => {
    if (!dangMo) return undefined

    let active = true
    const taiDanhSachPhong = async () => {
      setDangTaiPhong(true)
      try {
        const result = await guiRequest('/api/Rooms', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })

        if (active) {
          setRooms(Array.isArray(result.payload) ? result.payload : [])
        }
      } catch {
        if (active) setRooms([])
      } finally {
        if (active) setDangTaiPhong(false)
      }
    }

    taiDanhSachPhong()
    return () => {
      active = false
    }
  }, [dangMo])

  const taoGiaoDich = async () => {
    setDangGui(true)
    setTrangThai('')
    setMauTrangThai('')

    try {
      await guiRequest('/api/Transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionDirection,
          category,
          amount: chuyenTienVeSo(amount),
          transactionDate,
          description: description.trim() || null,
          relatedRoomId: relatedRoomId ? Number(relatedRoomId) : null,
        }),
      })

      setTrangThai('Đã tạo giao dịch thu chi thành công.')
      setMauTrangThai('thanh-cong')
      setDangMo(false)
      if (onSuccess) onSuccess()
    } catch (error) {
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
    } finally {
      setDangGui(false)
    }
  }

  return (
    <>
      <button type="button" className="nut nut--phu payment-toolbar-button" onClick={() => setDangMo(true)}>
        Tạo giao dịch thu chi
      </button>

      {dangMo ? (
        <div className="lop-phu-endpoint" onClick={() => setDangMo(false)}>
          <div className="hop-endpoint-mo" onClick={(event) => event.stopPropagation()}>
            <article className="the-endpoint the-endpoint--mo invoice-modal-card">
              <div className="the-endpoint__dau">
                <div>
                  <span className="method-tag method-tag--post">POST</span>
                  <h3>Tạo giao dịch thu chi</h3>
                </div>
                <button type="button" className="nut-dong-endpoint" onClick={() => setDangMo(false)}>
                  ×
                </button>
              </div>

              <div className="invoice-edit-form payment-reconcile-form">
                <label className="truong">
                  <span>Loại giao dịch</span>
                  <select value={transactionDirection} onChange={(event) => setTransactionDirection(event.target.value)}>
                    <option value="income">Thu</option>
                    <option value="expense">Chi</option>
                  </select>
                </label>
                <label className="truong">
                  <span>Danh mục</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option value="operating">Vận hành</option>
                    <option value="other">Khác</option>
                  </select>
                </label>
                <label className="truong">
                  <span>Số tiền</span>
                  <input type="text" value={amount} onChange={(event) => setAmount(chuanHoaTienKhiNhap(event.target.value))} placeholder="Nhập số tiền" />
                </label>
                <label className="truong">
                  <span>Ngày giao dịch</span>
                  <input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} />
                </label>
                <label className="truong">
                  <span>Phòng liên quan</span>
                  <select value={relatedRoomId} onChange={(event) => setRelatedRoomId(event.target.value)} disabled={dangTaiPhong}>
                    <option value="">{dangTaiPhong ? 'Đang tải danh sách phòng...' : 'Khác / Không cập nhật vào hóa đơn'}</option>
                    {rooms.map((room) => {
                      const roomId = room.roomId ?? room.RoomId
                      const roomCode = room.roomCode ?? room.RoomCode ?? `Phòng #${roomId}`
                      return (
                        <option key={roomId} value={roomId}>
                          {roomCode}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <label className="truong transaction-form__full">
                  <span>Mô tả</span>
                  <input type="text" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ghi chú thêm cho giao dịch" />
                </label>
              </div>

              {relatedRoomId ? (
                <div className="thanh-trang-thai">
                  Hệ thống sẽ tự tìm hóa đơn tháng của phòng theo ngày giao dịch và cộng khoản thu này vào Phí phát sinh.
                </div>
              ) : null}

              {trangThai ? <div className={`thanh-trang-thai ${mauTrangThai}`}>{trangThai}</div> : null}

              <div className="invoice-modal-actions">
                <button type="button" className="nut" onClick={taoGiaoDich} disabled={dangGui || !amount || !transactionDate}>
                  {dangGui ? 'Đang tạo...' : 'Lưu giao dịch'}
                </button>
              </div>
            </article>
          </div>
        </div>
      ) : null}

    </>
  )
}

function TransactionRowActions({ transaction, onReload }) {
  const [dangMoSua, setDangMoSua] = useState(false)
  const [dangXoa, setDangXoa] = useState(false)
  const [transactionDirection, setTransactionDirection] = useState(String(transaction?.transactionDirection ?? transaction?.TransactionDirection ?? 'income').toLowerCase())
  const [category, setCategory] = useState(String(transaction?.category ?? transaction?.Category ?? 'operating').toLowerCase())
  const [amount, setAmount] = useState(dinhDangTienKhongDonVi(transaction?.amount ?? transaction?.Amount ?? ''))
  const [transactionDate, setTransactionDate] = useState(String(transaction?.transactionDate ?? transaction?.TransactionDate ?? ''))
  const [description, setDescription] = useState(transaction?.description ?? transaction?.Description ?? '')
  const [relatedRoomId, setRelatedRoomId] = useState(String(transaction?.relatedRoomId ?? transaction?.RelatedRoomId ?? ''))
  const [rooms, setRooms] = useState([])
  const [dangTaiPhong, setDangTaiPhong] = useState(false)
  const [dangGui, setDangGui] = useState(false)
  const [trangThai, setTrangThai] = useState('')
  const [mauTrangThai, setMauTrangThai] = useState('')

  useEffect(() => {
    if (!dangMoSua) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDangMoSua(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dangMoSua])

  useEffect(() => {
    if (!dangMoSua) return undefined

    let active = true
    const taiDanhSachPhong = async () => {
      setDangTaiPhong(true)
      try {
        const result = await guiRequest('/api/Rooms', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })

        if (active) {
          setRooms(Array.isArray(result.payload) ? result.payload : [])
        }
      } catch {
        if (active) setRooms([])
      } finally {
        if (active) setDangTaiPhong(false)
      }
    }

    taiDanhSachPhong()
    return () => {
      active = false
    }
  }, [dangMoSua])

  const transactionId = transaction?.transactionId ?? transaction?.TransactionId

  const capNhat = async () => {
    setDangGui(true)
    setTrangThai('')
    setMauTrangThai('')

    try {
      await guiRequest(`/api/Transactions/${transactionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionDirection,
          category,
          amount: chuyenTienVeSo(amount),
          transactionDate,
          description: String(description || '').trim() || null,
          relatedRoomId: relatedRoomId ? Number(relatedRoomId) : null,
        }),
      })

      setTrangThai('Đã cập nhật giao dịch thành công.')
      setMauTrangThai('thanh-cong')
      setDangMoSua(false)
      if (onReload) onReload()
    } catch (error) {
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
    } finally {
      setDangGui(false)
    }
  }

  const xoa = async () => {
    setDangXoa(true)
    try {
      await guiRequest(`/api/Transactions/${transactionId}`, {
        method: 'DELETE',
      })
      if (onReload) onReload()
    } catch (error) {
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
    } finally {
      setDangXoa(false)
    }
  }

  return (
    <>
      <div className="invoice-card__button-row">
        <button type="button" className="nut nut--phu invoice-inline-button invoice-inline-button--secondary" onClick={() => setDangMoSua(true)}>
          Sửa giao dịch
        </button>
        <button type="button" className="nut nut--phu invoice-inline-button invoice-action-button invoice-action-button--unpaid" onClick={xoa} disabled={dangXoa}>
          {dangXoa ? 'Đang xóa...' : 'Xóa giao dịch'}
        </button>
      </div>

      {dangMoSua ? (
        <div className="lop-phu-endpoint" onClick={() => setDangMoSua(false)}>
          <div className="hop-endpoint-mo" onClick={(event) => event.stopPropagation()}>
            <article className="the-endpoint the-endpoint--mo invoice-modal-card">
              <div className="the-endpoint__dau">
                <div>
                  <span className="method-tag method-tag--put">PUT</span>
                  <h3>Cập nhật giao dịch thu chi</h3>
                </div>
                <button type="button" className="nut-dong-endpoint" onClick={() => setDangMoSua(false)}>
                  ×
                </button>
              </div>

              <div className="invoice-edit-form payment-reconcile-form">
                <label className="truong">
                  <span>Loại giao dịch</span>
                  <select value={transactionDirection} onChange={(event) => setTransactionDirection(event.target.value)}>
                    <option value="income">Thu</option>
                    <option value="expense">Chi</option>
                  </select>
                </label>
                <label className="truong">
                  <span>Danh mục</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option value="operating">Vận hành</option>
                    <option value="other">Khác</option>
                  </select>
                </label>
                <label className="truong">
                  <span>Số tiền</span>
                  <input type="text" value={amount} onChange={(event) => setAmount(chuanHoaTienKhiNhap(event.target.value))} />
                </label>
                <label className="truong">
                  <span>Ngày giao dịch</span>
                  <input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} />
                </label>
                <label className="truong">
                  <span>Phòng liên quan</span>
                  <select value={relatedRoomId} onChange={(event) => setRelatedRoomId(event.target.value)} disabled={dangTaiPhong}>
                    <option value="">{dangTaiPhong ? 'Đang tải danh sách phòng...' : 'Khác / Không cập nhật vào hóa đơn'}</option>
                    {rooms.map((room) => {
                      const roomId = room.roomId ?? room.RoomId
                      const roomCode = room.roomCode ?? room.RoomCode ?? `Phòng #${roomId}`
                      return (
                        <option key={roomId} value={roomId}>
                          {roomCode}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <label className="truong transaction-form__full">
                  <span>Mô tả</span>
                  <input type="text" value={description} onChange={(event) => setDescription(event.target.value)} />
                </label>
              </div>

              {relatedRoomId ? (
                <div className="thanh-trang-thai">
                  Khi lưu, hệ thống sẽ tự map vào hóa đơn tháng của phòng theo ngày giao dịch.
                </div>
              ) : null}

              {trangThai ? <div className={`thanh-trang-thai ${mauTrangThai}`}>{trangThai}</div> : null}

              <div className="invoice-modal-actions">
                <button type="button" className="nut" onClick={capNhat} disabled={dangGui || !amount || !transactionDate}>
                  {dangGui ? 'Đang cập nhật...' : 'Lưu thay đổi'}
                </button>
              </div>
            </article>
          </div>
        </div>
      ) : null}

    </>
  )
}

function XemDanhSachThuChi({ data, onReload }) {
  if (!Array.isArray(data) || !data.length) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Không có giao dịch thu chi nào.</div>
  }

  return (
    <div className="danh-sach-phong invoice-cards">
      {data.map((item, index) => {
        const transactionId = item.transactionId ?? item.TransactionId ?? index
        const amount = item.amount ?? item.Amount
        const transactionDirection = item.transactionDirection ?? item.TransactionDirection
        const category = item.category ?? item.Category
        const transactionDate = item.transactionDate ?? item.TransactionDate
        const description = item.description ?? item.Description
        const relatedRoomCode = item.relatedRoomCode ?? item.RelatedRoomCode
        const createdAt = item.createdAt ?? item.CreatedAt
        const typeClass = layLoaiThuChi(item)

        return (
          <div key={transactionId} className="dong-phong invoice-card">
            <div className="invoice-card__info">
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Loại giao dịch</span>
                <strong className={`transaction-status transaction-status--${typeClass || 'default'}`}>
                  {dinhDangLoaiThuChi(transactionDirection)}
                </strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Danh mục</span>
                <strong>{dinhDangDanhMucThuChi(category)}</strong>
              </div>
              <div className="dong-phong__o invoice-card__amount">
                <span>Số tiền</span>
                <strong className={`invoice-amount ${typeClass === 'expense' ? 'invoice-amount--unpaid' : 'invoice-amount--paid'}`}>
                  {giaTriDep(amount, 'amount')}
                </strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Ngày giao dịch</span>
                <strong>{giaTriDep(transactionDate, 'transactionDate')}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Phòng liên quan</span>
                <strong>{relatedRoomCode || 'Khác / Không cập nhật hóa đơn'}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Ngày tạo</span>
                <strong>{dinhDangNgayGio(createdAt)}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item transaction-description">
                <span>Mô tả</span>
                <strong>{description || 'Không có dữ liệu'}</strong>
              </div>
            </div>
            <TransactionRowActions transaction={item} onReload={onReload} />
          </div>
        )
      })}
    </div>
  )
}

function TransactionWorkspace() {
  const [transactions, setTransactions] = useState([])
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [thangNamFilter, setThangNamFilter] = useState('')
  const [loaiFilter, setLoaiFilter] = useState('all')
  const [tuKhoaFilter, setTuKhoaFilter] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const realtimeReloadKey = useRealtimeReload(['transactions', 'invoices'])

  useEffect(() => {
    let active = true

    async function taiDanhSachThuChi() {
      setDangTai(true)
      setLoi('')

      try {
        const query = new URLSearchParams()
        if (thangNamFilter) query.set('month', `${thangNamFilter}-01`)
        if (loaiFilter !== 'all') query.set('type', loaiFilter)

        const result = await guiRequest(`/api/Transactions${query.toString() ? `?${query.toString()}` : ''}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })

        const payload = result.payload
        const danhSach = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.items)
              ? payload.items
              : []

        if (active) setTransactions(danhSach)
      } catch (error) {
        if (active) {
          setLoi(thongDiepLoi(error))
          setTransactions([])
        }
      } finally {
        if (active) setDangTai(false)
      }
    }

    taiDanhSachThuChi()
    return () => {
      active = false
    }
  }, [reloadKey, realtimeReloadKey, thangNamFilter, loaiFilter])

  const danhSachLoc = useMemo(() => {
    const keyword = String(tuKhoaFilter || '').trim().toLowerCase()
    if (!keyword) return transactions

    return transactions.filter((item) => {
      const targets = [
        item.transactionId ?? item.TransactionId,
        item.description ?? item.Description,
        item.category ?? item.Category,
        item.relatedInvoiceId ?? item.RelatedInvoiceId,
        item.relatedRoomCode ?? item.RelatedRoomCode,
      ]

      return targets.some((value) => String(value ?? '').toLowerCase().includes(keyword))
    })
  }, [transactions, tuKhoaFilter])

  const tongGiaoDich = danhSachLoc.length
  const tongThu = danhSachLoc.filter((item) => layLoaiThuChi(item) === 'income').reduce((tong, item) => tong + Number(item.amount ?? item.Amount ?? 0), 0)
  const tongChi = danhSachLoc.filter((item) => layLoaiThuChi(item) === 'expense').reduce((tong, item) => tong + Number(item.amount ?? item.Amount ?? 0), 0)
  const chenhLech = tongThu - tongChi

  return (
    <div className="invoice-workspace transaction-workspace">
      <section className="invoice-hero khung">
        <div className="invoice-hero__main">
          <p className="nhan">Thu chi phát sinh</p>
          <div className="invoice-toolbar transaction-toolbar">
            <label className="invoice-search">
              <span>Tra cứu giao dịch</span>
              <input
                type="text"
                value={tuKhoaFilter}
                onChange={(event) => setTuKhoaFilter(event.target.value)}
                placeholder="Mô tả, phòng, invoice..."
              />
            </label>
            <MonthYearFilter label="Tháng - năm" value={thangNamFilter} onChange={setThangNamFilter} />
            <label className="invoice-search invoice-search--status">
              <span>Loại giao dịch</span>
              <select value={loaiFilter} onChange={(event) => setLoaiFilter(event.target.value)}>
                <option value="all">Tất cả</option>
                <option value="income">Thu</option>
                <option value="expense">Chi</option>
              </select>
            </label>
            <button type="button" className="nut nut--phu" onClick={() => setReloadKey((value) => value + 1)} disabled={dangTai}>
              {dangTai ? 'Đang tải...' : 'Làm mới danh sách'}
            </button>
          </div>
          <div className="invoice-toolbar__actions transaction-toolbar__actions">
            <TransactionCreateButton onSuccess={() => setReloadKey((value) => value + 1)} />
          </div>
        </div>
      </section>

      <section className="invoice-stats">
        <article className="invoice-stat-card">
          <span>Tổng giao dịch</span>
          <strong>{tongGiaoDich}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Tổng thu</span>
          <strong className="invoice-amount invoice-amount--paid">{dinhDangTien(tongThu).replace(/\s*VND$/, '')}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Tổng chi</span>
          <strong className="invoice-amount invoice-amount--unpaid">{dinhDangTien(tongChi).replace(/\s*VND$/, '')}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Chênh lệch</span>
          <strong className={`invoice-amount ${chenhLech >= 0 ? 'invoice-amount--paid' : 'invoice-amount--unpaid'}`}>
            {dinhDangTien(chenhLech).replace(/\s*VND$/, '')}
          </strong>
        </article>
      </section>

      <section className="khung">
        <div className="xem-truoc__dau">
          <strong>Danh sách giao dịch thu chi</strong>
          <span>
            {tuKhoaFilter.trim() || thangNamFilter || loaiFilter !== 'all'
              ? `Hiển thị ${danhSachLoc.length}/${transactions.length} giao dịch`
              : `Hiển thị ${transactions.length} giao dịch`}
          </span>
        </div>
        {loi ? <div className="thong-bao-loi">{loi}</div> : null}
        {dangTai ? (
          <div className="khung-du-lieu khung-du-lieu--trong">Đang tải danh sách giao dịch thu chi...</div>
        ) : danhSachLoc.length ? (
          <div className="invoice-list-wrap">
            <XemDanhSachThuChi data={danhSachLoc} onReload={() => setReloadKey((value) => value + 1)} />
          </div>
        ) : (
          <div className="khung-du-lieu khung-du-lieu--trong">
            {tuKhoaFilter.trim() || thangNamFilter || loaiFilter !== 'all'
              ? 'Không có giao dịch nào khớp với bộ lọc hiện tại.'
              : 'Chưa có giao dịch thu chi nào trong hệ thống.'}
          </div>
        )}
      </section>

    </div>
  )
}

function taoDanhSachThangGanNhat(thangKetThuc, soLuong = 6) {
  const [year, month] = String(thangKetThuc || '').split('-').map(Number)
  if (!year || !month) return []

  return Array.from({ length: soLuong }, (_, index) => {
    const date = new Date(year, month - 1 - (soLuong - 1 - index), 1)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })
}

function dinhDangNhanThangNgan(value) {
  if (!value) return ''
  const [year, month] = String(value).split('-')
  if (!year || !month) return String(value)
  return `${month}/${year}`
}

function layGiaTriSo(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function ReportBar({ label, value, maxValue, tone = 'revenue', negative = false }) {
  const safeValue = layGiaTriSo(value)
  const height = `${(Math.abs(safeValue) / Math.max(maxValue, 1)) * 100}%`
  const toneClass = negative ? 'loss' : tone

  return (
    <div className="report-chart__bar-wrap">
      <div className="report-chart__tooltip">
        <span>{dinhDangTien(safeValue)}</span>
      </div>
      <div className={`report-chart__bar report-chart__bar--${toneClass}`} style={{ height }} />
    </div>
  )
}

function ReportTrendChart({ data }) {
  if (!Array.isArray(data) || !data.length) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Chưa có dữ liệu biểu đồ.</div>
  }

  const chartHeight = 260
  const chartWidth = 720
  const paddingX = 24
  const paddingY = 20
  const innerWidth = chartWidth - paddingX * 2
  const innerHeight = chartHeight - paddingY * 2
  const maxValue = Math.max(
    ...data.flatMap((item) => [
      layGiaTriSo(item.totalRevenue),
      layGiaTriSo(item.totalExpense),
      Math.abs(layGiaTriSo(item.profitLoss)),
    ]),
    1,
  )
  const toPoint = (value, index) => {
    const x = paddingX + (data.length === 1 ? innerWidth / 2 : (innerWidth / (data.length - 1)) * index)
    const y = paddingY + innerHeight - (layGiaTriSo(value) / maxValue) * innerHeight
    return { x, y }
  }
  const buildPath = (key) =>
    data
      .map((item, index) => {
        const point = toPoint(item[key], index)
        return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
      })
      .join(' ')
  const gridLines = Array.from({ length: 4 }, (_, index) => paddingY + (innerHeight / 3) * index)

  return (
    <div className="report-chart">
      <div className="report-chart__legend">
        <span className="report-chart__legend-item report-chart__legend-item--revenue">Doanh thu</span>
        <span className="report-chart__legend-item report-chart__legend-item--expense">Chi phí</span>
        <span className="report-chart__legend-item report-chart__legend-item--profit">Lợi nhuận</span>
      </div>
      <div className="report-line-chart">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="report-line-chart__svg" preserveAspectRatio="none" aria-hidden="true">
          {gridLines.map((y) => (
            <line key={y} x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} className="report-line-chart__grid-line" />
          ))}
          <path d={buildPath('totalRevenue')} className="report-line-chart__path report-line-chart__path--revenue" />
          <path d={buildPath('totalExpense')} className="report-line-chart__path report-line-chart__path--expense" />
          <path d={buildPath('profitLoss')} className="report-line-chart__path report-line-chart__path--profit" />
          {data.map((item, index) => {
            const revenuePoint = toPoint(item.totalRevenue, index)
            const expensePoint = toPoint(item.totalExpense, index)
            const profitPoint = toPoint(item.profitLoss, index)

            return (
              <g key={item.monthKey}>
                <circle cx={revenuePoint.x} cy={revenuePoint.y} r="4.5" className="report-line-chart__dot report-line-chart__dot--revenue" />
                <circle cx={expensePoint.x} cy={expensePoint.y} r="4.5" className="report-line-chart__dot report-line-chart__dot--expense" />
                <circle cx={profitPoint.x} cy={profitPoint.y} r="4.5" className="report-line-chart__dot report-line-chart__dot--profit" />
              </g>
            )
          })}
        </svg>
        <div className="report-line-chart__overlay">
          {data.map((item, index) => (
            <div key={item.monthKey} className="report-line-chart__group">
              <div className="report-line-chart__hitbox">
                <div className="report-chart__tooltip report-chart__tooltip--line">
                  <span>{dinhDangNhanThangNgan(item.monthKey)}</span>
                  <span>{`Doanh thu: ${dinhDangTien(item.totalRevenue)}`}</span>
                  <span>{`Chi phí: ${dinhDangTien(item.totalExpense)}`}</span>
                  <span>{`Lợi nhuận: ${dinhDangTien(item.profitLoss)}`}</span>
                </div>
              </div>
              <span className="report-chart__label">{dinhDangNhanThangNgan(item.monthKey)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ReportsWorkspace() {
  const [thangBaoCao, setThangBaoCao] = useState(taoThangMacDinh().slice(0, 7))
  const [dangTaiBaoCaoThang, setDangTaiBaoCaoThang] = useState(true)
  const [loiBaoCaoThang, setLoiBaoCaoThang] = useState('')
  const [baoCaoThang, setBaoCaoThang] = useState(null)
  const [chiTietBaoCao, setChiTietBaoCao] = useState(null)
  const [dangTaiChiTietBaoCao, setDangTaiChiTietBaoCao] = useState(false)
  const [loiChiTietBaoCao, setLoiChiTietBaoCao] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const realtimeReloadKey = useRealtimeReload(['reports', 'transactions', 'invoices', 'payments'])

  useEffect(() => {
    let active = true

    async function taiBaoCaoThang() {
      setDangTaiBaoCaoThang(true)
      setLoiBaoCaoThang('')

      try {
        const monthParam = `${thangBaoCao}-01`
        const [revenueRes, expenseRes, profitRes] = await Promise.all([
          guiRequest(`/api/Reports/monthly-revenue?month=${encodeURIComponent(monthParam)}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          }),
          guiRequest(`/api/Reports/monthly-expense?month=${encodeURIComponent(monthParam)}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          }),
          guiRequest(`/api/Reports/monthly-profit-loss?month=${encodeURIComponent(monthParam)}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          }),
        ])

        const revenuePayload = revenueRes.payload || {}
        const expensePayload = expenseRes.payload || {}
        const profitPayload = profitRes.payload || {}

        if (active) {
          setBaoCaoThang({
            monthKey: thangBaoCao,
            paidInvoicesRevenue: layGiaTriSo(revenuePayload.paidInvoicesRevenue ?? revenuePayload.PaidInvoicesRevenue),
            extraIncome: layGiaTriSo(revenuePayload.extraIncome ?? revenuePayload.ExtraIncome),
            totalExpense: layGiaTriSo(profitPayload.totalExpense ?? profitPayload.TotalExpense ?? expensePayload.totalExpense ?? expensePayload.TotalExpense),
            totalRevenue: layGiaTriSo(profitPayload.totalRevenue ?? profitPayload.TotalRevenue ?? revenuePayload.totalRevenue ?? revenuePayload.TotalRevenue),
            profitLoss: layGiaTriSo(profitPayload.profitLoss ?? profitPayload.ProfitLoss),
          })
        }
      } catch (error) {
        if (active) {
          setLoiBaoCaoThang(thongDiepLoi(error))
          setBaoCaoThang(null)
        }
      } finally {
        if (active) setDangTaiBaoCaoThang(false)
      }
    }

    taiBaoCaoThang()
    return () => {
      active = false
    }
  }, [thangBaoCao, reloadKey, realtimeReloadKey])

  useEffect(() => {
    if (!chiTietBaoCao) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setChiTietBaoCao(null)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [chiTietBaoCao])

  const moChiTietBaoCao = async (loai) => {
    setDangTaiChiTietBaoCao(true)
    setLoiChiTietBaoCao('')

    try {
      const monthParam = `${thangBaoCao}-01`

      if (loai === 'revenue') {
        const result = await guiRequest('/api/Invoices', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })

        const payload = result.payload
        const danhSach = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.items)
              ? payload.items
              : []

        const chiTiet = danhSach.filter((invoice) => {
          const billingMonth = String(invoice.billingMonth ?? invoice.BillingMonth ?? '')
          const monthValue = billingMonth ? billingMonth.slice(0, 7) : ''
          return monthValue === thangBaoCao
        }).map((invoice) => {
          const totalAmount = Number(invoice.totalAmount ?? invoice.TotalAmount ?? 0)
          const debtAmount = Number(invoice.debtAmount ?? invoice.DebtAmount ?? 0)
          return {
            ...invoice,
            recognizedRevenue: Math.max(totalAmount - debtAmount, 0),
          }
        })

        setChiTietBaoCao({
          type: loai,
          title: `Chi tiết doanh thu ${dinhDangNhanThangNgan(thangBaoCao)}`,
          data: chiTiet,
        })
        return
      }

      const result = await guiRequest(`/api/Transactions?month=${encodeURIComponent(monthParam)}&type=${encodeURIComponent(loai === 'extraIncome' ? 'income' : 'expense')}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })

      const payload = result.payload
      const danhSach = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.items)
            ? payload.items
            : []

      const chiTiet =
        loai === 'extraIncome'
          ? danhSach.filter((item) => {
            const relatedInvoiceId = item.relatedInvoiceId ?? item.RelatedInvoiceId
            return relatedInvoiceId === null || relatedInvoiceId === undefined || relatedInvoiceId === ''
          })
          : danhSach

      setChiTietBaoCao({
        type: loai,
        title: loai === 'extraIncome'
          ? `Chi tiết doanh thu phát sinh ${dinhDangNhanThangNgan(thangBaoCao)}`
          : `Chi tiết chi phí phát sinh ${dinhDangNhanThangNgan(thangBaoCao)}`,
        data: chiTiet,
      })
    } catch (error) {
      setLoiChiTietBaoCao(thongDiepLoi(error))
      setChiTietBaoCao({
        type: loai,
        title: 'Không tải được dữ liệu chi tiết',
        data: [],
      })
    } finally {
      setDangTaiChiTietBaoCao(false)
    }
  }

  return (
    <div className="invoice-workspace reports-workspace">
      <section className="khung">
        <div className="xem-truoc__dau">
          <strong>Xem báo cáo tháng</strong>
          <span>Chọn một tháng để xem doanh thu, doanh thu phát sinh, chi phí phát sinh và lợi nhuận</span>
        </div>
        <div className="invoice-toolbar reports-toolbar">
          <MonthYearFilter label="Tháng xem báo cáo" value={thangBaoCao} onChange={setThangBaoCao} allowEmpty={false} />
        </div>
        {loiBaoCaoThang ? <div className="thong-bao-loi">{loiBaoCaoThang}</div> : null}
        {dangTaiBaoCaoThang ? (
          <div className="khung-du-lieu khung-du-lieu--trong">Đang tải báo cáo tháng...</div>
        ) : baoCaoThang ? (
          <div className="report-revenue-card">
            <div className="report-revenue-card__header">
              <strong>{`Báo cáo ${dinhDangNhanThangNgan(baoCaoThang.monthKey)}`}</strong>
              <span>{`Lợi nhuận: ${dinhDangTien(baoCaoThang.profitLoss)}`}</span>
            </div>
            <div className="report-chart report-chart--single-month">
              <div className="report-chart__grid report-chart__grid--single-month">
                {(() => {
                  const maxValue = Math.max(
                    layGiaTriSo(baoCaoThang.paidInvoicesRevenue),
                    layGiaTriSo(baoCaoThang.extraIncome),
                    layGiaTriSo(baoCaoThang.totalExpense),
                    Math.abs(layGiaTriSo(baoCaoThang.profitLoss)),
                    1,
                  )

                  return (
                    <>
                      <div className="report-chart__group">
                        <div className="report-chart__bars report-chart__bars--single">
                          <ReportBar
                            label={`Doanh thu ${dinhDangNhanThangNgan(baoCaoThang.monthKey)}`}
                            value={baoCaoThang.paidInvoicesRevenue}
                            maxValue={maxValue}
                            tone="revenue"
                          />
                        </div>
                        <span className="report-chart__label">Doanh thu</span>
                      </div>
                      <div className="report-chart__group">
                        <div className="report-chart__bars report-chart__bars--single">
                          <ReportBar
                            label={`Doanh thu phát sinh ${dinhDangNhanThangNgan(baoCaoThang.monthKey)}`}
                            value={baoCaoThang.extraIncome}
                            maxValue={maxValue}
                            tone="profit"
                          />
                        </div>
                        <span className="report-chart__label">Doanh thu phát sinh</span>
                      </div>
                      <div className="report-chart__group">
                        <div className="report-chart__bars report-chart__bars--single">
                          <ReportBar
                            label={`Chi phí phát sinh ${dinhDangNhanThangNgan(baoCaoThang.monthKey)}`}
                            value={baoCaoThang.totalExpense}
                            maxValue={maxValue}
                            tone="expense"
                          />
                        </div>
                        <span className="report-chart__label">Chi phí phát sinh</span>
                      </div>
                      <div className="report-chart__group">
                        <div className="report-chart__bars report-chart__bars--single">
                          <ReportBar
                            label={`Lợi nhuận ${dinhDangNhanThangNgan(baoCaoThang.monthKey)}`}
                            value={baoCaoThang.profitLoss}
                            maxValue={maxValue}
                            tone="profit"
                            negative={baoCaoThang.profitLoss < 0}
                          />
                        </div>
                        <span className="report-chart__label">Lợi nhuận</span>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
            <div className="report-revenue-card__grid">
              <button type="button" className="report-revenue-card__item report-revenue-card__item--interactive" onClick={() => moChiTietBaoCao('revenue')}>
                <span>Doanh thu</span>
                <strong className="invoice-amount invoice-amount--paid">{dinhDangTien(baoCaoThang.paidInvoicesRevenue)}</strong>
              </button>
              <button type="button" className="report-revenue-card__item report-revenue-card__item--interactive" onClick={() => moChiTietBaoCao('extraIncome')}>
                <span>Doanh thu phát sinh</span>
                <strong className="invoice-amount">{dinhDangTien(baoCaoThang.extraIncome)}</strong>
              </button>
              <button type="button" className="report-revenue-card__item report-revenue-card__item--interactive" onClick={() => moChiTietBaoCao('expense')}>
                <span>Chi phí phát sinh</span>
                <strong className="invoice-amount invoice-amount--unpaid">{dinhDangTien(baoCaoThang.totalExpense)}</strong>
              </button>
              <div className="report-revenue-card__item report-revenue-card__item--highlight">
                <span>Lợi nhuận</span>
                <strong className={`invoice-amount ${baoCaoThang.profitLoss >= 0 ? 'invoice-amount--paid' : 'invoice-amount--unpaid'}`}>
                  {dinhDangTien(baoCaoThang.profitLoss)}
                </strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="khung-du-lieu khung-du-lieu--trong">Chưa có dữ liệu báo cáo cho tháng đã chọn.</div>
        )}
      </section>

      {chiTietBaoCao ? (
        <div className="lop-phu-endpoint" onClick={() => setChiTietBaoCao(null)}>
          <div className="hop-endpoint-mo" onClick={(event) => event.stopPropagation()}>
            <article className="the-endpoint the-endpoint--mo invoice-modal-card">
              <div className="the-endpoint__dau">
                <div>
                  <span className="method-tag method-tag--get">GET</span>
                  <h3>{chiTietBaoCao.title}</h3>
                </div>
                <button type="button" className="nut-dong-endpoint" onClick={() => setChiTietBaoCao(null)}>
                  ×
                </button>
              </div>

              {loiChiTietBaoCao ? <div className="thong-bao-loi">{loiChiTietBaoCao}</div> : null}

              {dangTaiChiTietBaoCao ? (
                <div className="khung-du-lieu khung-du-lieu--trong">Đang tải dữ liệu chi tiết...</div>
              ) : chiTietBaoCao.type === 'revenue' ? (
                <XemDanhSachHoaDon data={chiTietBaoCao.data} />
              ) : (
                <XemDanhSachThuChi data={chiTietBaoCao.data} />
              )}
            </article>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function InvoiceWorkspaceModern({ spec }) {
  const [hoaDon, setHoaDon] = useState([])
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [phongFilter, setPhongFilter] = useState('')
  const [thangNamFilter, setThangNamFilter] = useState('')
  const [trangThaiFilter, setTrangThaiFilter] = useState('all')
  const [reloadKey, setReloadKey] = useState(0)
  const realtimeReloadKey = useRealtimeReload(['invoices', 'transactions', 'payments'])

  const invoiceActions = useMemo(() => {
    const actions = Object.entries(spec?.paths || {})
      .filter(([path]) => path.toLowerCase().startsWith('/api/invoices'))
      .flatMap(([path, pathItem]) =>
        METHOD_ORDER.filter((method) => pathItem[method]).map((method) => ({
          path,
          method,
          operation: pathItem[method],
        })),
      )
      .filter((item) => {
        const method = item.method.toLowerCase()
        const path = item.path.toLowerCase()
        return (
          method === 'post' &&
          (path === '/api/invoices/preview' || path === '/api/invoices')
        )
      })
      .sort((a, b) => sapXepEndpoint('invoices', a, b))

    const seen = new Set()
    return actions.filter((item) => {
      const normalizedPath = item.path.toLowerCase().replace('{id:int}', '{id}')
      const key = `${item.method.toLowerCase()} ${normalizedPath}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [spec])

  useEffect(() => {
    let active = true

    async function taiDanhSachHoaDon() {
      setDangTai(true)
      setLoi('')

      try {
        const result = await guiRequest('/api/Invoices', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })

        const payload = result.payload
        const danhSach = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.items)
              ? payload.items
              : []

        if (active) setHoaDon(danhSach)
      } catch (error) {
        if (active) {
          setLoi(thongDiepLoi(error))
          setHoaDon([])
        }
      } finally {
        if (active) setDangTai(false)
      }
    }

    taiDanhSachHoaDon()
    return () => {
      active = false
    }
  }, [reloadKey, realtimeReloadKey])

  const danhSachLoc = useMemo(() => {
    const phongDaLoc = String(phongFilter || '').trim().toLowerCase()

    return hoaDon.filter((invoice) => {
      const roomCode = String(invoice.roomCode ?? invoice.RoomCode ?? '').trim().toLowerCase()
      const status = layTrangThaiHoaDon(invoice)
      const billingMonth = String(invoice.billingMonth ?? invoice.BillingMonth ?? '')
      const monthValue = billingMonth ? billingMonth.slice(0, 7) : ''

      return (
        (!phongDaLoc || roomCode.includes(phongDaLoc)) &&
        (!thangNamFilter || monthValue === thangNamFilter) &&
        (trangThaiFilter === 'all' || status === trangThaiFilter)
      )
    })
  }, [hoaDon, phongFilter, thangNamFilter, trangThaiFilter])

  const tongHoaDon = danhSachLoc.length
  const hoaDonDaThanhToan = danhSachLoc.filter((invoice) => layTrangThaiHoaDon(invoice) === 'paid').length
  const hoaDonChuaThanhToan = danhSachLoc.filter((invoice) => layTrangThaiHoaDon(invoice) !== 'paid').length
  const tongGiaTriChuaThanhToan = danhSachLoc
    .filter((invoice) => layTrangThaiHoaDon(invoice) !== 'paid')
    .reduce((tong, invoice) => tong + layTongTienHoaDon(invoice), 0)
  const tongGiaTriDaThanhToan = danhSachLoc
    .filter((invoice) => layTrangThaiHoaDon(invoice) === 'paid')
    .reduce((tong, invoice) => tong + layTongTienHoaDon(invoice), 0)

  return (
    <div className="invoice-workspace">
      <section className="invoice-hero khung">
        <div className="invoice-hero__main">
          <p className="nhan">Hóa đơn</p>
          <div className="invoice-toolbar invoice-toolbar--invoices">
            <label className="invoice-search">
              <span>Phòng</span>
              <input type="text" value={phongFilter} onChange={(event) => setPhongFilter(event.target.value)} placeholder="Nhập mã phòng" />
            </label>
            <MonthYearFilter label="Tháng - năm" value={thangNamFilter} onChange={setThangNamFilter} />
            <label className="invoice-search invoice-search--status">
              <span>Trạng thái hóa đơn</span>
              <select value={trangThaiFilter} onChange={(event) => setTrangThaiFilter(event.target.value)}>
                <option value="all">Tất cả</option>
                <option value="paid">Đã thanh toán</option>
                <option value="unpaid">Chưa thanh toán</option>
              </select>
            </label>
            <button type="button" className="nut nut--phu" onClick={() => setReloadKey((value) => value + 1)} disabled={dangTai}>
              {dangTai ? 'Đang tải...' : 'Làm mới danh sách'}
            </button>
            <MonthlyBulkCard onSuccess={() => setReloadKey((value) => value + 1)} compact />
          </div>
        </div>
        <div className="invoice-hero__action">
          <MonthlyBulkCard onSuccess={() => setReloadKey((value) => value + 1)} compact />
        </div>
      </section>

      {invoiceActions.length ? (
        <section className="khung invoice-actions-card">
          <div className="danh-sach-endpoint invoice-actions-inline">
            {invoiceActions.map((item) => (
              <EndpointCard
                key={`${item.method}-${item.path}`}
                method={item.method}
                moduleKey="invoices"
                operation={item.operation}
                path={item.path}
                spec={spec}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="invoice-stats invoice-stats--five">
        <article className="invoice-stat-card">
          <span>Tổng hóa đơn</span>
          <strong>{tongHoaDon}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Đã thanh toán</span>
          <strong>{hoaDonDaThanhToan}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Chưa thanh toán</span>
          <strong>{hoaDonChuaThanhToan}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Tổng giá trị chưa thanh toán</span>
          <strong className="invoice-amount invoice-amount--unpaid">{dinhDangTien(tongGiaTriChuaThanhToan).replace(/\s*VND$/, '')}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Tổng giá trị đã thanh toán</span>
          <strong className="invoice-amount invoice-amount--paid">{dinhDangTien(tongGiaTriDaThanhToan).replace(/\s*VND$/, '')}</strong>
        </article>
      </section>

      <section className="khung">
        <div className="xem-truoc__dau">
          <strong>Danh sách hóa đơn</strong>
          <span>{`Hiển thị ${danhSachLoc.length}/${hoaDon.length} hóa đơn`}</span>
        </div>
        {loi ? <div className="thong-bao-loi">{loi}</div> : null}
        {dangTai ? (
          <div className="khung-du-lieu khung-du-lieu--trong">Đang tải danh sách hóa đơn...</div>
        ) : danhSachLoc.length ? (
          <div className="invoice-list-wrap">
            <XemDanhSachHoaDonCoNut data={danhSachLoc} onReload={() => setReloadKey((value) => value + 1)} />
          </div>
        ) : (
          <div className="khung-du-lieu khung-du-lieu--trong">Không có hóa đơn nào khớp với bộ lọc hiện tại.</div>
        )}
      </section>
    </div>
  )
}

function taoNoiDungMauThanhToanMotPhan(roomCode = '', relatedMonth = '') {
  const thangLabel = relatedMonth || taoThangMacDinh().slice(0, 7)
  const phongLabel = roomCode || 'A104'

  return [
    `Khach phong ${phongLabel} chi thanh toan mot phan hoa don thang ${thangLabel}.`,
    'So tien da thu: ',
    'So tien con thieu: ',
    `Chuyen phan con thieu thanh no cu cua hoa don thang sau sau khi chot ky ${thangLabel}.`,
    'Khi tao hoa don thang sau, cong khoan con thieu vao No cu va giu lai ghi chu nay de doi chieu.',
  ].join('\n')
}

function layInvoiceIdTongQuat(invoice, fallback = '') {
  return invoice?.invoiceId ?? invoice?.InvoiceId ?? fallback
}

function NotesWorkspace() {
  const [invoices, setInvoices] = useState([])
  const [dangTai, setDangTai] = useState(false)
  const [dangLuu, setDangLuu] = useState(false)
  const [filter, setFilter] = useState('partial-payment')
  const [search, setSearch] = useState('')
  const [editingInvoiceId, setEditingInvoiceId] = useState(null)
  const [draftNote, setDraftNote] = useState('')
  const [thongBao, setThongBao] = useState(null)
  const realtimeReloadKey = useRealtimeReload(['invoices', 'transactions', 'payments'])

  useEffect(() => {
    taiDuLieu()
  }, [realtimeReloadKey])

  const taiDuLieu = async () => {
    setDangTai(true)
    setThongBao(null)
    try {
      const result = await guiRequest('/api/Invoices', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      setInvoices(Array.isArray(result.payload) ? result.payload : [])
    } catch (error) {
      setInvoices([])
      setThongBao({ ok: false, text: thongDiepLoi(error) })
    } finally {
      setDangTai(false)
    }
  }

  const resetEditor = () => {
    setEditingInvoiceId(null)
    setDraftNote('')
  }

  const moSuaGhiChu = (invoice) => {
    setEditingInvoiceId(layInvoiceIdTongQuat(invoice))
    setDraftNote(invoice.note ?? invoice.Note ?? '')
    setThongBao(null)
  }

  const apDungMauThanhToanMotPhan = () => {
    const invoice = invoices.find((item) => layInvoiceIdTongQuat(item) === editingInvoiceId)
    if (!invoice) return
    const roomCode = invoice.roomCode ?? invoice.RoomCode ?? ''
    const month = String(invoice.billingMonth ?? invoice.BillingMonth ?? '').slice(0, 7)
    setDraftNote(taoNoiDungMauThanhToanMotPhan(roomCode, month))
  }

  const luuGhiChu = async () => {
    const invoice = invoices.find((item) => layInvoiceIdTongQuat(item) === editingInvoiceId)
    if (!invoice) return

    setDangLuu(true)
    setThongBao(null)
    try {
      const payload = {
        roomFee: chuyenTienVeSo(invoice.roomFee ?? invoice.RoomFee ?? 0),
        electricityFee: chuyenTienVeSo(invoice.electricityFee ?? invoice.ElectricityFee ?? 0),
        waterFee: chuyenTienVeSo(invoice.waterFee ?? invoice.WaterFee ?? 0),
        trashFee: chuyenTienVeSo(invoice.trashFee ?? invoice.TrashFee ?? 0),
        discountAmount: chuyenTienVeSo(invoice.discountAmount ?? invoice.DiscountAmount ?? 0),
        debtAmount: chuyenTienVeSo(invoice.debtAmount ?? invoice.DebtAmount ?? 0),
        note: draftNote.trim() || null,
      }
      const result = await guiRequest(`/api/Invoices/${editingInvoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      const updated = result.payload
      setInvoices((current) => current.map((item) => (layInvoiceIdTongQuat(item) === editingInvoiceId ? updated : item)))
      setThongBao({ ok: true, text: 'Đã lưu ghi chú vào hóa đơn.' })
      resetEditor()
    } catch (error) {
      setThongBao({ ok: false, text: thongDiepLoi(error) })
    } finally {
      setDangLuu(false)
    }
  }

  const danhSachTheoDoi = useMemo(() => {
    return invoices
      .map((invoice) => {
        const totalAmount = Number(invoice.totalAmount ?? invoice.TotalAmount ?? 0)
        const paidAmount = Number(invoice.paidAmount ?? invoice.PaidAmount ?? 0)
        const remainingAmount = Math.max(totalAmount - paidAmount, 0)
        const note = String(invoice.note ?? invoice.Note ?? '').trim()
        const paymentMethod = String(invoice.paymentMethod ?? invoice.PaymentMethod ?? '').trim()
        const status = String(invoice.status ?? invoice.Status ?? '').trim().toLowerCase()
        const roomCode = invoice.roomCode ?? invoice.RoomCode ?? ''
        const billingMonth = String(invoice.billingMonth ?? invoice.BillingMonth ?? '').slice(0, 7)
        const isPartialPayment = paidAmount > 0 && remainingAmount > 0
        const hasWorkflowNote = Boolean(note)
        const hasDebtCarryOver = remainingAmount > 0

        return {
          raw: invoice,
          invoiceId: layInvoiceIdTongQuat(invoice),
          roomCode,
          billingMonth,
          totalAmount,
          paidAmount,
          remainingAmount,
          note,
          paymentMethod,
          status,
          isPartialPayment,
          hasWorkflowNote,
          hasDebtCarryOver,
        }
      })
      .filter((item) => item.hasWorkflowNote || item.isPartialPayment || item.hasDebtCarryOver)
      .sort((left, right) => {
        const leftDate = layMocThoiGian(left.raw.updatedAt ?? left.raw.UpdatedAt ?? left.raw.createdAt ?? left.raw.CreatedAt)
        const rightDate = layMocThoiGian(right.raw.updatedAt ?? right.raw.UpdatedAt ?? right.raw.createdAt ?? right.raw.CreatedAt)
        return rightDate - leftDate
      })
  }, [invoices])

  const danhSachLoc = useMemo(() => {
    const keyword = String(search || '').trim().toLowerCase()
    return danhSachTheoDoi.filter((item) => {
      if (filter === 'partial-payment' && !item.isPartialPayment) return false
      if (filter === 'debt' && !item.hasDebtCarryOver) return false
      if (filter === 'with-note' && !item.hasWorkflowNote) return false

      if (!keyword) return true

      return [
        item.roomCode,
        item.billingMonth,
        item.note,
        item.paymentMethod,
        item.status,
      ].some((value) => String(value || '').toLowerCase().includes(keyword))
    })
  }, [danhSachTheoDoi, filter, search])

  const tongCaTheoDoi = danhSachTheoDoi.length
  const thanhToanMotPhan = danhSachTheoDoi.filter((item) => item.isPartialPayment).length
  const tongCongNoChuyenKy = danhSachTheoDoi.reduce((sum, item) => sum + item.remainingAmount, 0)
  const tongCoGhiChu = danhSachTheoDoi.filter((item) => item.hasWorkflowNote).length
  const invoiceDangSua = invoices.find((item) => layInvoiceIdTongQuat(item) === editingInvoiceId)

  return (
    <div className="invoice-workspace notes-workspace">
      <section className="invoice-hero khung">
        <div className="invoice-hero__main">
          <p className="nhan">Ghi chú</p>
          <h2>Theo dõi ghi chú và nợ cũ</h2>
          <p className="mo-ta-trang">
            Workspace này đọc trực tiếp từ dữ liệu hóa đơn. Khi khách trả tiền mặt nhưng chỉ thanh toán một phần, ghi chú sẽ lưu ngay trên hóa đơn và phần còn thiếu được dùng làm nợ cũ chuyển sang tháng sau.
          </p>

          <div className="invoice-toolbar notes-toolbar">
            <label className="invoice-search">
              <span>Tìm theo phòng, tháng, ghi chú</span>
              <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ví dụ: A104, 2026-04, thanh toán một phần" />
            </label>
            <label className="truong">
              <span>Bộ lọc</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="partial-payment">Thanh toán một phần</option>
                <option value="debt">Có nợ cũ chuyển kỳ</option>
                <option value="with-note">Đã có ghi chú</option>
                <option value="all">Tất cả case theo dõi</option>
              </select>
            </label>
            <button type="button" className="nut nut--phu" onClick={taiDuLieu} disabled={dangTai}>
              {dangTai ? 'Đang tải...' : 'Tải lại'}
            </button>
          </div>
        </div>
      </section>

      <section className="invoice-stats">
        <article className="invoice-stat-card">
          <span>Case theo dõi</span>
          <strong>{tongCaTheoDoi}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Thanh toán một phần</span>
          <strong>{thanhToanMotPhan}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Tổng nợ cũ còn thiếu</span>
          <strong>{dinhDangTien(tongCongNoChuyenKy)}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Đã có ghi chú</span>
          <strong>{tongCoGhiChu}</strong>
        </article>
      </section>

      <section className="khung notes-layout">
        <div className="notes-editor">
          <div className="xem-truoc__dau">
            <strong>{invoiceDangSua ? `Ghi chú hóa đơn phòng ${invoiceDangSua.roomCode ?? invoiceDangSua.RoomCode ?? ''}` : 'Chọn một hóa đơn để cập nhật ghi chú'}</strong>
            <span>{invoiceDangSua ? 'Ghi chú sẽ lưu trực tiếp vào dữ liệu hóa đơn.' : 'Ưu tiên các case thanh toán một phần để theo dõi nợ cũ.'}</span>
          </div>

          {invoiceDangSua ? (
            <>
              <div className="notes-form-grid">
                <label className="truong">
                  <span>Phòng</span>
                  <input type="text" value={invoiceDangSua.roomCode ?? invoiceDangSua.RoomCode ?? ''} readOnly />
                </label>
                <label className="truong">
                  <span>Tháng</span>
                  <input type="text" value={String(invoiceDangSua.billingMonth ?? invoiceDangSua.BillingMonth ?? '').slice(0, 7)} readOnly />
                </label>
                <label className="truong">
                  <span>Đã thu</span>
                  <input type="text" value={dinhDangTien(invoiceDangSua.paidAmount ?? invoiceDangSua.PaidAmount ?? 0)} readOnly />
                </label>
                <label className="truong">
                  <span>Còn thiếu</span>
                  <input
                    type="text"
                    value={dinhDangTien(
                      Math.max(
                        Number(invoiceDangSua.totalAmount ?? invoiceDangSua.TotalAmount ?? 0) -
                          Number(invoiceDangSua.paidAmount ?? invoiceDangSua.PaidAmount ?? 0),
                        0,
                      ),
                    )}
                    readOnly
                  />
                </label>
                <label className="truong truong--full">
                  <span>Ghi chú</span>
                  <textarea
                    value={draftNote}
                    onChange={(event) => setDraftNote(event.target.value)}
                    rows="8"
                    placeholder="Ví dụ: Khách trả 3.000.000 tiền mặt, còn thiếu 1.250.000 chuyển nợ cũ tháng sau."
                  />
                </label>
              </div>

              <div className="invoice-modal-actions">
                <button type="button" className="nut" onClick={luuGhiChu} disabled={dangLuu}>
                  {dangLuu ? 'Đang lưu...' : 'Lưu ghi chú'}
                </button>
                <button type="button" className="nut nut--phu" onClick={apDungMauThanhToanMotPhan}>
                  Dùng mẫu thanh toán một phần
                </button>
                <button type="button" className="nut nut--phu" onClick={resetEditor}>
                  Bỏ chọn
                </button>
              </div>
            </>
          ) : (
            <div className="khung-du-lieu khung-du-lieu--trong">
              Chọn một hóa đơn trong danh sách bên phải để thêm hoặc cập nhật ghi chú nghiệp vụ.
            </div>
          )}

          {thongBao ? <div className="invoice-inline-message" style={{ marginTop: '12px', color: thongBao.ok ? '#16a34a' : '#dc2626' }}>{thongBao.text}</div> : null}
        </div>

        <div className="notes-list">
          <div className="xem-truoc__dau">
            <strong>Danh sách case cần theo dõi</strong>
            <span>{`Hiển thị ${danhSachLoc.length}/${tongCaTheoDoi} case`}</span>
          </div>

          {dangTai ? (
            <div className="khung-du-lieu khung-du-lieu--trong">Đang tải dữ liệu hóa đơn...</div>
          ) : danhSachLoc.length ? (
            <div className="danh-sach-phong">
              {danhSachLoc.map((item) => (
                <div key={item.invoiceId} className="dong-phong invoice-card notes-card">
                  <div className="invoice-card__info">
                    <div className="dong-phong__o invoice-card__meta-item">
                      <span>Phòng</span>
                      <strong>{item.roomCode || 'Không có dữ liệu'}</strong>
                    </div>
                    <div className="dong-phong__o invoice-card__meta-item">
                      <span>Tháng</span>
                      <strong>{item.billingMonth || 'Không có dữ liệu'}</strong>
                    </div>
                    <div className="dong-phong__o invoice-card__meta-item">
                      <span>Đã thu</span>
                      <strong>{dinhDangTien(item.paidAmount)}</strong>
                    </div>
                    <div className="dong-phong__o invoice-card__meta-item">
                      <span>Còn thiếu</span>
                      <strong className={item.remainingAmount > 0 ? 'invoice-amount invoice-amount--unpaid' : 'invoice-amount invoice-amount--paid'}>
                        {dinhDangTien(item.remainingAmount)}
                      </strong>
                    </div>
                    <div className="dong-phong__o invoice-card__meta-item notes-card__content">
                      <span>Ghi chú</span>
                      <strong>{item.note || 'Chưa có ghi chú'}</strong>
                    </div>
                    <div className="dong-phong__o invoice-card__meta-item">
                      <span>Phương thức</span>
                      <strong>{item.paymentMethod || 'Chưa có dữ liệu'}</strong>
                    </div>
                    <div className="dong-phong__o invoice-card__meta-item">
                      <span>Trạng thái</span>
                      <strong>{item.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</strong>
                    </div>
                    <div className="invoice-card__button-row">
                      <button type="button" className="nut invoice-inline-button invoice-inline-button--secondary" onClick={() => moSuaGhiChu(item.raw)}>
                        {editingInvoiceId === item.invoiceId ? 'Đang chọn' : 'Cập nhật ghi chú'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="khung-du-lieu khung-du-lieu--trong">Chưa có case nào khớp bộ lọc hiện tại.</div>
          )}
        </div>
      </section>
    </div>
  )
}

function datTenEndpoint(moduleKey, method, path) {
  const cleanPath = path.toLowerCase()

  const mapping = {
    rooms: {
      'get /api/rooms': 'Lấy danh sách các phòng',
      'get /api/rooms/{id:int}': 'Lấy chi tiết một phòng',
      'get /api/rooms/{id}': 'Lấy chi tiết một phòng',
      'post /api/rooms': 'Tạo phòng mới',
      'put /api/rooms/{id:int}': 'Cập nhật thông tin phòng',
      'put /api/rooms/{id}': 'Cập nhật thông tin phòng',
      'patch /api/rooms/{id:int}/status': 'Cập nhật trạng thái phòng',
      'patch /api/rooms/{id}/status': 'Cập nhật trạng thái phòng',
      'get /api/rooms/by-code/{roomcode}': 'Tìm phòng theo mã phòng',
    },
    tenants: {
      'get /api/tenants': 'Lấy danh sách người thuê',
      'get /api/tenants/{id:int}': 'Lấy chi tiết người thuê',
      'get /api/tenants/{id}': 'Lấy chi tiết người thuê',
      'post /api/tenants': 'Thêm người thuê mới',
      'put /api/tenants/{id:int}': 'Cập nhật thông tin người thuê',
      'put /api/tenants/{id}': 'Cập nhật thông tin người thuê',
    },
    contracts: {
      'get /api/contracts': 'Xem danh sách hợp đồng',
      'get /api/contracts/{id:int}': 'Xem chi tiết hợp đồng',
      'get /api/contracts/{id}': 'Xem chi tiết hợp đồng',
      'post /api/contracts': 'Tạo hợp đồng mới',
      'put /api/contracts/{id:int}': 'Cập nhật thông tin hợp đồng',
      'put /api/contracts/{id}': 'Cập nhật thông tin hợp đồng',
      'post /api/contracts/{id:int}/end-preview': 'Trả tiền cọc',
      'post /api/contracts/{id}/end-preview': 'Trả tiền cọc',
      'post /api/contracts/{id:int}/end': 'Kết thúc hợp đồng',
      'post /api/contracts/{id}/end': 'Kết thúc hợp đồng',
      'delete /api/contracts/{id:int}': 'Xóa hợp đồng đã chấm dứt',
      'delete /api/contracts/{id}': 'Xóa hợp đồng đã chấm dứt',
    },
    meterreadings: {
      'get /api/meterreadings': 'Lấy danh sách chỉ số điện nước',
      'post /api/meterreadings': 'Tạo bản ghi chỉ số điện nước',
      'post /api/meterreadings/preview': 'Xem trước chỉ số điện nước',
      'post /api/meterreadings/{id:int}/image': 'Lưu ảnh công tơ điện',
      'post /api/meterreadings/{id}/image': 'Lưu ảnh công tơ điện',
      'patch /api/meterreadings/current-reading': 'Sửa chỉ số điện gốc theo phòng',
      'delete /api/meterreadings/by-ended-contract/{contractid:int}': 'Xóa tất cả bản ghi chỉ số điện của hợp đồng đã chấm dứt',
      'delete /api/meterreadings/by-ended-contract/{contractid}': 'Xóa tất cả bản ghi chỉ số điện của hợp đồng đã chấm dứt',
    },
    invoices: {
      'get /api/invoices': 'Lấy danh sách hóa đơn',
      'get /api/invoices/{id:int}': 'Lấy chi tiết hóa đơn',
      'get /api/invoices/{id}': 'Lấy chi tiết hóa đơn',
      'post /api/invoices/preview': 'Xem trước hóa đơn',
      'post /api/invoices': 'Tạo hóa đơn mới',
      'get /api/invoices/by-room-and-month': 'Tìm hóa đơn theo phòng và tháng',
      'patch /api/invoices/{id:int}/mark-paid': 'Đánh dấu đã thanh toán',
      'patch /api/invoices/{id}/mark-paid': 'Đánh dấu đã thanh toán',
      'patch /api/invoices/{id:int}/mark-unpaid': 'Đánh dấu chưa thanh toán',
      'patch /api/invoices/{id}/mark-unpaid': 'Đánh dấu chưa thanh toán',
      'post /api/invoices/monthly-bulk-preview': 'Tạo hóa đơn hàng loạt theo tháng',
      'post /api/invoices/monthly-bulk': 'Tạo hóa đơn hàng loạt theo tháng',
      'delete /api/invoices/{id}': 'Xóa hóa đơn'
    },
    payments: {
      'post /api/payments/sepay/webhook': 'Nhận webhook thanh toán',
      'get /api/payments/transactions': 'Lấy danh sách giao dịch thanh toán',
      'get /api/payments/transactions/{id:int}': 'Lấy chi tiết giao dịch thanh toán',
      'get /api/payments/transactions/{id}': 'Lấy chi tiết giao dịch thanh toán',
      'post /api/payments/transactions/{id:int}/reconcile': 'Đối soát giao dịch thanh toán',
      'post /api/payments/transactions/{id}/reconcile': 'Đối soát giao dịch thanh toán',
    },
    transactions: {
      'get /api/transactions': 'Lấy danh sách thu chi',
      'get /api/transactions/{id:int}': 'Lấy chi tiết giao dịch thu chi',
      'get /api/transactions/{id}': 'Lấy chi tiết giao dịch thu chi',
      'post /api/transactions': 'Tạo giao dịch thu chi',
      'put /api/transactions/{id:int}': 'Cập nhật giao dịch thu chi',
      'put /api/transactions/{id}': 'Cập nhật giao dịch thu chi',
      'delete /api/transactions/{id:int}': 'Xóa giao dịch thu chi',
      'delete /api/transactions/{id}': 'Xóa giao dịch thu chi',
    },
    reports: {
      'get /api/reports/monthly-revenue': 'Lấy báo cáo doanh thu tháng',
      'get /api/reports/monthly-expense': 'Lấy báo cáo chi phí tháng',
      'get /api/reports/monthly-profit-loss': 'Lấy báo cáo lãi lỗ tháng',
      'get /api/reports/payment-status': 'Lấy tình trạng thanh toán theo tháng',
    },
  }

  const normalizedPath = cleanPath.replace(/:\w+/g, '')
  const key = `${method.toLowerCase()} ${normalizedPath}`
  return mapping[moduleKey]?.[key] || tenDep(`${method} ${path}`)
}

async function taiSwagger() {
  const response = await fetch('/swagger/v1/swagger.json', {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Không tải được tài liệu API (${response.status})`)
  }

  return response.json()
}

async function guiRequest(url, options) {
  const { timeoutMs, signal, ...fetchOptions } = options || {}
  const controller = new AbortController()
  const timeoutId = timeoutMs
    ? window.setTimeout(() => controller.abort(new DOMException('Request timed out', 'AbortError')), timeoutMs)
    : null

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason)
    } else {
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
    }
  }

  let response
  try {
    response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
  } catch (error) {
    if (timeoutId) window.clearTimeout(timeoutId)
    if (error?.name === 'AbortError') {
      throw new Error('Yêu cầu đã bị dừng sau 60 giây. Hãy thử lại sau.')
    }
    throw error
  }

  if (timeoutId) window.clearTimeout(timeoutId)
  const contentType = response.headers.get('content-type') || ''

  let payload = null
  if (contentType.includes('application/json')) {
    payload = await response.json()
  } else {
    payload = await response.text()
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.message ? payload.message : `Yêu cầu thất bại (${response.status})`
    throw new Error(message)
  }

  return {
    status: response.status,
    payload,
  }
}

function useRealtimeReload(moduleKeys = []) {
  const [version, setVersion] = useState(0)
  const modulesKey = JSON.stringify(moduleKeys)

  useEffect(() => {
    const normalizedModules = JSON.parse(modulesKey)
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean)

    let closed = false
    let source = null
    let reconnectTimer = null

    const connect = () => {
      if (closed) return

      source = new EventSource('/api/Realtime/stream')

      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          const eventModules = Array.isArray(payload?.modules)
            ? payload.modules.map((item) => String(item || '').trim().toLowerCase())
            : []

          if (!normalizedModules.length || eventModules.some((item) => normalizedModules.includes(item))) {
            setVersion((value) => value + 1)
          }
        } catch {
          // Bo qua goi tin loi dinh dang de giu ket noi realtime.
        }
      }

      source.onerror = () => {
        source?.close()
        source = null

        if (!closed) {
          reconnectTimer = window.setTimeout(connect, 3000)
        }
      }
    }

    connect()

    return () => {
      closed = true
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      source?.close()
    }
  }, [modulesKey])

  return version
}

function useTrangHienTai() {
  const docHash = () => window.location.hash.replace(/^#\/?/, '') || 'reports'
  const [trang, setTrang] = useState(docHash)

  useEffect(() => {
    const onHashChange = () => setTrang(docHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return [trang, setTrang]
}

function TrangTongQuan() {
  const realtimeReloadKey = useRealtimeReload(['payments', 'reports'])
  const khoangThangMacDinh = taoKhoangThangMacDinh()
  const [fromMonth, setFromMonth] = useState(khoangThangMacDinh.fromMonth)
  const [toMonth, setToMonth] = useState(khoangThangMacDinh.toMonth)
  const [duLieu, setDuLieu] = useState(null)
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [dangIn, setDangIn] = useState(false)
  const [thongTinMau, setThongTinMau] = useState(() => {
    try {
      const raw = window.localStorage.getItem('sales-ledger-template')
      if (!raw) {
        return {
          businessOwnerName: '',
          address: '',
          taxCode: '',
          businessLocation: '',
        }
      }

      return {
        businessOwnerName: '',
        address: '',
        taxCode: '',
        businessLocation: '',
        ...JSON.parse(raw),
      }
    } catch {
      return {
        businessOwnerName: '',
        address: '',
        taxCode: '',
        businessLocation: '',
      }
    }
  })

  useEffect(() => {
    window.localStorage.setItem('sales-ledger-template', JSON.stringify(thongTinMau))
  }, [thongTinMau])

  useEffect(() => {
    let conHieuLuc = true

    async function taiSoDoanhThu() {
      try {
        setDangTai(true)
        setLoi('')
        const normalizedFromMonth = chuanHoaGiaTriThang(fromMonth)
        const normalizedToMonth = chuanHoaGiaTriThang(toMonth)

        if (!normalizedFromMonth || !normalizedToMonth) {
          throw new Error('Vui lòng chọn đầy đủ tháng bắt đầu và tháng kết thúc.')
        }

        if (normalizedFromMonth > normalizedToMonth) {
          throw new Error('Tháng bắt đầu không được lớn hơn tháng kết thúc.')
        }

        const response = await fetch(`/api/Reports/sales-ledger?fromMonth=${encodeURIComponent(normalizedFromMonth)}&toMonth=${encodeURIComponent(normalizedToMonth)}`, {
          headers: {
            Accept: 'application/json',
          },
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.message || 'Không thể tải sổ doanh thu.')
        }

        const payload = await response.json()
        if (conHieuLuc) {
          setDuLieu(payload)
        }
      } catch (error) {
        if (conHieuLuc) {
          setLoi(thongDiepLoi(error))
        }
      } finally {
        if (conHieuLuc) {
          setDangTai(false)
        }
      }
    }

    taiSoDoanhThu()

    return () => {
      conHieuLuc = false
    }
  }, [fromMonth, toMonth, realtimeReloadKey])

  const rows = Array.isArray(duLieu?.rows) ? duLieu.rows : []
  const tongTien = Number(duLieu?.totalAmount ?? 0)
  const soDongTrong = Math.max(0, 8 - rows.length)
  const kyKeKhai = dinhDangKyKeKhaiSauThang(fromMonth, toMonth)
  const fromMonthParts = tachGiaTriThang(fromMonth)
  const toMonthParts = tachGiaTriThang(toMonth)
  const danhSachNamKeKhai = taoDanhSachNamKeKhai(fromMonth, toMonth)

  async function onInPdf() {
    try {
      setDangIn(true)
      const normalizedFromMonth = chuanHoaGiaTriThang(fromMonth)
      const normalizedToMonth = chuanHoaGiaTriThang(toMonth)

      if (!normalizedFromMonth || !normalizedToMonth) {
        throw new Error('Vui lòng chọn đầy đủ tháng bắt đầu và tháng kết thúc.')
      }

      if (normalizedFromMonth > normalizedToMonth) {
        throw new Error('Tháng bắt đầu không được lớn hơn tháng kết thúc.')
      }

      await taiSoDoanhThuPdf({
        fromMonth: normalizedFromMonth,
        toMonth: normalizedToMonth,
        ...thongTinMau,
      })
    } catch (error) {
      window.alert(thongDiepLoi(error))
    } finally {
      setDangIn(false)
    }
  }

  function capNhatThongTinMau(field, value) {
    setThongTinMau((current) => ({
      ...current,
      [field]: value,
    }))
  }

  return (
    <div className="khung-trang sales-ledger-page">
      <section className="khung sales-ledger-toolbar-card">
        <div className="sales-ledger-toolbar">
          <div className="sales-ledger-toolbar__actions">
            <div className="sales-ledger-filter-copy">
              <strong>Bộ lọc kê khai</strong>
              <span>Chọn khoảng tháng muốn xem và in sổ doanh thu.</span>
            </div>
            <div className="sales-ledger-filter-grid">
              <label className="truong">
                <span>Từ tháng</span>
                <div className="sales-ledger-month-picker">
                  <select
                    value={fromMonthParts.month}
                    onChange={(event) => setFromMonth((current) => capNhatGiaTriThang(current, { month: event.target.value }))}
                  >
                    {DANH_SACH_THANG_KE_KHAI.map((item) => (
                      <option key={`from-${item.value}`} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={fromMonthParts.year}
                    onChange={(event) => setFromMonth((current) => capNhatGiaTriThang(current, { year: event.target.value }))}
                  >
                    {danhSachNamKeKhai.map((year) => (
                      <option key={`from-year-${year}`} value={year}>
                        Năm {year}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="truong">
                <span>Đến tháng</span>
                <div className="sales-ledger-month-picker">
                  <select
                    value={toMonthParts.month}
                    onChange={(event) => setToMonth((current) => capNhatGiaTriThang(current, { month: event.target.value }))}
                  >
                    {DANH_SACH_THANG_KE_KHAI.map((item) => (
                      <option key={`to-${item.value}`} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={toMonthParts.year}
                    onChange={(event) => setToMonth((current) => capNhatGiaTriThang(current, { year: event.target.value }))}
                  >
                    {danhSachNamKeKhai.map((year) => (
                      <option key={`to-year-${year}`} value={year}>
                        Năm {year}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>

            <button type="button" className="nut nut--chinh sales-ledger-print-button" onClick={onInPdf} disabled={dangIn || dangTai}>
              {dangIn ? 'Đang tạo PDF...' : 'In PDF theo mẫu'}
            </button>
          </div>
        </div>
      </section>

      <section className="khung sales-ledger-sheet">
        <div className="sales-ledger-sheet__header">
          <div className="sales-ledger-sheet__identity">
            <label className="sales-ledger-line">
              <span>HỘ, CÁ NHÂN KINH DOANH:</span>
              <input
                type="text"
                value={thongTinMau.businessOwnerName}
                onChange={(event) => capNhatThongTinMau('businessOwnerName', event.target.value)}
                placeholder="Nhập tên hộ kinh doanh"
              />
            </label>
            <label className="sales-ledger-line">
              <span>Địa chỉ:</span>
              <input
                type="text"
                value={thongTinMau.address}
                onChange={(event) => capNhatThongTinMau('address', event.target.value)}
                placeholder="Nhập địa chỉ"
              />
            </label>
            <label className="sales-ledger-line">
              <span>Mã số thuế:</span>
              <input
                type="text"
                value={thongTinMau.taxCode}
                onChange={(event) => capNhatThongTinMau('taxCode', event.target.value)}
                placeholder="Nhập mã số thuế"
              />
            </label>
          </div>

          <div className="sales-ledger-sheet__form-code">
            <strong>Mẫu số S1a-HKD</strong>
            <span>(Kèm theo Thông tư số 152/2025/TT-BTC</span>
            <span>ngày 31 tháng 12 năm 2025 của Bộ trưởng</span>
            <span>Bộ Tài chính)</span>
          </div>
        </div>

        <div className="sales-ledger-sheet__title">
          <h3>SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ</h3>
          <label className="sales-ledger-line sales-ledger-line--center">
            <span>Địa điểm kinh doanh:</span>
            <input
              type="text"
              value={thongTinMau.businessLocation}
              onChange={(event) => capNhatThongTinMau('businessLocation', event.target.value)}
              placeholder="Nhập địa điểm kinh doanh"
            />
          </label>
          <p>Kỳ kê khai: {kyKeKhai}</p>
        </div>

        <div className="sales-ledger-sheet__unit">Đơn vị tính: đồng</div>

        {loi ? <div className="thong-bao-loi">{loi}</div> : null}

        <div className="sales-ledger-table-wrap">
          <table className="sales-ledger-table">
            <thead>
              <tr>
                <th>Ngày tháng</th>
                <th>Diễn giải</th>
                <th>Số tiền</th>
              </tr>
              <tr>
                <th>A</th>
                <th>B</th>
                <th>1</th>
              </tr>
            </thead>
            <tbody>
              {dangTai ? (
                <tr>
                  <td colSpan="3" className="sales-ledger-table__empty">
                    Đang tải dữ liệu doanh thu...
                  </td>
                </tr>
              ) : (
                <>
                  {rows.map((row) => (
                    <tr key={row.paymentTransactionId ?? `${row.transactionDate}-${row.description}`}>
                      <td>{dinhDangNgay(row.transactionDate)}</td>
                      <td>{row.description || 'Thu tiền chuyển khoản'}</td>
                      <td className="sales-ledger-table__money">{dinhDangTienKhongDonVi(row.amount)}</td>
                    </tr>
                  ))}

                  {Array.from({ length: soDongTrong }).map((_, index) => (
                    <tr key={`blank-${index}`}>
                      <td>&nbsp;</td>
                      <td />
                      <td />
                    </tr>
                  ))}
                </>
              )}

              {!dangTai ? (
                <tr className="sales-ledger-table__total">
                  <td />
                  <td>Tổng cộng</td>
                  <td className="sales-ledger-table__money">{dinhDangTienKhongDonVi(tongTien)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="sales-ledger-note">
          <span>Nguồn dữ liệu:</span>
          <strong>Giao dịch chuyển khoản đã đối soát thành công</strong>
        </div>
      </section>
    </div>
  )
}

function EndpointCard({ path, method, operation, spec, moduleKey }) {
  // Ẩn mark-paid và mark-unpaid endpoints — đã tích hợp vào danh sách hóa đơn
  const normalizedPath = path.toLowerCase()
  if (
    moduleKey === 'invoices' &&
    method === 'patch' &&
    (normalizedPath.includes('/mark-paid') || normalizedPath.includes('/mark-unpaid'))
  ) {
    return null
  }

  if (
    moduleKey === 'invoices' &&
    (
      normalizedPath === '/api/invoices/by-room-and-month' ||
      (method === 'get' && (normalizedPath === '/api/invoices/{id:int}' || normalizedPath === '/api/invoices/{id}')) ||
      (method === 'delete' && normalizedPath === '/api/invoices/{id}')
    )
  ) {
    return null
  }

  // monthly-bulk-preview và monthly-bulk dùng component riêng
  if (
    moduleKey === 'invoices' &&
    method === 'post' &&
    (normalizedPath === '/api/invoices/monthly-bulk-preview' || normalizedPath === '/api/invoices/monthly-bulk')
  ) {
    return null
  }

  const parameters = operation.parameters || []
  const queryParams = parameters.filter((param) => param.in === 'query')
  const pathParams = parameters.filter((param) => param.in === 'path')
  const content = operation.requestBody?.content || {}
  const jsonSchema = resolveSchema(content['application/json']?.schema, spec)
  const formSchema = resolveSchema(content['multipart/form-data']?.schema, spec)
  const dungFormTaoPhong = laFormTaoPhong(moduleKey, method, path)
  const dungFormNguoiThue = laFormNguoiThue(moduleKey, method, path)
  const dungFormHopDong = laFormHopDong(moduleKey, method, path)
  const dungFormChiSoDienNuoc = laFormChiSoDienNuoc(moduleKey, method, path)
  const dungFormSuaChiSoDienGoc = laFormSuaChiSoDienGoc(moduleKey, method, path)
  const dungFormHoaDon = laFormHoaDon(moduleKey, method, path)
  const dungFormJsonRieng =
    jsonSchema &&
    (
      dungFormTaoPhong ||
      dungFormNguoiThue ||
      dungFormHopDong ||
      dungFormChiSoDienNuoc ||
      dungFormSuaChiSoDienGoc ||
      dungFormHoaDon
    )
  const laManDanhSachPhong = laDanhSachPhong(moduleKey, method, path)
  const laXemTruocKetThucHopDong =
    moduleKey === 'contracts' &&
    method === 'post' &&
    path.toLowerCase().includes('/end-preview')
  const laManDanhSachHopDong = laDanhSachHopDong(moduleKey, method, path)
  const laManDanhSachHoaDon = laDanhSachHoaDon(moduleKey, method, path)
  const laThePostDonGian = method === 'post' && pathParams.length === 0 && queryParams.length === 0
  const laChiTietHoacCapNhatHopDongTheoPhong =
    moduleKey === 'contracts' &&
    (method === 'get' || method === 'put') &&
    pathParams.length === 1 &&
    path.toLowerCase().startsWith('/api/contracts/{id')

  const laKetThucHopDongTheoPhong =
    moduleKey === 'contracts' &&
    method === 'post' &&
    pathParams.length === 1 &&
    (path.toLowerCase().includes('/end-preview') || path.toLowerCase().includes('/end'))

  const laXoaHopDongDaKetThucTheoPhong =
    moduleKey === 'contracts' &&
    method === 'delete' &&
    pathParams.length === 1 &&
    path.toLowerCase().startsWith('/api/contracts/{id')

  const laXoaChiSoTheoHopDongDaKetThucTheoPhong =
    moduleKey === 'meterreadings' &&
    method === 'delete' &&
    pathParams.length === 1 &&
    path.toLowerCase().startsWith('/api/meterreadings/by-ended-contract/{contractid')

  const laChonHopDongDaKetThucTheoPhong =
    laXoaHopDongDaKetThucTheoPhong || laXoaChiSoTheoHopDongDaKetThucTheoPhong

  const laChonHopDongTheoPhong =
    laChiTietHoacCapNhatHopDongTheoPhong || laKetThucHopDongTheoPhong || laChonHopDongDaKetThucTheoPhong

  const isIdPathEndpoint =
    (moduleKey === 'rooms' || moduleKey === 'tenants') &&
    (method === 'put' || method === 'patch') &&
    pathParams.length === 1 &&
    path.toLowerCase().includes('{id')

  const [pathValues, setPathValues] = useState(
    Object.fromEntries(
      pathParams.map((param) => [
        param.name,
        isIdPathEndpoint || laChonHopDongTheoPhong ? '' : sampleValue(param.schema, spec, param.name),
      ]),
    ),
  )
  const [queryValues, setQueryValues] = useState(Object.fromEntries(queryParams.map((param) => [param.name, ''])))
  const [pathSelectOptions, setPathSelectOptions] = useState([])
  const [pathSelectOptionsLoading, setPathSelectOptionsLoading] = useState(false)
  const [contractRoomOptions, setContractRoomOptions] = useState([])
  const [contractRoomOptionsLoading, setContractRoomOptionsLoading] = useState(false)
  const [contractTenantOptions, setContractTenantOptions] = useState([])
  const [contractTenantOptionsLoading, setContractTenantOptionsLoading] = useState(false)
  const [meterReadingRoomOptions, setMeterReadingRoomOptions] = useState([])
  const [meterReadingRoomOptionsLoading, setMeterReadingRoomOptionsLoading] = useState(false)
  const [meterReadingSelectedRoom, setMeterReadingSelectedRoom] = useState('')
  const [invoiceSelectedRoom, setInvoiceSelectedRoom] = useState('')
  const [selectedActiveContract, setSelectedActiveContract] = useState(null)
  const [selectedActiveContractLoading, setSelectedActiveContractLoading] = useState(false)
  const [jsonBody, setJsonBody] = useState(jsonSchema ? formatJson(sampleValue(jsonSchema, spec)) : '')
  const [bodyValues, setBodyValues] = useState(
    Object.fromEntries(
      Object.entries(jsonSchema?.properties || {}).map(([key, schema]) => [key, sampleValue(schema, spec, key)]),
    ),
  )
  const [formValues, setFormValues] = useState(
    Object.fromEntries(
      Object.entries(formSchema?.properties || {}).map(([key, schema]) => [key, sampleValue(schema, spec, key)]),
    ),
  )
  const [formFiles, setFormFiles] = useState({})
  const [dangGui, setDangGui] = useState(false)
  const [hienXacNhan, setHienXacNhan] = useState(false)
  const [dangKetThuc, setDangKetThuc] = useState(false)
  const [phanHoi, setPhanHoi] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [trangThai, setTrangThai] = useState('Sẵn sàng gửi yêu cầu.')
  const [mauTrangThai, setMauTrangThai] = useState('')
  const [dangMo, setDangMo] = useState(false)

  useEffect(() => {
    if (laManDanhSachPhong) {
      onSubmit()
    }
  }, [laManDanhSachPhong])

  // Auto-load danh sách hóa đơn khi mở
  useEffect(() => {
    if (laManDanhSachHoaDon && dangMo) {
      onSubmit()
    }
  }, [laManDanhSachHoaDon, dangMo, reloadKey])

  const requestBodyLabel = jsonSchema || formSchema ? 'Nội dung gửi' : ''
  const anKhoiPath = pathParams.length === 0
  const laCapNhatThongTinPhong = isIdPathEndpoint
  const anTieuDeKhoiPath = laCapNhatThongTinPhong || laChonHopDongTheoPhong

  const capNhatField = (setter, name, value) => {
    const nextValue = laFieldTien(name) ? chuanHoaTienKhiNhap(value) : value
    setter((current) => ({
      ...current,
      [name]: nextValue,
    }))
  }

  const timHopDongActiveTuDanhSach = (selectedRoomCode) => {
    if (!selectedRoomCode) return null

    const normalizedSelectedRoomCode = String(selectedRoomCode).trim().toLowerCase()
    const matchedOption = meterReadingRoomOptions.find(
      (option) => String(option.value || '').trim().toLowerCase() === normalizedSelectedRoomCode,
    )

    if (!matchedOption) return null

    return {
      roomCode: String(matchedOption.value || '').trim(),
      RoomCode: String(matchedOption.value || '').trim(),
      roomId: Number(String(matchedOption.roomId || '').trim()),
      RoomId: Number(String(matchedOption.roomId || '').trim()),
      contractId: Number(String(matchedOption.contractId || '').trim()),
      ContractId: Number(String(matchedOption.contractId || '').trim()),
    }
  }

  const chonPhongTheoHopDongActive = async (selectedRoomCode, mode = 'meter') => {
    if (mode === 'meter') {
      setMeterReadingSelectedRoom(selectedRoomCode)
    }
    if (mode === 'invoice') {
      setInvoiceSelectedRoom(selectedRoomCode)
    }

    if (!selectedRoomCode) {
      setSelectedActiveContract(null)
      setFormValues((current) => ({
        ...current,
        RoomId: current.RoomId !== undefined ? '' : current.RoomId,
        roomId: current.roomId !== undefined ? '' : current.roomId,
        ContractId: current.ContractId !== undefined ? '' : current.ContractId,
        contractId: current.contractId !== undefined ? '' : current.contractId,
      }))
      return
    }

    setSelectedActiveContractLoading(true)

    try {
      const activeContract = timHopDongActiveTuDanhSach(selectedRoomCode)
      if (!activeContract) {
        throw new Error('Không tìm thấy hợp đồng active trong danh sách hiện có của phòng đã chọn.')
      }
      const selectedRoomId = activeContract.roomId ?? activeContract.RoomId
      const selectedContractId = activeContract.contractId ?? activeContract.ContractId

      setSelectedActiveContract(activeContract)
      setFormValues((current) => ({
        ...current,
        RoomId: current.RoomId !== undefined ? String(selectedRoomId ?? '') : current.RoomId,
        roomId: current.roomId !== undefined ? String(selectedRoomId ?? '') : current.roomId,
        ContractId: current.ContractId !== undefined ? String(selectedContractId ?? '') : current.ContractId,
        contractId: current.contractId !== undefined ? String(selectedContractId ?? '') : current.contractId,
      }))
    } catch (error) {
      setSelectedActiveContract(null)
      setFormValues((current) => ({
        ...current,
        RoomId: current.RoomId !== undefined ? '' : current.RoomId,
        roomId: current.roomId !== undefined ? '' : current.roomId,
        ContractId: current.ContractId !== undefined ? '' : current.ContractId,
        contractId: current.contractId !== undefined ? '' : current.contractId,
      }))
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
    } finally {
      setSelectedActiveContractLoading(false)
    }
  }

  useEffect(() => {
    const canLoadPathOptions =
      (pathParams.length > 0 &&
        (moduleKey === 'rooms' || moduleKey === 'tenants') &&
        (method === 'put' || method === 'patch')) ||
      laChonHopDongTheoPhong

    if (!canLoadPathOptions) return

    let active = true
    setPathSelectOptionsLoading(true)

    function extractArray(value) {
      if (Array.isArray(value)) return value
      if (!value || typeof value !== 'object') return null

      const candidates = ['data', 'items', 'results', 'rooms', 'value']
      for (const key of candidates) {
        const candidate = value[key] ?? value[key.charAt(0).toUpperCase() + key.slice(1)]
        if (Array.isArray(candidate)) return candidate
      }

      for (const item of Object.values(value)) {
        if (Array.isArray(item)) return item
      }

      return null
    }

    async function taiDanhSachChoDropdown() {
      const candidates = laChonHopDongTheoPhong
        ? laChonHopDongDaKetThucTheoPhong
          ? [
            '/api/Contracts?status=ended',
            '/Api/Contracts?status=ended',
            '/api/contracts?status=ended',
            '/Api/contracts?status=ended',
          ]
          : ['/api/Contracts', '/Api/Contracts', '/api/contracts', '/Api/contracts']
        : moduleKey === 'rooms'
          ? ['/api/Rooms', '/Api/Rooms', '/api/rooms', '/Api/rooms']
          : ['/api/Tenants', '/Api/Tenants', '/api/tenants', '/Api/tenants']

      for (const url of candidates) {
        try {
          const response = await fetch(url)
          if (!response.ok) continue
          const payload = await response.json()
          const data = extractArray(payload) || []
          if (!active || !Array.isArray(data) || !data.length) continue

          const filteredData = laChonHopDongTheoPhong
            ? laChonHopDongDaKetThucTheoPhong
              ? data.filter((item) => !laHopDongConHieuLuc(item))
              : data.filter(laHopDongConHieuLuc)
            : data

          const options = filteredData
            .map((item) => {
              const rawValue = laChonHopDongTheoPhong
                ? item.contractId ?? item.ContractId ?? item.id ?? item.Id
                : item.id ?? item.Id ?? item.tenantId ?? item.TenantId ?? item.roomId ?? item.RoomId
              const value = rawValue != null ? String(rawValue) : null
              const label = laChonHopDongTheoPhong
                ? [item.roomCode ?? item.RoomCode, item.tenantName ?? item.TenantName].filter(Boolean).join(' - ') ||
                String(rawValue ?? '---')
                : moduleKey === 'rooms'
                  ? item.roomCode ?? item.RoomCode ?? String(rawValue ?? '---')
                  : item.fullName ?? item.FullName ?? item.phone ?? item.Phone ?? item.cccd ?? item.CCCD ?? String(rawValue ?? '---')
              return value != null ? { value, label } : null
            })
            .filter(Boolean)

          if (options.length) {
            setPathSelectOptions(options)
            return
          }
        } catch {
          // bỏ qua lỗi và thử url tiếp theo
        }
      }
    }

    taiDanhSachChoDropdown().finally(() => {
      if (active) setPathSelectOptionsLoading(false)
    })

    return () => {
      active = false
    }
  }, [laChonHopDongTheoPhong, laChonHopDongDaKetThucTheoPhong, method, moduleKey, pathParams.length])

  useEffect(() => {
    if (!dungFormHopDong) return

    let active = true
    setContractRoomOptionsLoading(true)
    setContractTenantOptionsLoading(true)

    function extractArray(value) {
      if (Array.isArray(value)) return value
      if (!value || typeof value !== 'object') return null

      const candidates = ['data', 'items', 'results', 'rooms', 'tenants', 'value']
      for (const key of candidates) {
        const candidate = value[key] ?? value[key.charAt(0).toUpperCase() + key.slice(1)]
        if (Array.isArray(candidate)) return candidate
      }

      for (const item of Object.values(value)) {
        if (Array.isArray(item)) return item
      }

      return null
    }

    async function taiOptions(urls) {
      for (const url of urls) {
        try {
          const response = await fetch(url)
          if (!response.ok) continue
          const payload = await response.json()
          const data = extractArray(payload)
          if (Array.isArray(data)) return data
        } catch {
          // bỏ qua lỗi và thử url tiếp theo
        }
      }

      return []
    }

    Promise.all([
      taiOptions(['/api/Rooms', '/Api/Rooms', '/api/rooms', '/Api/rooms']),
      taiOptions(['/api/Tenants', '/Api/Tenants', '/api/tenants', '/Api/tenants']),
    ])
      .then(([rooms, tenants]) => {
        if (!active) return

        setContractRoomOptions(
          rooms
            .filter(laPhongChuaThue)
            .map((room) => {
              const rawValue = room.roomId ?? room.RoomId ?? room.id ?? room.Id
              const value = rawValue != null ? String(rawValue) : null
              const label = room.roomCode ?? room.RoomCode ?? room.name ?? room.Name ?? String(rawValue ?? '---')
              return value != null ? { value, label } : null
            })
            .filter(Boolean),
        )

        setContractTenantOptions(
          tenants
            .map((tenant) => {
              const rawValue = tenant.tenantId ?? tenant.TenantId ?? tenant.id ?? tenant.Id
              const value = rawValue != null ? String(rawValue) : null
              const label =
                tenant.fullName ??
                tenant.FullName ??
                tenant.phone ??
                tenant.Phone ??
                tenant.cccd ??
                tenant.CCCD ??
                String(rawValue ?? '---')
              return value != null ? { value, label } : null
            })
            .filter(Boolean),
        )
      })
      .finally(() => {
        if (!active) return
        setContractRoomOptionsLoading(false)
        setContractTenantOptionsLoading(false)
      })

    return () => {
      active = false
    }
  }, [dungFormHopDong])

  useEffect(() => {
    if (!dungFormChiSoDienNuoc && !dungFormSuaChiSoDienGoc && !dungFormHoaDon && moduleKey !== 'invoices') return

    let active = true
    setMeterReadingRoomOptionsLoading(true)

    function extractArray(value) {
      if (Array.isArray(value)) return value
      if (!value || typeof value !== 'object') return null

      const candidates = ['data', 'items', 'results', 'contracts', 'value']
      for (const key of candidates) {
        const candidate = value[key] ?? value[key.charAt(0).toUpperCase() + key.slice(1)]
        if (Array.isArray(candidate)) return candidate
      }

      for (const item of Object.values(value)) {
        if (Array.isArray(item)) return item
      }

      return null
    }

    async function taiRoomCodeOptions() {
      const urls = dungFormSuaChiSoDienGoc
        ? ['/api/Rooms', '/Api/Rooms', '/api/rooms', '/Api/rooms']
        : [
          '/api/Contracts?status=active',
          '/Api/Contracts?status=active',
          '/api/contracts?status=active',
          '/Api/contracts?status=active',
        ]

      for (const url of urls) {
        try {
          const response = await fetch(url)
          if (!response.ok) continue
          const payload = await response.json()
          const data = extractArray(payload) || []
          if (!active || !Array.isArray(data) || !data.length) continue

          const options = data
            .map((item) => {
              const roomCode = item.roomCode ?? item.RoomCode ?? item.room?.roomCode ?? item.Room?.RoomCode
              const roomId = item.roomId ?? item.RoomId ?? item.room?.roomId ?? item.Room?.RoomId
              const contractId = item.contractId ?? item.ContractId ?? item.contract?.contractId ?? item.Contract?.ContractId

              if (!roomCode || roomId == null) return null
              if (!dungFormSuaChiSoDienGoc && contractId == null) return null

              return {
                value: String(roomCode).trim(),
                label: String(roomCode).trim(),
                roomId: String(roomId).trim(),
                contractId: contractId == null ? '' : String(contractId).trim(),
              }
            })
            .filter(Boolean)

          if (options.length) {
            setMeterReadingRoomOptions(options)
            return
          }
        } catch {
          // bỏ qua lỗi và thử url tiếp theo
        }
      }
    }

    taiRoomCodeOptions().finally(() => {
      if (active) setMeterReadingRoomOptionsLoading(false)
    })

    return () => {
      active = false
    }
  }, [dungFormChiSoDienNuoc, dungFormSuaChiSoDienGoc, dungFormHoaDon, moduleKey])

  useEffect(() => {
    if (!dungFormChiSoDienNuoc && !dungFormHoaDon) return

    setFormValues((current) => ({
      ...current,
      RoomId: current.RoomId !== undefined ? '' : current.RoomId,
      roomId: current.roomId !== undefined ? '' : current.roomId,
      ContractId: current.ContractId !== undefined ? '' : current.ContractId,
      contractId: current.contractId !== undefined ? '' : current.contractId,
    }))
  }, [dungFormChiSoDienNuoc, dungFormHoaDon])

  useEffect(() => {
    if (!dungFormSuaChiSoDienGoc) return

    setFormValues((current) => ({
      ...current,
      RoomCode: current.RoomCode !== undefined ? '' : current.RoomCode,
      roomCode: current.roomCode !== undefined ? '' : current.roomCode,
    }))
  }, [dungFormSuaChiSoDienGoc])

  useEffect(() => {
    const coQueryRoomIdTheoHopDongActive =
      method === 'get' &&
      moduleKey === 'meterreadings' &&
      queryParams.some((param) => String(param.name || '').toLowerCase() === 'roomid')

    if (!coQueryRoomIdTheoHopDongActive || !meterReadingRoomOptions.length) return

    const roomIdParam = queryParams.find((param) => String(param.name || '').toLowerCase() === 'roomid')?.name
    if (!roomIdParam) return
    if (queryValues[roomIdParam]) return

    setQueryValues((current) => ({
      ...current,
      [roomIdParam]: meterReadingRoomOptions[0].roomId,
    }))
  }, [meterReadingRoomOptions, method, moduleKey, queryParams, queryValues])

  useEffect(() => {
    if (!dangMo) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDangMo(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dangMo])

  const resetForm = () => {
    setPathValues(
      Object.fromEntries(
        pathParams.map((param) => [
          param.name,
          isIdPathEndpoint || laChonHopDongTheoPhong ? '' : sampleValue(param.schema, spec, param.name),
        ]),
      ),
    )
    setQueryValues(Object.fromEntries(queryParams.map((param) => [param.name, ''])))
    setJsonBody(jsonSchema ? formatJson(sampleValue(jsonSchema, spec)) : '')
    setBodyValues(
      Object.fromEntries(
        Object.entries(jsonSchema?.properties || {}).map(([key, schema]) => [key, sampleValue(schema, spec, key)]),
      ),
    )
    setFormValues(
      Object.fromEntries(
        Object.entries(formSchema?.properties || {}).map(([key, schema]) => [key, sampleValue(schema, spec, key)]),
      ),
    )
    setFormFiles({})
    setMeterReadingSelectedRoom('')
    setInvoiceSelectedRoom('')
    setSelectedActiveContract(null)
    setTrangThai('Đã đưa biểu mẫu về giá trị mặc định.')
    setMauTrangThai('')
    setPhanHoi(null)
  }

  const onSubmit = async () => {
    setDangGui(true)
    setTrangThai('Đang gửi yêu cầu tới máy chủ...')
    setMauTrangThai('')

    try {
      let finalPath = path

      pathParams.forEach((param) => {
        const value = pathValues[param.name]
        finalPath = finalPath.replace(`{${param.name}}`, encodeURIComponent(value))
      })

      const query = new URLSearchParams()
      queryParams.forEach((param) => {
        const rawValue = queryValues[param.name]
        if (rawValue !== '' && rawValue !== null && rawValue !== undefined) {
          query.set(param.name, normalizeValue(rawValue, param.schema, spec, param.name))
        }
      })

      const url = `${finalPath}${query.toString() ? `?${query.toString()}` : ''}`
      const options = {
        method: method.toUpperCase(),
        headers: {},
      }

      if (jsonSchema) {
        options.headers['Content-Type'] = 'application/json'
        if (dungFormJsonRieng) {
          let bodyObject = Object.fromEntries(
            Object.entries(jsonSchema?.properties || {}).map(([name, schema]) => [
              name,
              normalizeValue(formValues[name], schema, spec, name),
            ]),
          )

          if (dungFormChiSoDienNuoc || dungFormHoaDon) {
            const selectedRoomCode = dungFormChiSoDienNuoc ? meterReadingSelectedRoom : invoiceSelectedRoom

            if (!selectedRoomCode) {
              throw new Error('Vui lòng chọn mã phòng đang active.')
            }

            const normalizedSelectedRoomCode = String(selectedRoomCode).trim().toLowerCase()
            const activeContract =
              selectedActiveContract &&
                String(selectedActiveContract.roomCode ?? selectedActiveContract.RoomCode ?? '')
                  .trim()
                  .toLowerCase() === normalizedSelectedRoomCode
                ? selectedActiveContract
                : timHopDongActiveTuDanhSach(selectedRoomCode)

            if (!activeContract) {
              throw new Error('Không tìm thấy hợp đồng active trong danh sách hiện có của phòng đã chọn.')
            }

            const selectedRoomId = activeContract.roomId ?? activeContract.RoomId
            const selectedContractId = activeContract.contractId ?? activeContract.ContractId

            if (selectedRoomId == null || selectedContractId == null) {
              throw new Error('Không lấy được RoomId hoặc ContractId active của phòng đã chọn.')
            }

            bodyObject = {
              ...bodyObject,
              RoomId: Number(selectedRoomId),
              roomId: Number(selectedRoomId),
              ContractId: Number(selectedContractId),
              contractId: Number(selectedContractId),
            }
          }

          if (dungFormSuaChiSoDienGoc) {
            if (!meterReadingSelectedRoom) {
              throw new Error('Vui lòng chọn mã phòng cần sửa chỉ số điện.')
            }

            bodyObject = {
              ...bodyObject,
              RoomCode: meterReadingSelectedRoom,
              roomCode: meterReadingSelectedRoom,
            }
          }

          options.body = JSON.stringify(bodyObject)
        } else if (Object.keys(jsonSchema?.properties || {}).length) {
          const bodyObject = Object.fromEntries(
            Object.entries(jsonSchema?.properties || {}).map(([name, schema]) => [
              name,
              normalizeValue(bodyValues[name], schema, spec, name),
            ]),
          )
          options.body = JSON.stringify(bodyObject)
        } else {
          options.body = jsonBody.trim() ? JSON.stringify(JSON.parse(jsonBody)) : undefined
        }
      }

      if (formSchema) {
        const formData = new FormData()
        Object.entries(formSchema.properties || {}).forEach(([name, schema]) => {
          const resolved = resolveSchema(schema, spec) || {}
          if (resolved.format === 'binary') {
            if (formFiles[name]) {
              formData.append(name, formFiles[name])
            }
            return
          }

          const value = formValues[name]
          if (value !== '' && value !== null && value !== undefined) {
            formData.append(name, normalizeValue(value, schema, spec, name))
          }
        })

        options.body = formData
      }

      const result = await guiRequest(url, options)
      setTrangThai(`Thành công - HTTP ${result.status}`)
      setMauTrangThai('thanh-cong')
      setPhanHoi(result.payload)
    } catch (error) {
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
      setPhanHoi({ message: thongDiepLoi(error) })
    } finally {
      setDangGui(false)
    }
  }

  const onKetThucHopDong = async () => {
    setDangKetThuc(true)
    setHienXacNhan(false)
    setTrangThai('Đang gửi yêu cầu kết thúc hợp đồng...')
    setMauTrangThai('')

    try {
      const contractId = pathValues[pathParams[0]?.name]
      const endPath = path.replace('/end-preview', '/end')
      const finalPath = endPath.replace(`{${pathParams[0]?.name}}`, encodeURIComponent(contractId))
      const previewPayload = phanHoi && typeof phanHoi === 'object' && !Array.isArray(phanHoi) ? phanHoi : null
      const sourceValues = dungFormJsonRieng ? formValues : bodyValues
      const requestPayload = Object.fromEntries(
        Object.entries(jsonSchema?.properties || {})
          .map(([name, schema]) => [name, normalizeValue(sourceValues[name], schema, spec, name)])
          .filter(([, value]) => value !== '' && value !== null && value !== undefined),
      )

      if (!requestPayload.actualEndDate && !requestPayload.ActualEndDate) {
        requestPayload.actualEndDate =
          previewPayload?.actualEndDate ??
          previewPayload?.ActualEndDate ??
          new Date().toISOString().split('T')[0]
      }

      const result = await guiRequest(finalPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })

      const remainingAmount = Number(previewPayload?.remainingAmount ?? previewPayload?.RemainingAmount ?? 0)
      const refundedAmount = Number(previewPayload?.refundedAmount ?? previewPayload?.RefundedAmount ?? 0)

      let successMessage = `Kết thúc hợp đồng thành công - HTTP ${result.status}`
      if (remainingAmount > 0) {
        successMessage = `Kết thúc hợp đồng thành công - đã tạo hóa đơn chốt ${dinhDangTien(remainingAmount)} cho khách thanh toán.`
      } else if (refundedAmount > 0) {
        successMessage = `Kết thúc hợp đồng thành công - đã ghi nhận hoàn cọc ${dinhDangTien(refundedAmount)} vào chi phí tháng.`
      } else {
        successMessage = 'Kết thúc hợp đồng thành công - tiền cọc đã được cấn trừ hết, không phát sinh thêm.'
      }

      setTrangThai(successMessage)
      setMauTrangThai('thanh-cong')
      setPhanHoi({
        ...(previewPayload || {}),
        ...(result.payload || {}),
      })
    } catch (error) {
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
    } finally {
      setDangKetThuc(false)
    }
  }

  function renderXemNhanhNoiDungGui(data) {
    if (moduleKey === 'rooms' && Array.isArray(data) && data.every(laDuLieuPhong)) {
      return <XemDanhSachPhong data={data} />
    }

    if (moduleKey === 'rooms' && laDuLieuPhong(data)) {
      return <XemPhong data={data} />
    }

    if (moduleKey === 'tenants' && Array.isArray(data) && data.every(laDuLieuNguoiThue)) {
      return <XemDanhSachNguoiThue data={data} />
    }

    if (moduleKey === 'tenants' && laDuLieuNguoiThue(data)) {
      return <XemNguoiThue data={data} />
    }

    if (moduleKey === 'invoices' && Array.isArray(data) && data.every(laDuLieuHoaDon)) {
      return <XemDanhSachHoaDon data={data} />
    }

  if (moduleKey === 'invoices' && laDuLieuHoaDon(data)) {
    return <XemHoaDonChiTiet data={data} />
  }

  if (moduleKey === 'meterreadings' && Array.isArray(data) && data.every(laDuLieuChiSoDien)) {
    return <XemDanhSachChiSoDien data={data} />
  }

  if (moduleKey === 'meterreadings' && laDuLieuChiSoDien(data)) {
    return <XemChiSoDien data={data} />
  }

  return <XemDuLieu data={data} emptyText="" />
}

  const tenEndpoint = datTenEndpoint(moduleKey, method, path)

  const noiDungChiTiet = (
    <article className="the-endpoint the-endpoint--mo">
      <div className="the-endpoint__dau">
        <div>
          <span className={`method-tag method-tag--${method}`}>{method.toUpperCase()}</span>
          <h3>{tenEndpoint}</h3>
          {operation.summary && operation.summary !== tenEndpoint ? <p className="duong-dan">{operation.summary}</p> : null}
        </div>
        <button type="button" className="nut-dong-endpoint" onClick={() => setDangMo(false)} aria-label="Đóng">
          ×
        </button>
      </div>

      <div className="khoi-form">
        {!anKhoiPath ? (
          <section className="khoi-con">
            {!anTieuDeKhoiPath ? <h4>Tham số đường dẫn</h4> : null}
            {pathParams.length ? (
              <div className="luoi-input">
                {pathParams.map((param) => {
                  const isIdSelect =
                    (((moduleKey === 'rooms' || moduleKey === 'tenants') &&
                      (method === 'put' || method === 'patch') &&
                      pathParams.length === 1 &&
                      (param.name.toLowerCase() === 'id' || path.toLowerCase().includes('{id'))) ||
                      (laChonHopDongTheoPhong &&
                        pathParams.length === 1 &&
                        (param.name.toLowerCase() === 'id' ||
                          param.name.toLowerCase() === 'contractid' ||
                          path.toLowerCase().includes('{id') ||
                          path.toLowerCase().includes('{contractid'))))

                  const placeholderText = laChonHopDongDaKetThucTheoPhong
                    ? 'Chọn phòng đã chấm dứt'
                    : laKetThucHopDongTheoPhong
                      ? 'Chọn phòng'
                      : laChonHopDongTheoPhong
                        ? 'Chọn phòng có hợp đồng'
                        : moduleKey === 'rooms'
                          ? 'Chọn phòng'
                          : 'Chọn người thuê'

                  const emptyText = pathSelectOptionsLoading
                    ? laChonHopDongDaKetThucTheoPhong
                      ? 'Đang tải phòng đã chấm dứt...'
                      : laKetThucHopDongTheoPhong
                        ? 'Đang tải phòng...'
                        : laChonHopDongTheoPhong
                          ? 'Đang tải danh sách hợp đồng...'
                          : moduleKey === 'rooms'
                            ? 'Đang tải phòng...'
                            : 'Đang tải người thuê...'
                    : pathSelectOptions.length
                      ? placeholderText
                      : laChonHopDongDaKetThucTheoPhong
                        ? 'Không có phòng đã chấm dứt'
                        : laKetThucHopDongTheoPhong
                          ? 'Không có phòng'
                          : laChonHopDongTheoPhong
                            ? 'Không có hợp đồng'
                            : moduleKey === 'rooms'
                              ? 'Không có phòng'
                              : 'Không có người thuê'

                  const pathLabel = isIdSelect
                    ? laChonHopDongDaKetThucTheoPhong
                      ? 'Chọn phòng đã chấm dứt'
                      : laKetThucHopDongTheoPhong
                        ? 'Chọn phòng'
                        : laChonHopDongTheoPhong
                          ? 'Chọn phòng có hợp đồng'
                          : moduleKey === 'rooms'
                            ? 'Nhập mã phòng'
                            : 'Chọn người thuê'
                    : tenDep(param.name)

                  return (
                    <label key={param.name} className="truong">
                      <span>{pathLabel}</span>
                      {isIdSelect ? (
                        <select
                          value={String(pathValues[param.name] ?? '')}
                          onChange={(event) => capNhatField(setPathValues, param.name, event.target.value)}
                          disabled={pathSelectOptionsLoading || pathSelectOptions.length === 0}
                        >
                          <option value="">{emptyText}</option>
                          {pathSelectOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={laFieldTien(param.name) ? 'text' : kieuInput(param.schema, spec, param.name)}
                          value={giaTriInput(param.schema, spec, param.name, pathValues[param.name])}
                          onChange={(event) => capNhatField(setPathValues, param.name, event.target.value)}
                          placeholder={placeholderInput(param.schema, spec, param.name, param.name)}
                        />
                      )}
                      <small>{typeLabel(resolveSchema(param.schema, spec))}</small>
                    </label>
                  )
                })}
              </div>
            ) : (
              <p className="trong">Không có tham số đường dẫn.</p>
            )}
          </section>
        ) : null}

        {queryParams.length ? (
          <section className="khoi-con">
            <div className="luoi-input">
              {queryParams.map((param) => {
                const normalizedName = String(param.name || '').toLowerCase()
                if (laManDanhSachHopDong && normalizedName === 'roomid') return null
                const laLocTrangThaiHopDong = laManDanhSachHopDong && normalizedName === 'status'
                const laLocTrangThaiHoaDon = moduleKey === 'invoices' && method === 'get' && normalizedName === 'status'
                const laLocTrangThaiPhong = moduleKey === 'rooms' && method === 'get' && normalizedName === 'status'
                const laLocPhongTheoHopDongActive =
                  (moduleKey === 'invoices' || moduleKey === 'meterreadings') && normalizedName === 'roomid'

                return (
                  <label key={param.name} className="truong">
                    <span>{nhanTruong(moduleKey, path, param.name)}</span>
                    {laLocTrangThaiPhong ? (
                      <select
                        value={queryValues[param.name] ?? ''}
                        onChange={(event) => capNhatField(setQueryValues, param.name, event.target.value)}
                      >
                        <option value="">Tất cả</option>
                        <option value="vacant">Chưa cho thuê</option>
                        <option value="occupied">Đã cho thuê</option>
                      </select>
                    ) : laLocTrangThaiHopDong ? (
                      <select
                        value={queryValues[param.name] ?? ''}
                        onChange={(event) => capNhatField(setQueryValues, param.name, event.target.value)}
                      >
                        <option value="">Tất cả trạng thái</option>
                        <option value="active">Còn hiệu lực</option>
                        <option value="ended">Chấm dứt</option>
                      </select>
                    ) : laLocTrangThaiHoaDon ? (
                      <select
                        value={queryValues[param.name] ?? ''}
                        onChange={(event) => capNhatField(setQueryValues, param.name, event.target.value)}
                      >
                        <option value="">Tất cả trạng thái</option>
                        <option value="paid">Đã thanh toán</option>
                      </select>
                    ) : laLocPhongTheoHopDongActive ? (
                      <select
                        value={queryValues[param.name] ?? ''}
                        onChange={(event) => capNhatField(setQueryValues, param.name, event.target.value)}
                        disabled={meterReadingRoomOptionsLoading || meterReadingRoomOptions.length === 0}
                      >
                        <option value="">
                          {meterReadingRoomOptionsLoading
                            ? 'Đang tải danh sách phòng...'
                            : meterReadingRoomOptions.length
                              ? 'Chọn mã phòng đang active'
                              : 'Không có phòng active'}
                        </option>
                        {meterReadingRoomOptions.map((option) => (
                          <option key={`${option.roomId}-${option.contractId}`} value={option.roomId}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={laFieldTien(param.name) ? 'text' : kieuInput(param.schema, spec, param.name)}
                        value={giaTriInput(param.schema, spec, param.name, queryValues[param.name])}
                        onChange={(event) => capNhatField(setQueryValues, param.name, event.target.value)}
                        placeholder={placeholderInput(param.schema, spec, param.name, tenDep(param.name))}
                      />
                    )}
                    <small>{typeLabel(resolveSchema(param.schema, spec))}</small>
                  </label>
                )
              })}
            </div>
          </section>
        ) : null}

        {requestBodyLabel ? (
          <section className="khoi-con">
            <h4>{requestBodyLabel}</h4>
            {dungFormJsonRieng ? (
              <>
                <div className="luoi-input">
                  {dungFormChiSoDienNuoc || dungFormSuaChiSoDienGoc || dungFormHoaDon ? (
                    <label className="truong">
                      <span>{nhanTruong(moduleKey, path, 'roomSelector')}</span>
                      <select
                        value={(dungFormChiSoDienNuoc || dungFormSuaChiSoDienGoc) ? meterReadingSelectedRoom : invoiceSelectedRoom}
                        onChange={(event) => {
                          if (dungFormSuaChiSoDienGoc) {
                            setMeterReadingSelectedRoom(event.target.value)
                            return
                          }

                          chonPhongTheoHopDongActive(event.target.value, dungFormChiSoDienNuoc ? 'meter' : 'invoice')
                        }}
                        disabled={
                          meterReadingRoomOptionsLoading ||
                          ((dungFormChiSoDienNuoc || dungFormHoaDon) && selectedActiveContractLoading) ||
                          meterReadingRoomOptions.length === 0
                        }
                      >
                        <option value="">
                          {meterReadingRoomOptionsLoading
                            ? 'Đang tải danh sách phòng...'
                            : (dungFormChiSoDienNuoc || dungFormHoaDon) && selectedActiveContractLoading
                              ? 'Đang kiểm tra hợp đồng active...'
                              : meterReadingRoomOptions.length
                                ? dungFormSuaChiSoDienGoc
                                  ? 'Chọn mã phòng'
                                  : 'Chọn mã phòng đang active'
                                : dungFormSuaChiSoDienGoc
                                  ? 'Không có phòng'
                                  : 'Không có phòng active'}
                        </option>
                        {meterReadingRoomOptions.map((option) => (
                          <option key={`${option.roomId}-${option.contractId}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <small>
                        {dungFormSuaChiSoDienGoc
                          ? 'Chọn roomCode, backend sẽ tự tìm bản ghi chỉ số điện theo phòng và tháng rồi tính lại chuỗi chỉ số.'
                          : selectedActiveContract
                            ? `Đang dùng RoomId ${selectedActiveContract.roomId ?? selectedActiveContract.RoomId} và hợp đồng active #${selectedActiveContract.contractId ?? selectedActiveContract.ContractId}.`
                            : 'Chọn mã phòng, hệ thống tự gán RoomId và ContractId active.'}
                      </small>
                    </label>
                  ) : null}

                  {Object.entries(jsonSchema?.properties || {}).map(([name, schema]) => {
                    const resolved = resolveSchema(schema, spec) || {}
                    const isStatus =
                      moduleKey === 'rooms' &&
                      (method === 'put' || method === 'patch') &&
                      (name === 'Status' || name === 'status')
                    const normalizedName = String(name).toLowerCase()
                    const isContractRoomField = dungFormHopDong && normalizedName === 'roomid'
                    const isContractTenantField = dungFormHopDong && normalizedName === 'tenantid'
                    const isMeterReadingHiddenField =
                      (dungFormChiSoDienNuoc || dungFormHoaDon) &&
                      (normalizedName === 'roomid' || normalizedName === 'contractid')
                    const isOriginalMeterReadingHiddenField =
                      dungFormSuaChiSoDienGoc && normalizedName === 'roomcode'

                    if (isMeterReadingHiddenField || isOriginalMeterReadingHiddenField) {
                      return null
                    }

                    return (
                      <label key={name} className="truong">
                        <span>{nhanTruong(moduleKey, path, name)}</span>
                        {isStatus ? (
                          <select
                            value={formValues[name] ?? ''}
                            onChange={(event) => capNhatField(setFormValues, name, event.target.value)}
                          >
                            <option value="vacant">Chưa cho thuê</option>
                            <option value="occupied">Đã cho thuê</option>
                          </select>
                        ) : isContractRoomField ? (
                          <select
                            value={formValues[name] ?? ''}
                            onChange={(event) => capNhatField(setFormValues, name, event.target.value)}
                            disabled={contractRoomOptionsLoading || contractRoomOptions.length === 0}
                          >
                            <option value="">
                              {contractRoomOptionsLoading
                                ? 'Đang tải phòng trống...'
                                : contractRoomOptions.length
                                  ? 'Chọn phòng chưa được thuê'
                                  : 'Không có phòng trống'}
                            </option>
                            {contractRoomOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : isContractTenantField ? (
                          <select
                            value={formValues[name] ?? ''}
                            onChange={(event) => capNhatField(setFormValues, name, event.target.value)}
                            disabled={contractTenantOptionsLoading || contractTenantOptions.length === 0}
                          >
                            <option value="">
                              {contractTenantOptionsLoading
                                ? 'Đang tải người thuê...'
                                : contractTenantOptions.length
                                  ? 'Chọn người thuê'
                                  : 'Không có người thuê'}
                            </option>
                            {contractTenantOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={laFieldTien(name) ? 'text' : kieuInput(schema, spec, name)}
                            value={giaTriInput(schema, spec, name, formValues[name])}
                            onChange={(event) => capNhatField(setFormValues, name, event.target.value)}
                            placeholder={placeholderInput(schema, spec, name, nhanTruong(moduleKey, path, name))}
                          />
                        )}
                        <small>{typeLabel(resolved)}</small>
                      </label>
                    )
                  })}
                </div>

                <div className="xem-truoc">
                  <div className="xem-truoc__dau">
                    <strong>Xem nhanh nội dung gửi</strong>
                    <span>Định dạng trực quan</span>
                  </div>
                  {renderXemNhanhNoiDungGui(
                    dungFormChiSoDienNuoc
                      ? {
                        roomSelector: meterReadingSelectedRoom,
                        roomId: selectedActiveContract?.roomId ?? selectedActiveContract?.RoomId ?? '',
                        contractId: selectedActiveContract?.contractId ?? selectedActiveContract?.ContractId ?? '',
                        ...formValues,
                      }
                      : dungFormHoaDon
                        ? {
                          roomSelector: invoiceSelectedRoom,
                          roomId: selectedActiveContract?.roomId ?? selectedActiveContract?.RoomId ?? '',
                          contractId: selectedActiveContract?.contractId ?? selectedActiveContract?.ContractId ?? '',
                          ...formValues,
                        }
                        : dungFormSuaChiSoDienGoc
                          ? {
                            roomSelector: meterReadingSelectedRoom,
                            roomCode: meterReadingSelectedRoom,
                            ...formValues,
                          }
                          : formValues,
                  )}
                </div>
              </>
            ) : jsonSchema && Object.keys(jsonSchema?.properties || {}).length ? (
              <>
                <div className="luoi-input">
                  {Object.entries(jsonSchema.properties).map(([name, schema]) => {
                    const resolved = resolveSchema(schema, spec) || {}
                    const isStatusField =
                      moduleKey === 'rooms' &&
                      (method === 'put' || method === 'patch') &&
                      (name === 'Status' || name === 'status')

                    return (
                      <label key={name} className="truong">
                        <span>{nhanTruong(moduleKey, path, name)}</span>
                        {isStatusField ? (
                          <select
                            value={bodyValues[name] ?? ''}
                            onChange={(event) => capNhatField(setBodyValues, name, event.target.value)}
                          >
                            <option value="">Chọn trạng thái</option>
                            <option value="vacant">Chưa cho thuê</option>
                            <option value="occupied">Đã cho thuê</option>
                          </select>
                        ) : (
                          <input
                            type={laFieldTien(name) ? 'text' : kieuInput(schema, spec, name)}
                            value={giaTriInput(schema, spec, name, bodyValues[name])}
                            onChange={(event) => capNhatField(setBodyValues, name, event.target.value)}
                            placeholder={placeholderInput(schema, spec, name, nhanTruong(moduleKey, path, name))}
                          />
                        )}
                        <small>{typeLabel(resolved)}</small>
                      </label>
                    )
                  })}
                </div>

                <div className="xem-truoc">
                  <div className="xem-truoc__dau">
                    <strong>Xem nhanh nội dung gửi</strong>
                    <span>Định dạng trực quan</span>
                  </div>
                  {renderXemNhanhNoiDungGui(bodyValues)}
                </div>
              </>
            ) : formSchema ? (
              <>
                <div className="luoi-input">
                  {Object.entries(formSchema?.properties || {}).map(([name, schema]) => {
                    const resolved = resolveSchema(schema, spec) || {}
                    if (resolved.format === 'binary') {
                      return (
                        <label key={name} className="truong">
                          <span>{name}</span>
                          <input
                            type="file"
                            onChange={(event) =>
                              setFormFiles((current) => ({
                                ...current,
                                [name]: event.target.files?.[0],
                              }))
                            }
                          />
                          <small>Tệp tải lên</small>
                        </label>
                      )
                    }

                    return (
                      <label key={name} className="truong">
                        <span>{name}</span>
                        <input
                          type={laFieldTien(name) ? 'text' : kieuInput(schema, spec, name)}
                          value={giaTriInput(schema, spec, name, formValues[name])}
                          onChange={(event) => capNhatField(setFormValues, name, event.target.value)}
                          placeholder={placeholderInput(schema, spec, name, name)}
                        />
                        <small>{typeLabel(resolved)}</small>
                      </label>
                    )
                  })}
                </div>

                <div className="xem-truoc">
                  <div className="xem-truoc__dau">
                    <strong>Xem nhanh nội dung gửi</strong>
                    <span>Định dạng trực quan</span>
                  </div>
                  <XemDuLieu
                    data={{
                      ...formValues,
                      ...Object.fromEntries(
                        Object.entries(formFiles).map(([key, file]) => [key, file ? file.name : 'Chưa chọn tệp']),
                      ),
                    }}
                    emptyText=""
                  />
                </div>
              </>
            ) : (
              <div className="khung-du-lieu khung-du-lieu--trong">Không có dữ liệu gửi.</div>
            )}
          </section>
        ) : null}
      </div>

      <div className="cum-nut-endpoint">
        <button type="button" className="nut nut--chinh" disabled={dangGui} onClick={onSubmit}>
          {dangGui ? 'Đang gửi...' : 'Gửi yêu cầu'}
        </button>
        <button type="button" className="nut nut--phu" onClick={resetForm}>
          Làm mới biểu mẫu
        </button>
      </div>

      {!laManDanhSachPhong && !laManDanhSachHoaDon && (!laThePostDonGian || phanHoi !== null) ? (
        <div className={`thanh-trang-thai ${mauTrangThai}`}>{trangThai}</div>
      ) : null}

      {!laThePostDonGian || phanHoi !== null ? (
        <section className="khoi-con">
          <h4>Phản hồi</h4>
          <div className="xem-truoc">
            {laManDanhSachPhong ? (
              <XemDanhSachPhong data={phanHoi} />
            ) : laManDanhSachHoaDon ? (
              <XemDanhSachHoaDonCoNut data={phanHoi} onReload={() => { setReloadKey((k) => k + 1) }} />
            ) : moduleKey === 'contracts' && Array.isArray(phanHoi) && phanHoi.every(laDuLieuHopDong) ? (
              <XemDanhSachHopDong data={phanHoi} />
            ) : moduleKey === 'contracts' && laDuLieuHopDong(phanHoi) ? (
              <XemHopDong data={phanHoi} hienThiSoTienPhaiDong={laXemTruocKetThucHopDong} />
            ) : moduleKey === 'invoices' && Array.isArray(phanHoi) && phanHoi.every(laDuLieuHoaDon) ? (
              <XemDanhSachHoaDon data={phanHoi} />
            ) : moduleKey === 'invoices' && laDuLieuHoaDon(phanHoi) ? (
              <XemHoaDonChiTiet data={phanHoi} />
            ) : moduleKey === 'meterreadings' && Array.isArray(phanHoi) && phanHoi.every(laDuLieuChiSoDien) ? (
              <XemDanhSachChiSoDien data={phanHoi} />
            ) : moduleKey === 'meterreadings' && laDuLieuChiSoDien(phanHoi) ? (
              <XemChiSoDien data={phanHoi} />
            ) : moduleKey === 'rooms' && laDuLieuPhong(phanHoi) ? (
              <XemPhong data={phanHoi} />
            ) : moduleKey === 'tenants' && Array.isArray(phanHoi) && phanHoi.every(laDuLieuNguoiThue) ? (
              <XemDanhSachNguoiThue data={phanHoi} />
            ) : moduleKey === 'tenants' && laDuLieuNguoiThue(phanHoi) ? (
              <XemNguoiThue data={phanHoi} />
            ) : (
              <XemDuLieu data={phanHoi} emptyText="Chưa có phản hồi từ máy chủ." />
            )}
          </div>
        </section>
      ) : null}

      {laXemTruocKetThucHopDong && phanHoi !== null && mauTrangThai === 'thanh-cong' ? (
        <div style={{ marginTop: '16px' }}>
          {!hienXacNhan ? (
            <button
              type="button"
              className="nut"
              style={{ background: '#dc2626', color: '#fff', width: '100%' }}
              onClick={() => setHienXacNhan(true)}
              disabled={dangKetThuc}
            >
              Kết thúc hợp đồng
            </button>
          ) : (
            <div className="khung-du-lieu" style={{ background: '#fef2f2', border: '1px solid #dc2626', borderRadius: '8px', padding: '16px' }}>
              <p style={{ marginBottom: '12px', fontWeight: 600 }}>
                Bạn có chắc muốn kết thúc hợp đồng này?
              </p>
              {(() => {
                const refundedAmount = Number(phanHoi?.refundedAmount ?? phanHoi?.RefundedAmount ?? 0)
                const remainingAmount = Number(phanHoi?.remainingAmount ?? phanHoi?.RemainingAmount ?? 0)

                if (remainingAmount > 0) {
                  return (
                    <p style={{ marginBottom: '12px', color: '#b45309' }}>
                      Hệ thống sẽ tạo hóa đơn chốt để khách thanh toán thêm {dinhDangTien(remainingAmount)}.
                    </p>
                  )
                }

                if (refundedAmount > 0) {
                  return (
                    <p style={{ marginBottom: '12px', color: '#166534' }}>
                      Hệ thống sẽ không tạo hóa đơn chốt và sẽ ghi nhận hoàn lại khách {dinhDangTien(refundedAmount)} vào chi phí tháng.
                    </p>
                  )
                }

                return (
                  <p style={{ marginBottom: '12px', color: '#1d4ed8' }}>
                    Tiền cọc vừa đủ cấn trừ toàn bộ chi phí tháng chốt, khách không cần thanh toán thêm.
                  </p>
                )
              })()}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="nut"
                  style={{ background: '#dc2626', color: '#fff', flex: 1 }}
                  onClick={onKetThucHopDong}
                  disabled={dangKetThuc}
                >
                  {dangKetThuc ? 'Đang xử lý...' : 'Xác nhận kết thúc'}
                </button>
                <button
                  type="button"
                  className="nut nut--phu"
                  style={{ flex: 1 }}
                  onClick={() => setHienXacNhan(false)}
                  disabled={dangKetThuc}
                >
                  Huỷ
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </article>
  )

  return (
    <>
      <button type="button" className="the-endpoint-rut-gon" onClick={() => setDangMo(true)}>
        <span className={`method-tag method-tag--${method}`}>{method.toUpperCase()}</span>
        <strong>{tenEndpoint}</strong>
        {operation.summary && operation.summary !== tenEndpoint ? (
          <span className="the-endpoint-rut-gon__mo-ta">{operation.summary}</span>
        ) : null}
      </button>

      {dangMo ? (
        <div className="lop-phu-endpoint" onClick={() => setDangMo(false)}>
          <div className="hop-endpoint-mo" onClick={(event) => event.stopPropagation()}>
            {noiDungChiTiet}
          </div>
        </div>
      ) : null}
    </>
  )
}

function TrangModule({ module, spec }) {
  const endpoints = useMemo(() => {
    const apiEndpoints = Object.entries(spec?.paths || {})
      .filter(([path]) => path.startsWith(module.prefix))
      .flatMap(([path, pathItem]) =>
        METHOD_ORDER.filter((method) => pathItem[method]).map((method) => ({
          path,
          method,
          operation: pathItem[method],
        })),
      )
      .filter((item) => nenHienThiEndpoint(module.key, item.method, item.path))

    if (module.key === 'meterreadings') {
      const hasOriginalReadingPatch = apiEndpoints.some(
        (item) =>
          item.method.toLowerCase() === 'patch' &&
          item.path.toLowerCase() === '/api/meterreadings/current-reading',
      )

      if (!hasOriginalReadingPatch) {
        apiEndpoints.push(FALLBACK_METER_READING_UPDATE_ENDPOINT)
      }
    }

    return apiEndpoints.sort((a, b) => sapXepEndpoint(module.key, a, b))
  }, [module.prefix, module.key, spec])

  if (module.key === 'invoices') {
    return <InvoiceWorkspaceModern spec={spec} />
  }

  if (module.key === 'rooms') {
    return <RoomsWorkspace spec={spec} />
  }

  if (module.key === 'tenants') {
    return <TenantsWorkspace spec={spec} />
  }

  if (module.key === 'contracts') {
    return <ContractsWorkspace spec={spec} />
  }

  if (module.key === 'meterreadings') {
    return <MeterReadingWorkspace />
  }

  if (module.key === 'payments') {
    return <PaymentWorkspace />
  }

  if (module.key === 'transactions') {
    return <TransactionWorkspace />
  }

  if (module.key === 'reports') {
    return <ReportsWorkspace />
  }

  // Thêm MonthlyBulkCard vào cuối danh sách invoices

  return (
    <div className="khung-trang">
      <section className="danh-sach-endpoint">
        {endpoints.map((item) => (
          <EndpointCard
            key={`${item.method}-${item.path}`}
            method={item.method}
            moduleKey={module.key}
            operation={item.operation}
            path={item.path}
            spec={spec}
          />
        ))}
      </section>
    </div>
  )
}

function App() {
  const [trang] = useTrangHienTai()
  const [spec, setSpec] = useState(null)
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [menuDiDongMo, setMenuDiDongMo] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.build = BUILD_ID
  }, [])

  useEffect(() => {
    const chanCuonDoiGiaTriInputSo = (event) => {
      const target = event.target
      if (target instanceof HTMLInputElement && target.type === 'number' && document.activeElement === target) {
        target.blur()
      }
    }

    document.addEventListener('wheel', chanCuonDoiGiaTriInputSo, { capture: true })
    return () => document.removeEventListener('wheel', chanCuonDoiGiaTriInputSo, { capture: true })
  }, [])

  useEffect(() => {
    let conHieuLuc = true

    async function taiDuLieu() {
      try {
        setDangTai(true)
        setLoi('')
        const data = await taiSwagger()
        if (conHieuLuc) {
          setSpec(data)
        }
      } catch (error) {
        if (conHieuLuc) {
          setLoi(thongDiepLoi(error))
        }
      } finally {
        if (conHieuLuc) {
          setDangTai(false)
        }
      }
    }

    taiDuLieu()

    return () => {
      conHieuLuc = false
    }
  }, [])

  useEffect(() => {
    setMenuDiDongMo(false)
  }, [trang])

  const currentModule = MODULES.find((item) => item.key === trang) || MODULES[0]

  return (
    <div className="trang">
      <aside className="thanh-ben">
        <div className="thuong-hieu">
          <span className="thuong-hieu__ky-tu">NT</span>
          <div>
            <h1>Quản lý nhà trọ</h1>
          </div>
        </div>

        <nav className="dieu-huong">
          {MODULES.map((item) => (
            <a key={item.key} className={item.key === currentModule.key ? 'active' : ''} href={`#/${item.key}`}>
              {item.title}
            </a>
          ))}
        </nav>
      </aside>

      <main className="noi-dung">
        <div
          className={`menu-di-dong ${menuDiDongMo ? 'is-open' : ''}`}
          onMouseEnter={() => setMenuDiDongMo(true)}
          onMouseLeave={() => setMenuDiDongMo(false)}
        >
          <button
            type="button"
            className="menu-di-dong__nut"
            aria-label="Mở danh sách module"
            aria-expanded={menuDiDongMo}
            onClick={() => setMenuDiDongMo((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>

          <nav className="menu-di-dong__panel">
            {MODULES.map((item) => (
              <a key={item.key} className={item.key === currentModule.key ? 'active' : ''} href={`#/${item.key}`}>
                {item.title}
              </a>
            ))}
          </nav>
        </div>

        {dangTai ? (
          <section className="khung khung-trang">
            <p className="nhan">Đang tải</p>
            <h2>Đang đọc tài liệu Swagger để dựng giao diện theo từng controller</h2>
          </section>
        ) : loi ? (
          <section className="khung khung-trang">
            <p className="nhan">Có lỗi kết nối</p>
            <h2>Không thể lấy được tài liệu Swagger từ backend</h2>
            <p className="mo-ta-trang">
              Hãy bảo đảm backend đang chạy và endpoint <code>/swagger/v1/swagger.json</code> truy cập được trên cùng máy chủ này.
            </p>
            <div className="thong-bao-loi">{loi}</div>
          </section>
        ) : currentModule.key === 'tong-quan' ? (
          <TrangTongQuan />
        ) : (
          <TrangModule module={currentModule} spec={spec} />
        )}
      </main>
    </div>
  )
}

export default App


