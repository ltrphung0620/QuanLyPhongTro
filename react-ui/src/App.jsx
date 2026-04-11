import { useEffect, useMemo, useState } from 'react'
import './App.css'

const MODULES = [
  { key: 'tong-quan', title: 'Tổng quan', prefix: '' },
  { key: 'rooms', title: 'Phòng', prefix: '/api/Rooms' },
  { key: 'tenants', title: 'Người thuê', prefix: '/api/Tenants' },
  { key: 'contracts', title: 'Hợp đồng', prefix: '/api/Contracts' },
  { key: 'meterreadings', title: 'Chỉ số điện nước', prefix: '/api/MeterReadings' },
  { key: 'invoices', title: 'Hóa đơn', prefix: '/api/Invoices' },
  { key: 'payments', title: 'Thanh toán', prefix: '/api/Payments' },
  { key: 'transactions', title: 'Thu chi phát sinh', prefix: '/api/Transactions' },
  { key: 'reports', title: 'Báo cáo', prefix: '/api/Reports' },
]

const METHOD_ORDER = ['get', 'post', 'put', 'patch', 'delete']

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
      if (resolved.format === 'date') return taoThangMacDinh()
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

function normalizeValue(value, schema, spec) {
  const resolved = resolveSchema(schema, spec) || {}
  if (value === '' || value === null || value === undefined) return value

  if (resolved.type === 'integer') return Number.parseInt(value, 10)
  if (resolved.type === 'number') return Number.parseFloat(value)
  if (resolved.type === 'boolean') return value === true || value === 'true'
  return value
}

function kieuInput(schema, spec) {
  const resolved = resolveSchema(schema, spec) || {}

  if (resolved.format === 'date') return 'date'
  if (resolved.format === 'date-time') return 'datetime-local'
  if (resolved.type === 'number' || resolved.type === 'integer') return 'number'
  return 'text'
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

async function nenAnhOCR(file, { maxDimension = 1400, quality = 0.82 } = {}) {
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return file
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Không thể đọc tệp ảnh để tối ưu OCR.'))
      img.src = objectUrl
    })

    const width = image.width
    const height = image.height
    const scale = Math.min(1, maxDimension / Math.max(width, height))

    if (scale >= 0.999) {
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))

    const context = canvas.getContext('2d')
    if (!context) {
      return file
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality)
    })

    if (!blob) {
      return file
    }

    const baseName = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${baseName}-ocr.jpg`, { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
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
      discountamount: 'Giảm trừ',
      debtamount: 'Công nợ',
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
      defaultdebtamount: 'Công nợ mặc định',
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
    debtamount: 'Công nợ',
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
    'get /api/rooms': 0,
    'get /api/rooms/by-code/{roomcode}': 1,
  }

  const keyA = `${a.method.toLowerCase()} ${a.path.toLowerCase()}`
  const keyB = `${b.method.toLowerCase()} ${b.path.toLowerCase()}`
  const rankA = Object.prototype.hasOwnProperty.call(order, keyA) ? order[keyA] : 2
  const rankB = Object.prototype.hasOwnProperty.call(order, keyB) ? order[keyB] : 2

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
  ])

  return moneyFields.has(normalized)
}

function laFieldNgay(field = '') {
  const normalized = String(field || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return new Set(['fromdate', 'todate', 'paidat', 'createdat', 'updatedat', 'startdate', 'expectedenddate', 'actualenddate']).has(
    normalized,
  )
}

function laFieldThang(field = '') {
  const normalized = String(field || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return normalized === 'billingmonth'
}

function dinhDangNgay(value) {
  if (value === null || value === undefined || value === '') return 'Không có dữ liệu'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function dinhDangNgayGio(value) {
  if (value === null || value === undefined || value === '') return 'Không có dữ liệu'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function dinhDangThang(value) {
  if (value === null || value === undefined || value === '') return 'Không có dữ liệu'

  const textValue = String(value)
  const match = textValue.match(/^(\d{4})-(\d{2})/)
  if (!match) return textValue

  return `Tháng ${match[2]}/${match[1]}`
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
  const [dangXoa, setDangXoa] = useState({})
  const [dangLuuSua, setDangLuuSua] = useState({})
  const [modalHoaDon, setModalHoaDon] = useState(null)
  const [duLieuSua, setDuLieuSua] = useState({})

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

  const doiTrangThai = async (invoice, markPaid) => {
    const invoiceId = layInvoiceId(invoice)
    const currentStatus = String(invoice.status ?? invoice.Status ?? '').trim().toLowerCase()
    if (markPaid && currentStatus === 'paid') return
    if (!markPaid && currentStatus === 'unpaid') return

    setDangXuLy((prev) => ({ ...prev, [invoiceId]: true }))
    setThongBao((prev) => ({ ...prev, [invoiceId]: null }))

    try {
      const response = await fetch(`/api/Invoices/${invoiceId}/${markPaid ? 'mark-paid' : 'mark-unpaid'}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.message || `Loi ${response.status}`)
      }
      setThongBao((prev) => ({
        ...prev,
        [invoiceId]: { ok: true, text: markPaid ? 'Đã đánh dấu thanh toán' : 'Đã đánh dấu chưa thanh toán' },
      }))
      if (onReload) onReload()
    } catch (err) {
      setThongBao((prev) => ({ ...prev, [invoiceId]: { ok: false, text: err.message } }))
    } finally {
      setDangXuLy((prev) => ({ ...prev, [invoiceId]: false }))
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

  const luuChinhSua = async (invoiceId) => {
    const payload = duLieuSua[invoiceId]
    if (!payload) return

    setDangLuuSua((prev) => ({ ...prev, [invoiceId]: true }))
    setThongBao((prev) => ({ ...prev, [invoiceId]: null }))
    try {
      await guiRequest(`/api/Invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain' },
        body: JSON.stringify(payload),
      })
      setChiTietHoaDon((prev) => ({ ...prev, [invoiceId]: payload }))
      setThongBao((prev) => ({ ...prev, [invoiceId]: { ok: true, text: 'Cập nhật hóa đơn thành công' } }))
      setModalHoaDon({ id: invoiceId, mode: 'detail' })
      if (onReload) onReload()
    } catch (err) {
      setThongBao((prev) => ({ ...prev, [invoiceId]: { ok: false, text: err.message } }))
    } finally {
      setDangLuuSua((prev) => ({ ...prev, [invoiceId]: false }))
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
  const modalDangXoa = modalInvoiceId != null ? !!dangXoa[modalInvoiceId] : false
  const modalDangLuu = modalInvoiceId != null ? !!dangLuuSua[modalInvoiceId] : false
  const modalThongBao = modalInvoiceId != null ? thongBao[modalInvoiceId] : null
  const hiddenEditFields = new Set(['invoiceid', 'createdat', 'updatedat'])

  return (
    <>
      <div className="danh-sach-phong">
        {data.map((invoice, index) => {
          const invoiceId = layInvoiceId(invoice, index)
          const roomCode = invoice.roomCode ?? invoice.RoomCode
          const roomId = invoice.roomId ?? invoice.RoomId
          const billingMonth = invoice.billingMonth ?? invoice.BillingMonth
          const totalAmount = invoice.totalAmount ?? invoice.TotalAmount
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
                    disabled={isDeleting || Boolean(dangLuuSua[invoiceId])}
                    onClick={() => moModalSua(invoice)}
                  >
                    {Boolean(dangLuuSua[invoiceId]) ? 'Đang lưu...' : 'Sửa'}
                  </button>
                  <button
                    type="button"
                    className="nut invoice-inline-button invoice-action-button invoice-action-button--paid"
                    disabled={isLoading || isPaid || isDeleting}
                    onClick={() => doiTrangThai(invoice, true)}
                  >
                    Thanh toán
                  </button>
                  <button
                    type="button"
                    className="nut invoice-inline-button invoice-action-button invoice-action-button--unpaid"
                    disabled={isLoading || !isPaid || isDeleting}
                    onClick={() => doiTrangThai(invoice, false)}
                  >
                    Chưa thanh toán
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
                      .filter(([key, value]) => !hiddenEditFields.has(String(key).toLowerCase()) && typeof value !== 'object')
                      .map(([key, value]) => (
                        <label key={key} className="truong">
                          <span>{nhanTruong('invoices', '', key)}</span>
                          <input
                            type={typeof value === 'number' ? 'number' : 'text'}
                            value={value ?? ''}
                            onChange={(event) => {
                              const nextValue = typeof value === 'number' ? Number(event.target.value) : event.target.value
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
                <XemHoaDonChiTiet data={modalDetail} />
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
              <span>Loại hóa đơn</span>
              <strong>{giaTriDep(invoiceType, 'invoiceType')}</strong>
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

  const hiddenFields = new Set(['invoiceid'])
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
  const [trangThaiFilter, setTrangThaiFilter] = useState('all')
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

  const tongHopDong = contracts.length
  const hopDongConHieuLuc = contracts.filter((item) => String(item.status ?? item.Status ?? '').trim().toLowerCase() === 'active').length
  const hopDongHetHan = contracts.filter((item) => String(item.status ?? item.Status ?? '').trim().toLowerCase() === 'ended').length

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

      <section className="invoice-stats">
        <article className="invoice-stat-card">
          <span>Tổng hợp đồng</span>
          <strong>{tongHopDong}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Còn hiệu lực</span>
          <strong>{hopDongConHieuLuc}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Đã hết hạn</span>
          <strong>{hopDongHetHan}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Hiển thị</span>
          <strong>{`${danhSachLoc.length}/${contracts.length}`}</strong>
        </article>
      </section>

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

  const tongNguoiThue = tenants.length
  const coSoDienThoai = tenants.filter((tenant) => String(tenant.phone ?? tenant.Phone ?? '').trim()).length
  const coCccd = tenants.filter((tenant) => String(tenant.cccd ?? tenant.CCCD ?? '').trim()).length

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

      <section className="invoice-stats">
        <article className="invoice-stat-card">
          <span>Tổng số người thuê</span>
          <strong>{tongNguoiThue}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Có số điện thoại</span>
          <strong>{coSoDienThoai}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Có CCCD</span>
          <strong>{coCccd}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Hiển thị</span>
          <strong>{`${danhSachLoc.length}/${tenants.length}`}</strong>
        </article>
      </section>

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
    setHienXacNhan(false)
    try {
      const res = await fetch('/api/Invoices/monthly-bulk-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingMonth, defaultDiscountAmount: Number(defaultDiscountAmount), defaultDebtAmount: Number(defaultDebtAmount) }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.message || `Lỗi ${res.status}`)
      setPreviewData(Array.isArray(payload) ? payload : payload?.data ?? payload?.items ?? [])
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
        body: JSON.stringify({ billingMonth, defaultDiscountAmount: Number(defaultDiscountAmount), defaultDebtAmount: Number(defaultDebtAmount) }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.message || `Lỗi ${res.status}`)
      setTrangThai('Tạo hóa đơn hàng loạt thành công!')
      setMauTrangThai('thanh-cong')
      setPreviewData(null)
      if (onSuccess) onSuccess()
    } catch (err) {
      setTrangThai(err.message)
      setMauTrangThai('that-bai')
    } finally {
      setDangTao(false)
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
              <input type="date" value={billingMonth} onChange={(e) => setBillingMonth(e.target.value)} />
              <small>Ngày đầu tháng, ví dụ: 2026-04-01</small>
            </label>
            <label className="truong">
              <span>Giảm trừ mặc định</span>
              <input type="number" value={defaultDiscountAmount} onChange={(e) => setDefaultDiscountAmount(e.target.value)} min="0" />
              <small>Áp dụng cho tất cả hóa đơn trong tháng</small>
            </label>
            <label className="truong">
              <span>Công nợ mặc định</span>
              <input type="number" value={defaultDebtAmount} onChange={(e) => setDefaultDebtAmount(e.target.value)} min="0" />
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

  return (
    <div className="invoice-workspace">
      <section className="invoice-hero khung">
        <div className="invoice-hero__main">
          <p className="nhan">Hóa đơn</p>
          <h2>Quản lý hóa đơn đang có trong hệ thống</h2>
          <p className="mo-ta-trang">
            Danh sách được tải tự động khi mở trang. Bạn có thể tìm nhanh theo mã hóa đơn, phòng, tháng, người thuê hoặc trạng thái.
          </p>

          <div className="invoice-toolbar">
            <label className="invoice-search">
              <span>Tìm kiếm</span>
              <input
                type="text"
                value={tuKhoa}
                onChange={(event) => setTuKhoa(event.target.value)}
                placeholder="Ví dụ: P101, 2026-04, unpaid..."
              />
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
            {tuKhoa.trim() ? `Hiển thị ${danhSachLoc.length}/${tongHoaDon} hóa đơn` : `Hiển thị ${tongHoaDon} hóa đơn`}
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
            {tuKhoa.trim() ? 'Không có hóa đơn nào khớp với từ khóa tìm kiếm.' : 'Chưa có hóa đơn nào trong hệ thống.'}
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

function laySoDienChiSo(item) {
  return Number(item?.currentReading ?? item?.CurrentReading ?? 0)
}

function laySoTieuThuChiSo(item) {
  return Number(item?.consumedUnits ?? item?.ConsumedUnits ?? 0)
}

function layTienChiSo(item) {
  return Number(item?.amount ?? item?.Amount ?? 0)
}

function XemDanhSachChiSoDien({ data, onDelete = null, deletingId = null }) {
  if (!Array.isArray(data) || !data.length) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Không có chỉ số điện nào.</div>
  }

  return (
    <div className="danh-sach-phong invoice-cards">
      {data.map((item, index) => {
        const meterReadingId = item.meterReadingId ?? item.MeterReadingId ?? index
        const roomCode = item.roomCode ?? item.RoomCode
        const billingMonth = item.billingMonth ?? item.BillingMonth
        const currentReading = item.currentReading ?? item.CurrentReading
        const previousReading = item.previousReading ?? item.PreviousReading
        const consumedUnits = item.consumedUnits ?? item.ConsumedUnits
        const amount = item.amount ?? item.Amount

        return (
          <div key={meterReadingId} className="dong-phong invoice-card">
            <div className="invoice-card__info">
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Phòng</span>
                <strong>{roomCode || 'Không có dữ liệu'}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Tháng ghi số</span>
                <strong>{giaTriDep(billingMonth, 'billingMonth')}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Chỉ số cũ</span>
                <strong>{giaTriDep(previousReading, 'previousReading')}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Chỉ số mới</span>
                <strong>{giaTriDep(currentReading, 'currentReading')}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Số điện tiêu thụ</span>
                <strong>{giaTriDep(consumedUnits, 'consumedUnits')}</strong>
              </div>
              <div className="dong-phong__o invoice-card__amount">
                <span>Thành tiền</span>
                <strong className="invoice-amount">{giaTriDep(amount, 'amount')}</strong>
              </div>
            </div>
            {onDelete ? (
              <div className="invoice-card__actions meter-card__actions">
                <button
                  type="button"
                  className="nut nut--phu meter-card__delete"
                  onClick={() => onDelete(meterReadingId, roomCode)}
                  disabled={deletingId === meterReadingId}
                >
                  {deletingId === meterReadingId ? 'Đang xóa...' : 'Xóa'}
                </button>
              </div>
            ) : null}
          </div>
        )
      })}
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

function dinhDangTrangThaiGiaoDichThanhToan(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (!normalized) return 'Chưa xử lý'
  if (normalized === 'pending') return 'Chờ xử lý'
  if (normalized === 'processed') return 'Đã xử lý'
  if (normalized === 'reconciled') return 'Đã đối soát'
  if (normalized === 'matched') return 'Đã khớp hóa đơn'
  if (normalized === 'ignored') return 'Bỏ qua'
  if (normalized === 'failed') return 'Thất bại'
  return value || 'Không có dữ liệu'
}

function laySoTienGiaoDichThanhToan(item) {
  return Number(item?.transferAmount ?? item?.TransferAmount ?? 0)
}

function XemDanhSachGiaoDichThanhToan({ data }) {
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
        const matchedInvoiceId = item.matchedInvoiceId ?? item.MatchedInvoiceId
        const content = item.content ?? item.Content
        const processStatus = item.processStatus ?? item.ProcessStatus
        const statusClass = layTrangThaiGiaoDichThanhToan(item)

        return (
          <div key={paymentTransactionId} className="dong-phong invoice-card">
            <div className="invoice-card__info">
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Mã giao dịch</span>
                <strong>#{paymentTransactionId}</strong>
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
                <span>Hóa đơn đã khớp</span>
                <strong>{matchedInvoiceId ? `#${matchedInvoiceId}` : 'Chưa đối soát'}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Nội dung chuyển khoản</span>
                <strong>{content || 'Không có dữ liệu'}</strong>
              </div>
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
  const [billingMonth, setBillingMonth] = useState(taoThangMacDinh())
  const [bulkReadings, setBulkReadings] = useState({})
  const [bulkImageFiles, setBulkImageFiles] = useState({})
  const [bulkImageResults, setBulkImageResults] = useState({})
  const [dangDocAnhTungDong, setDangDocAnhTungDong] = useState({})
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
    let active = true

    async function taiPhongDangActive() {
      setRoomOptionsLoading(true)
      try {
        const result = await guiRequest('/api/Contracts?status=active', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })

        const payload = result.payload
        const contracts = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.items)
              ? payload.items
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
      } catch (error) {
        if (!active) return
        setTrangThai(thongDiepLoi(error))
        setMauTrangThai('that-bai')
        setRoomOptions([])
      } finally {
        if (active) setRoomOptionsLoading(false)
      }
    }

    taiPhongDangActive()
    return () => {
      active = false
    }
  }, [])

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
    setBulkImageResults((current) => ({
      ...current,
      [rowKey]: null,
    }))
  }

  const docChiSoTuAnhTheoDong = async (option) => {
    const rowKey = `${option.roomId}-${option.contractId}`
    const imageFile = bulkImageFiles[rowKey]

    if (!imageFile) {
      setTrangThai(`Vui lòng chọn ảnh công tơ cho phòng ${option.value}.`)
      setMauTrangThai('that-bai')
      return
    }

    setDangDocAnhTungDong((current) => ({ ...current, [rowKey]: true }))
    resetMessages()

    try {
      const optimizedImageFile = await nenAnhOCR(imageFile)
      const formData = new FormData()
      formData.append('image', optimizedImageFile)

      const result = await guiRequest('/api/MeterReadings/read-from-image', {
        method: 'POST',
        body: formData,
      })

      const payload = result.payload || {}
      const detectedReading = payload.detectedReading ?? payload.DetectedReading

      if (detectedReading === null || detectedReading === undefined || Number.isNaN(Number(detectedReading))) {
        throw new Error('Không đọc được chỉ số điện từ hình ảnh.')
      }

      setBulkReadings((current) => ({
        ...current,
        [rowKey]: String(detectedReading),
      }))
      setBulkImageResults((current) => ({
        ...current,
        [rowKey]: payload,
      }))
      const processingMode = payload.processingMode ?? payload.ProcessingMode
      const elapsedMs = payload.elapsedMs ?? payload.ElapsedMs
      const elapsedLabel = elapsedMs != null ? ` sau ${Math.max(1, Math.round(Number(elapsedMs) / 1000))} giây` : ''
      const modeLabel = processingMode ? ` (${processingMode})` : ''
      setTrangThai(`Đã đọc được chỉ số ${detectedReading} cho phòng ${option.value}${modeLabel}${elapsedLabel}.`)
      setMauTrangThai('thanh-cong')
    } catch (error) {
      setBulkImageResults((current) => ({
        ...current,
        [rowKey]: {
          errorMessage: thongDiepLoi(error),
        },
      }))
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
    } finally {
      setDangDocAnhTungDong((current) => ({ ...current, [rowKey]: false }))
    }
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
      await guiRequest('/api/MeterReadings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: Number(option.roomId),
          contractId: Number(option.contractId),
          billingMonth,
          currentReading: Number(readingValue),
        }),
      })

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
        await guiRequest('/api/MeterReadings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: Number(item.option.roomId),
            contractId: Number(item.option.contractId),
            billingMonth,
            currentReading: Number(item.readingValue),
          }),
        })
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
                  <input type="date" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
                </label>
              </div>

              <div className="meter-bulk-table-wrap">
                <table className="meter-bulk-table meter-bulk-table--images">
                  <thead>
                    <tr>
                      <th>Phòng</th>
                      <th>Người thuê</th>
                      <th>Ảnh chỉ số</th>
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
                        const tenantLabel = option.label.includes(' - ') ? option.label.split(' - ').slice(1).join(' - ') : 'Không có dữ liệu'
                        const imageResult = bulkImageResults[rowKey]
                        const detectedReading = imageResult?.detectedReading ?? imageResult?.DetectedReading
                        const rawText = imageResult?.rawText ?? imageResult?.RawText
                        const processingMode = imageResult?.processingMode ?? imageResult?.ProcessingMode
                        const elapsedMs = imageResult?.elapsedMs ?? imageResult?.ElapsedMs
                        const rowError = imageResult?.errorMessage ?? imageResult?.ErrorMessage
                        const selectedFile = bulkImageFiles[rowKey]
                        return (
                          <tr key={rowKey}>
                            <td>{option.value}</td>
                            <td>{tenantLabel || 'Không có dữ liệu'}</td>
                            <td>
                              <div className="meter-bulk-table__image-cell">
                                <input type="file" accept="image/*" onChange={(event) => capNhatAnhDong(rowKey, event.target.files?.[0] || null)} />
                                <small>{selectedFile ? selectedFile.name : 'Chưa chọn ảnh công tơ'}</small>
                                <div className="meter-bulk-table__image-actions">
                                  <button
                                    type="button"
                                    className="nut nut--phu meter-bulk-table__read"
                                    onClick={() => docChiSoTuAnhTheoDong(option)}
                                    disabled={!bulkImageFiles[rowKey] || !!dangDocAnhTungDong[rowKey] || dangLuuTatCa}
                                  >
                                    {dangDocAnhTungDong[rowKey] ? 'Đang đọc...' : 'Đọc ảnh'}
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="meter-bulk-table__reading-cell">
                                <input
                                  type="number"
                                  min="0"
                                  value={bulkReadings[rowKey] ?? ''}
                                  onChange={(event) => capNhatChiSoDong(rowKey, event.target.value)}
                                  placeholder="Nhập hoặc đọc từ ảnh"
                                />
                                <small>{detectedReading != null ? `AI đọc: ${detectedReading}` : 'Chưa có số từ ảnh'}</small>
                                {rawText ? <small className="meter-bulk-table__ocr-raw">Raw text: {rawText}</small> : null}
                                {processingMode ? <small className="meter-bulk-table__ocr-raw">Mode: {processingMode}</small> : null}
                                {elapsedMs != null ? <small className="meter-bulk-table__ocr-raw">Thời gian: {Math.max(1, Math.round(Number(elapsedMs) / 1000))} giây</small> : null}
                                {rowError ? <small className="meter-bulk-table__ocr-error">{rowError}</small> : null}
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

function RoomsWorkspace() {
  const [rooms, setRooms] = useState([])
  const [phongFilter, setPhongFilter] = useState('')
  const [trangThaiFilter, setTrangThaiFilter] = useState('all')
  const [dangTai, setDangTai] = useState(false)
  const [loi, setLoi] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

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

function MeterReadingMissingButton() {
  const [dangMo, setDangMo] = useState(false)
  const [billingMonth, setBillingMonth] = useState(taoThangMacDinh())
  const [dangTaiMissing, setDangTaiMissing] = useState(false)
  const [missingRooms, setMissingRooms] = useState([])
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

  const taiPhongThieuChiSo = async () => {
    setDangTaiMissing(true)
    setTrangThai('')
    setMauTrangThai('')
    try {
      const result = await guiRequest(`/api/MeterReadings/missing?month=${encodeURIComponent(billingMonth)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const payload = result.payload
      const nextMissing = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.items)
            ? payload.items
            : []
      setMissingRooms(nextMissing)
      setTrangThai(`Đã kiểm tra phòng thiếu chỉ số cho ${dinhDangThang(billingMonth)}.`)
      setMauTrangThai('thanh-cong')
    } catch (error) {
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
      setMissingRooms([])
    } finally {
      setDangTaiMissing(false)
    }
  }

  return (
    <>
      <button type="button" className="nut nut--phu meter-toolbar-button meter-toolbar-button--missing" onClick={() => setDangMo(true)}>
        Xem phòng thiếu chỉ số
      </button>

      {dangMo ? (
        <div className="lop-phu-endpoint" onClick={() => setDangMo(false)}>
          <div className="hop-endpoint-mo" onClick={(event) => event.stopPropagation()}>
            <article className="the-endpoint the-endpoint--mo invoice-modal-card">
              <div className="the-endpoint__dau">
                <div>
                  <span className="method-tag method-tag--get">GET</span>
                  <h3>Phòng thiếu chỉ số</h3>
                </div>
                <button type="button" className="nut-dong-endpoint" onClick={() => setDangMo(false)}>
                  ×
                </button>
              </div>

              <div className="invoice-edit-form meter-capture-form">
                <label className="truong">
                  <span>Tháng kiểm tra</span>
                  <input type="date" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
                </label>
              </div>

              {trangThai ? <div className={`thanh-trang-thai ${mauTrangThai}`}>{trangThai}</div> : null}

              <div className="invoice-modal-actions">
                <button type="button" className="nut" onClick={taiPhongThieuChiSo} disabled={dangTaiMissing}>
                  {dangTaiMissing ? 'Đang kiểm tra...' : 'Kiểm tra'}
                </button>
              </div>

              {missingRooms.length ? (
                <div className="meter-missing-list">
                  <div className="chip-wrap">
                    {missingRooms.map((room, index) => (
                      <span key={`${room.roomId ?? room.RoomId ?? index}`} className="chip">
                        {room.roomCode ?? room.RoomCode ?? `Phòng #${room.roomId ?? room.RoomId ?? index}`}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          </div>
        </div>
      ) : null}
    </>
  )
}

function MeterReadingOriginalEditButton() {
  const [dangMo, setDangMo] = useState(false)
  const [billingMonth, setBillingMonth] = useState(taoThangMacDinh())
  const [roomCode, setRoomCode] = useState('')
  const [currentReading, setCurrentReading] = useState('')
  const [meterReadingsInMonth, setMeterReadingsInMonth] = useState([])
  const [selectedMeterReadingId, setSelectedMeterReadingId] = useState('')
  const [dangTaiDanhSach, setDangTaiDanhSach] = useState(false)
  const [dangSua, setDangSua] = useState(false)
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

  const taiDanhSachMocChiSo = async () => {
    if (!roomCode.trim()) {
      setTrangThai('Vui lòng nhập mã phòng trước khi tải các mốc chỉ số.')
      setMauTrangThai('that-bai')
      setMeterReadingsInMonth([])
      setSelectedMeterReadingId('')
      return
    }

    setDangTaiDanhSach(true)
    setTrangThai('')
    setMauTrangThai('')

    try {
      const result = await guiRequest(`/api/MeterReadings?month=${encodeURIComponent(billingMonth)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })

      const payload = Array.isArray(result.payload)
        ? result.payload
        : Array.isArray(result.payload?.data)
          ? result.payload.data
          : []

      const normalizedRoomCode = roomCode.trim().toLowerCase()
      const matched = payload
        .filter((item) => String(item.roomCode ?? item.RoomCode ?? '').trim().toLowerCase() === normalizedRoomCode)
        .sort((a, b) => new Date(a.billingMonth ?? a.BillingMonth).getTime() - new Date(b.billingMonth ?? b.BillingMonth).getTime())

      setMeterReadingsInMonth(matched)

      if (matched.length) {
        const latest = matched[matched.length - 1]
        const meterReadingId = latest.meterReadingId ?? latest.MeterReadingId ?? ''
        const nextCurrentReading = latest.currentReading ?? latest.CurrentReading ?? ''
        setSelectedMeterReadingId(String(meterReadingId))
        setCurrentReading(String(nextCurrentReading))
        setTrangThai(`Đã tải ${matched.length} mốc chỉ số của phòng ${roomCode.trim()} trong ${dinhDangThang(billingMonth)}.`)
        setMauTrangThai('thanh-cong')
      } else {
        setSelectedMeterReadingId('')
        setCurrentReading('')
        setTrangThai(`Không tìm thấy mốc chỉ số nào của phòng ${roomCode.trim()} trong ${dinhDangThang(billingMonth)}.`)
        setMauTrangThai('that-bai')
      }
    } catch (error) {
      setMeterReadingsInMonth([])
      setSelectedMeterReadingId('')
      setCurrentReading('')
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
    } finally {
      setDangTaiDanhSach(false)
    }
  }

  const capNhatMocDuocChon = (value) => {
    setSelectedMeterReadingId(value)
    const selected = meterReadingsInMonth.find((item) => String(item.meterReadingId ?? item.MeterReadingId ?? '') === String(value))
    if (selected) {
      setCurrentReading(String(selected.currentReading ?? selected.CurrentReading ?? ''))
    }
  }

  const suaChiSoGoc = async () => {
    setDangSua(true)
    setTrangThai('')
    setMauTrangThai('')
    try {
      await guiRequest('/api/MeterReadings/current-reading', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meterReadingId: selectedMeterReadingId ? Number(selectedMeterReadingId) : undefined,
          roomCode,
          billingMonth,
          currentReading: Number(currentReading),
        }),
      })
      setTrangThai('Đã cập nhật chỉ số điện gốc thành công.')
      setMauTrangThai('thanh-cong')
    } catch (error) {
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
    } finally {
      setDangSua(false)
    }
  }

  return (
    <>
      <button type="button" className="nut nut--phu meter-toolbar-button meter-toolbar-button--edit" onClick={() => setDangMo(true)}>
        Sửa chỉ số gốc
      </button>

      {dangMo ? (
        <div className="lop-phu-endpoint" onClick={() => setDangMo(false)}>
          <div className="hop-endpoint-mo" onClick={(event) => event.stopPropagation()}>
            <article className="the-endpoint the-endpoint--mo invoice-modal-card">
              <div className="the-endpoint__dau">
                <div>
                  <span className="method-tag method-tag--patch">PATCH</span>
                  <h3>Sửa chỉ số gốc</h3>
                </div>
                <button type="button" className="nut-dong-endpoint" onClick={() => setDangMo(false)}>
                  ×
                </button>
              </div>

              <div className="invoice-edit-form meter-capture-form meter-original-edit-form">
                <label className="truong">
                  <span>Tháng cần sửa</span>
                  <input type="date" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
                </label>
                <label className="truong">
                  <span>Mã phòng</span>
                  <input type="text" value={roomCode} onChange={(event) => setRoomCode(event.target.value)} placeholder="Ví dụ: A01" />
                </label>
                <div className="invoice-modal-actions meter-original-edit__load">
                  <button type="button" className="nut nut--phu" onClick={taiDanhSachMocChiSo} disabled={dangTaiDanhSach || !roomCode.trim()}>
                    {dangTaiDanhSach ? 'Đang tải mốc chỉ số...' : 'Tải các mốc chỉ số'}
                  </button>
                </div>
                <label className="truong">
                  <span>Mốc chỉ số cần sửa</span>
                  <select value={selectedMeterReadingId} onChange={(event) => capNhatMocDuocChon(event.target.value)} disabled={!meterReadingsInMonth.length}>
                    <option value="">{meterReadingsInMonth.length ? 'Chọn một mốc chỉ số' : 'Chưa có mốc chỉ số trong tháng'}</option>
                    {meterReadingsInMonth.map((item) => {
                      const meterReadingId = item.meterReadingId ?? item.MeterReadingId
                      const readingDate = item.billingMonth ?? item.BillingMonth
                      const previousReading = item.previousReading ?? item.PreviousReading
                      const currentReadingValue = item.currentReading ?? item.CurrentReading
                      const contractId = item.contractId ?? item.ContractId
                      return (
                        <option key={meterReadingId} value={meterReadingId}>
                          {`${giaTriDep(readingDate, 'billingMonth')} | HĐ #${contractId} | ${previousReading} -> ${currentReadingValue}`}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <label className="truong">
                  <span>Chỉ số điện mới</span>
                  <input type="number" min="0" value={currentReading} onChange={(event) => setCurrentReading(event.target.value)} placeholder="Ví dụ: 1530" />
                </label>
              </div>

              {trangThai ? <div className={`thanh-trang-thai ${mauTrangThai}`}>{trangThai}</div> : null}

              <div className="invoice-modal-actions">
                <button type="button" className="nut" onClick={suaChiSoGoc} disabled={dangSua || !roomCode || !selectedMeterReadingId || currentReading === ''}>
                  {dangSua ? 'Đang cập nhật...' : 'Cập nhật'}
                </button>
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </>
  )
}

function MeterReadingWorkspace() {
  const [meterReadings, setMeterReadings] = useState([])
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [dangXoaId, setDangXoaId] = useState(null)
  const [xacNhanXoa, setXacNhanXoa] = useState(null)
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

  const tongBanGhi = danhSachLoc.length
  const tongSoDien = danhSachLoc.reduce((tong, item) => tong + laySoTieuThuChiSo(item), 0)
  const tongTienDien = danhSachLoc.reduce((tong, item) => tong + layTienChiSo(item), 0)
  const chiSoMoiCaoNhat = danhSachLoc.reduce((max, item) => Math.max(max, laySoDienChiSo(item)), 0)

  const thucHienXoaChiSo = async (meterReadingId) => {
    setDangXoaId(meterReadingId)
    setLoi('')

    try {
      await guiRequest(`/api/MeterReadings/${meterReadingId}`, {
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

  const xoaChiSo = (meterReadingId, roomCode) => {
    setXacNhanXoa({
      meterReadingId,
      roomCode: roomCode || 'này',
    })
  }

  return (
    <div className="invoice-workspace meter-workspace">
      <section className="invoice-hero khung">
        <div className="invoice-hero__main">
          <div className="invoice-toolbar">
            <label className="invoice-search">
              <span>Phòng</span>
              <input type="text" value={phongFilter} onChange={(event) => setPhongFilter(event.target.value)} placeholder="Nhập mã phòng" />
            </label>
            <label className="invoice-search invoice-search--month">
              <span>Tháng - năm</span>
              <input type="month" value={thangNamFilter} onChange={(event) => setThangNamFilter(event.target.value)} />
            </label>
            <button
              type="button"
              className="nut nut--phu meter-toolbar-inline-button"
              onClick={() => setReloadKey((value) => value + 1)}
              disabled={dangTai}
            >
              {dangTai ? 'Đang tải...' : 'Làm mới danh sách'}
            </button>
          </div>

          <div className="meter-toolbar-actions">
            <div className="meter-toolbar-group">
              <MeterReadingCreateButton onSuccess={() => setReloadKey((value) => value + 1)} />
              <MeterReadingMissingButton />
              <MeterReadingOriginalEditButton />
            </div>
          </div>
        </div>
      </section>

      <section className="invoice-stats invoice-stats--five">
        <article className="invoice-stat-card">
          <span>Tổng bản ghi</span>
          <strong>{tongBanGhi}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Tổng số điện tiêu thụ</span>
          <strong>{giaTriDep(tongSoDien, 'consumedUnits')}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Tổng tiền điện</span>
          <strong className="invoice-amount">{dinhDangTien(tongTienDien).replace(/\s*VND$/, '')}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Chỉ số mới cao nhất</span>
          <strong>{giaTriDep(chiSoMoiCaoNhat, 'currentReading')}</strong>
        </article>
        <article className="invoice-stat-card">
          <span>Đang hiển thị</span>
          <strong>{`${danhSachLoc.length}/${meterReadings.length}`}</strong>
        </article>
      </section>

      <section className="khung">
        <div className="xem-truoc__dau">
          <strong>Danh sách chỉ số điện</strong>
          <span>{`Hiển thị ${danhSachLoc.length}/${meterReadings.length} bản ghi`}</span>
        </div>
        {loi ? <div className="thong-bao-loi">{loi}</div> : null}
        {dangTai ? (
          <div className="khung-du-lieu khung-du-lieu--trong">Đang tải danh sách chỉ số điện...</div>
        ) : danhSachLoc.length ? (
          <div className="invoice-list-wrap">
            <XemDanhSachChiSoDien data={danhSachLoc} onDelete={xoaChiSo} deletingId={dangXoaId} />
          </div>
        ) : (
          <div className="khung-du-lieu khung-du-lieu--trong">
            {phongFilter.trim() || thangNamFilter ? 'Không có bản ghi chỉ số nào khớp với bộ lọc hiện tại.' : 'Chưa có chỉ số điện nào trong hệ thống.'}
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
                  <h3>Xóa bản ghi chỉ số điện</h3>
                </div>
                <button type="button" className="nut-dong-endpoint" onClick={() => setXacNhanXoa(null)} disabled={!!dangXoaId}>
                  ×
                </button>
              </div>

              <p>Bạn có chắc muốn xóa bản ghi chỉ số điện của phòng <strong>{xacNhanXoa.roomCode}</strong> không?</p>

              <div className="invoice-modal-actions">
                <button type="button" className="nut nut--phu" onClick={() => setXacNhanXoa(null)} disabled={!!dangXoaId}>
                  Hủy
                </button>
                <button type="button" className="nut" onClick={() => thucHienXoaChiSo(xacNhanXoa.meterReadingId)} disabled={!!dangXoaId}>
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

function PaymentWorkspace() {
  const [transactions, setTransactions] = useState([])
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [tuKhoaFilter, setTuKhoaFilter] = useState('')
  const [trangThaiFilter, setTrangThaiFilter] = useState('all')
  const [reloadKey, setReloadKey] = useState(0)

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
  }, [reloadKey, trangThaiFilter])

  const danhSachLoc = useMemo(() => {
    const keyword = String(tuKhoaFilter || '').trim().toLowerCase()
    if (!keyword) return transactions

    return transactions.filter((item) => {
      const targets = [
        item.paymentTransactionId ?? item.PaymentTransactionId,
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
  }, [transactions, tuKhoaFilter])

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
                <option value="pending">Chờ xử lý</option>
                <option value="processed">Đã xử lý</option>
                <option value="reconciled">Đã đối soát</option>
                <option value="matched">Đã khớp hóa đơn</option>
                <option value="ignored">Bỏ qua</option>
                <option value="failed">Thất bại</option>
              </select>
            </label>
            <button type="button" className="nut nut--phu payment-toolbar-refresh" onClick={() => setReloadKey((value) => value + 1)} disabled={dangTai}>
              {dangTai ? 'Đang tải...' : 'Làm mới danh sách'}
            </button>
          </div>
          <div className="invoice-toolbar__actions payment-toolbar__actions">
            <PaymentReconcileButton transactions={danhSachLoc} onSuccess={() => setReloadKey((value) => value + 1)} />
          </div>
        </div>
      </section>

      <section className="khung">
        <div className="xem-truoc__dau">
          <strong>Danh sách giao dịch thanh toán</strong>
          <span>
            {tuKhoaFilter.trim() || trangThaiFilter !== 'all'
              ? `Hiển thị ${danhSachLoc.length}/${transactions.length} giao dịch`
              : `Hiển thị ${transactions.length} giao dịch`}
          </span>
        </div>
        {loi ? <div className="thong-bao-loi">{loi}</div> : null}
        {dangTai ? (
          <div className="khung-du-lieu khung-du-lieu--trong">Đang tải danh sách giao dịch thanh toán...</div>
        ) : danhSachLoc.length ? (
          <div className="invoice-list-wrap">
            <XemDanhSachGiaoDichThanhToan data={danhSachLoc} />
          </div>
        ) : (
          <div className="khung-du-lieu khung-du-lieu--trong">
            {tuKhoaFilter.trim() || trangThaiFilter !== 'all'
              ? 'Không có giao dịch nào khớp với bộ lọc hiện tại.'
              : 'Chưa có giao dịch thanh toán nào trong hệ thống.'}
          </div>
        )}
      </section>
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
  const [itemName, setItemName] = useState('')
  const [amount, setAmount] = useState('')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [relatedInvoiceId, setRelatedInvoiceId] = useState('')
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
          itemName: itemName.trim() || null,
          amount: Number(amount),
          transactionDate,
          description: description.trim() || null,
          relatedInvoiceId: relatedInvoiceId ? Number(relatedInvoiceId) : null,
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
                  <span>Tên khoản mục</span>
                  <input type="text" value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="Ví dụ: Thu tiền phòng A01" />
                </label>
                <label className="truong">
                  <span>Số tiền</span>
                  <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Nhập số tiền" />
                </label>
                <label className="truong">
                  <span>Ngày giao dịch</span>
                  <input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} />
                </label>
                <label className="truong">
                  <span>InvoiceId liên quan</span>
                  <input type="number" min="1" value={relatedInvoiceId} onChange={(event) => setRelatedInvoiceId(event.target.value)} placeholder="Có thể để trống" />
                </label>
                <label className="truong transaction-form__full">
                  <span>Mô tả</span>
                  <input type="text" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ghi chú thêm cho giao dịch" />
                </label>
              </div>

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
  const [itemName, setItemName] = useState(transaction?.itemName ?? transaction?.ItemName ?? '')
  const [amount, setAmount] = useState(String(transaction?.amount ?? transaction?.Amount ?? ''))
  const [transactionDate, setTransactionDate] = useState(String(transaction?.transactionDate ?? transaction?.TransactionDate ?? ''))
  const [description, setDescription] = useState(transaction?.description ?? transaction?.Description ?? '')
  const [relatedInvoiceId, setRelatedInvoiceId] = useState(String(transaction?.relatedInvoiceId ?? transaction?.RelatedInvoiceId ?? ''))
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
          itemName: String(itemName || '').trim() || null,
          amount: Number(amount),
          transactionDate,
          description: String(description || '').trim() || null,
          relatedInvoiceId: relatedInvoiceId ? Number(relatedInvoiceId) : null,
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
                  <span>Tên khoản mục</span>
                  <input type="text" value={itemName} onChange={(event) => setItemName(event.target.value)} />
                </label>
                <label className="truong">
                  <span>Số tiền</span>
                  <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </label>
                <label className="truong">
                  <span>Ngày giao dịch</span>
                  <input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} />
                </label>
                <label className="truong">
                  <span>InvoiceId liên quan</span>
                  <input type="number" min="1" value={relatedInvoiceId} onChange={(event) => setRelatedInvoiceId(event.target.value)} />
                </label>
                <label className="truong transaction-form__full">
                  <span>Mô tả</span>
                  <input type="text" value={description} onChange={(event) => setDescription(event.target.value)} />
                </label>
              </div>

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
        const itemName = item.itemName ?? item.ItemName
        const transactionDate = item.transactionDate ?? item.TransactionDate
        const description = item.description ?? item.Description
        const relatedInvoiceId = item.relatedInvoiceId ?? item.RelatedInvoiceId
        const createdAt = item.createdAt ?? item.CreatedAt
        const typeClass = layLoaiThuChi(item)

        return (
          <div key={transactionId} className="dong-phong invoice-card">
            <div className="invoice-card__info">
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Mã giao dịch</span>
                <strong>#{transactionId}</strong>
              </div>
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
                <span>Khoản mục</span>
                <strong>{itemName || 'Không có dữ liệu'}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>Ngày giao dịch</span>
                <strong>{giaTriDep(transactionDate, 'transactionDate')}</strong>
              </div>
              <div className="dong-phong__o invoice-card__meta-item">
                <span>InvoiceId liên quan</span>
                <strong>{relatedInvoiceId ? `#${relatedInvoiceId}` : 'Không có dữ liệu'}</strong>
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
  }, [reloadKey, thangNamFilter, loaiFilter])

  const danhSachLoc = useMemo(() => {
    const keyword = String(tuKhoaFilter || '').trim().toLowerCase()
    if (!keyword) return transactions

    return transactions.filter((item) => {
      const targets = [
        item.transactionId ?? item.TransactionId,
        item.itemName ?? item.ItemName,
        item.description ?? item.Description,
        item.category ?? item.Category,
        item.relatedInvoiceId ?? item.RelatedInvoiceId,
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
                placeholder="Khoản mục, mô tả, invoice..."
              />
            </label>
            <label className="invoice-search invoice-search--month">
              <span>Tháng - năm</span>
              <input type="month" value={thangNamFilter} onChange={(event) => setThangNamFilter(event.target.value)} />
            </label>
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
  const [thangKetThuc, setThangKetThuc] = useState(taoThangMacDinh().slice(0, 7))
  const [thangBaoCao, setThangBaoCao] = useState(taoThangMacDinh().slice(0, 7))
  const [dangTai, setDangTai] = useState(true)
  const [dangTaiBaoCaoThang, setDangTaiBaoCaoThang] = useState(true)
  const [loi, setLoi] = useState('')
  const [loiBaoCaoThang, setLoiBaoCaoThang] = useState('')
  const [reportData, setReportData] = useState([])
  const [baoCaoThang, setBaoCaoThang] = useState(null)
  const [chiTietBaoCao, setChiTietBaoCao] = useState(null)
  const [dangTaiChiTietBaoCao, setDangTaiChiTietBaoCao] = useState(false)
  const [loiChiTietBaoCao, setLoiChiTietBaoCao] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    async function taiBaoCao() {
      setDangTai(true)
      setLoi('')

      try {
        const months = taoDanhSachThangGanNhat(thangKetThuc, 6)
        const results = await Promise.all(
          months.map(async (monthKey) => {
            const monthParam = `${monthKey}-01`
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

            return {
              monthKey,
              paidInvoicesRevenue: layGiaTriSo(revenuePayload.paidInvoicesRevenue ?? revenuePayload.PaidInvoicesRevenue),
              extraIncome: layGiaTriSo(revenuePayload.extraIncome ?? revenuePayload.ExtraIncome),
              totalRevenue: layGiaTriSo(profitPayload.totalRevenue ?? profitPayload.TotalRevenue ?? revenuePayload.totalRevenue ?? revenuePayload.TotalRevenue),
              totalExpense: layGiaTriSo(profitPayload.totalExpense ?? profitPayload.TotalExpense ?? expensePayload.totalExpense ?? expensePayload.TotalExpense),
              profitLoss: layGiaTriSo(profitPayload.profitLoss ?? profitPayload.ProfitLoss),
            }
          }),
        )

        if (active) setReportData(results)
      } catch (error) {
        if (active) {
          setLoi(thongDiepLoi(error))
          setReportData([])
        }
      } finally {
        if (active) setDangTai(false)
      }
    }

    taiBaoCao()
    return () => {
      active = false
    }
  }, [thangKetThuc, reloadKey])

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
  }, [thangBaoCao, reloadKey])

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

  const duLieuHienTai = reportData[reportData.length - 1] || null
  const tongDoanhThu = reportData.reduce((tong, item) => tong + layGiaTriSo(item.totalRevenue), 0)
  const tongChiPhi = reportData.reduce((tong, item) => tong + layGiaTriSo(item.totalExpense), 0)
  const tongLoiNhuan = reportData.reduce((tong, item) => tong + layGiaTriSo(item.profitLoss), 0)

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
          const status = String(invoice.status ?? invoice.Status ?? '').trim().toLowerCase()
          return monthValue === thangBaoCao && status === 'paid'
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
            const category = String(item.category ?? item.Category ?? '').trim().toLowerCase()
            return category !== 'invoice'
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
          <label className="invoice-search invoice-search--month">
            <span>Tháng xem báo cáo</span>
            <input type="month" value={thangBaoCao} onChange={(event) => setThangBaoCao(event.target.value)} />
          </label>
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

      <section className="khung">
        <div className="xem-truoc__dau">
          <strong>Biểu đồ doanh thu, chi phí, lợi nhuận</strong>
          <span>{reportData.length ? `Từ ${dinhDangNhanThangNgan(reportData[0].monthKey)} đến ${dinhDangNhanThangNgan(reportData[reportData.length - 1].monthKey)}` : 'Chưa có dữ liệu'}</span>
        </div>
        <div className="invoice-toolbar reports-toolbar">
          <label className="invoice-search invoice-search--month">
            <span>Tháng kết thúc chuỗi</span>
            <input type="month" value={thangKetThuc} onChange={(event) => setThangKetThuc(event.target.value)} />
          </label>
          <button type="button" className="nut nut--phu" onClick={() => setReloadKey((value) => value + 1)} disabled={dangTai}>
            {dangTai ? 'Đang tải...' : 'Làm mới báo cáo'}
          </button>
        </div>
        {loi ? <div className="thong-bao-loi">{loi}</div> : null}
        {dangTai ? (
          <div className="khung-du-lieu khung-du-lieu--trong">Đang tải dữ liệu báo cáo...</div>
        ) : reportData.length ? (
          <div className="report-layout">
            <section className="invoice-stats">
              <article className="invoice-stat-card">
                <span>Tổng doanh thu 6 tháng</span>
                <strong className="invoice-amount invoice-amount--paid">{dinhDangTien(tongDoanhThu).replace(/\s*VND$/, '')}</strong>
              </article>
              <article className="invoice-stat-card">
                <span>Tổng chi phí 6 tháng</span>
                <strong className="invoice-amount invoice-amount--unpaid">{dinhDangTien(tongChiPhi).replace(/\s*VND$/, '')}</strong>
              </article>
              <article className="invoice-stat-card">
                <span>Tổng lợi nhuận 6 tháng</span>
                <strong className={`invoice-amount ${tongLoiNhuan >= 0 ? 'invoice-amount--paid' : 'invoice-amount--unpaid'}`}>
                  {dinhDangTien(tongLoiNhuan).replace(/\s*VND$/, '')}
                </strong>
              </article>
            </section>
            <ReportTrendChart data={reportData} />
          </div>
        ) : (
          <div className="khung-du-lieu khung-du-lieu--trong">Chưa có dữ liệu báo cáo để hiển thị.</div>
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
  }, [reloadKey])

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
          <div className="invoice-toolbar">
            <label className="invoice-search">
              <span>Phòng</span>
              <input type="text" value={phongFilter} onChange={(event) => setPhongFilter(event.target.value)} placeholder="Nhập mã phòng" />
            </label>
            <label className="invoice-search invoice-search--month">
              <span>Tháng - năm</span>
              <input type="month" value={thangNamFilter} onChange={(event) => setThangNamFilter(event.target.value)} />
            </label>
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
      'patch /api/meterreadings/current-reading': 'Sửa chỉ số điện gốc theo phòng',
      'delete /api/meterreadings/by-ended-contract/{contractid:int}': 'Xóa tất cả bản ghi chỉ số điện của hợp đồng đã chấm dứt',
      'delete /api/meterreadings/by-ended-contract/{contractid}': 'Xóa tất cả bản ghi chỉ số điện của hợp đồng đã chấm dứt',
      'post /api/meterreadings/read-from-image': 'Đọc chỉ số từ hình ảnh',
      'get /api/meterreadings/missing': 'Lấy danh sách phòng thiếu chỉ số',
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
      throw new Error('Yêu cầu đã bị dừng sau 60 giây. Hãy thử lại với ảnh rõ hơn.')
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

function useTrangHienTai() {
  const docHash = () => window.location.hash.replace(/^#\/?/, '') || 'tong-quan'
  const [trang, setTrang] = useState(docHash)

  useEffect(() => {
    const onHashChange = () => setTrang(docHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return [trang, setTrang]
}

function TrangTongQuan() {
  return <div className="trang-trong" />
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
    setter((current) => ({
      ...current,
      [name]: value,
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
          query.set(param.name, normalizeValue(rawValue, param.schema, spec))
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
              normalizeValue(formValues[name], schema, spec),
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
              normalizeValue(bodyValues[name], schema, spec),
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
            formData.append(name, normalizeValue(value, schema, spec))
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
          .map(([name, schema]) => [name, normalizeValue(sourceValues[name], schema, spec)])
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
                          type={kieuInput(param.schema, spec)}
                          value={pathValues[param.name] ?? ''}
                          onChange={(event) => capNhatField(setPathValues, param.name, event.target.value)}
                          placeholder={param.name}
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
                        <option value="unpaid">Chưa thanh toán</option>
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
                        type={kieuInput(param.schema, spec)}
                        value={queryValues[param.name] ?? ''}
                        onChange={(event) => capNhatField(setQueryValues, param.name, event.target.value)}
                        placeholder={tenDep(param.name)}
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
                            type={kieuInput(schema, spec)}
                            value={formValues[name] ?? ''}
                            onChange={(event) => capNhatField(setFormValues, name, event.target.value)}
                            placeholder={nhanTruong(moduleKey, path, name)}
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
                            type={kieuInput(schema, spec)}
                            value={bodyValues[name] ?? ''}
                            onChange={(event) => capNhatField(setBodyValues, name, event.target.value)}
                            placeholder={nhanTruong(moduleKey, path, name)}
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
                          type={kieuInput(schema, spec)}
                          value={formValues[name] ?? ''}
                          onChange={(event) => capNhatField(setFormValues, name, event.target.value)}
                          placeholder={resolved.format === 'date' ? 'YYYY-MM-DD' : name}
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
    return <RoomsWorkspace />
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
              Hãy bảo đảm backend đang chạy ở <code>http://localhost:5103</code> hoặc Vite proxy đang trỏ đúng cổng.
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


