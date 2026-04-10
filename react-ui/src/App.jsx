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
  { key: 'transactions', title: 'Thu chi', prefix: '/api/Transactions' },
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

function XemDanhSachPhong({ data }) {
  const [search, setSearch] = useState('')

  if (!Array.isArray(data) || !data.length) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Không có phòng nào.</div>
  }

  const filtered = search.trim()
    ? data.filter((room) =>
      String(room.roomCode ?? room.RoomCode ?? '')
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    )
    : data

  return (
    <div className="danh-sach-phong-wrap">
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

      {filtered.length === 0 ? (
        <div className="khung-du-lieu khung-du-lieu--trong">Không tìm thấy phòng phù hợp.</div>
      ) : (
        <div className="danh-sach-phong">
          {filtered.map((room, index) => {
            const status = trangThaiPhong(room.status ?? room.Status)
            return (
              <div key={`${room.roomCode || room.RoomCode || 'room'}-${index}`} className="dong-phong">
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

function XemDanhSachHopDong({ data }) {
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
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
                <button
                  type="button"
                  className="nut"
                  style={{ background: '#dc2626', color: '#fff' }}
                  onClick={() => xoaHoaDon(modalInvoiceId)}
                  disabled={modalDangXoa}
                >
                  {modalDangXoa ? 'Đang xóa...' : 'Xóa hóa đơn'}
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

function XemDanhSachNguoiThue({ data }) {
  if (!Array.isArray(data) || !data.length) {
    return <div className="khung-du-lieu khung-du-lieu--trong">Không có người thuê.</div>
  }

  const hiddenFields = new Set(['tenantid', 'roomid', 'createdat', 'updatedat'])

  return (
    <div className="danh-sach-phong">
      {data.map((tenant, index) => (
        <div key={`${tenant.id ?? tenant.Id ?? index}`} className="dong-phong dong-phong--nguoi-thue">
          {Object.entries(tenant)
            .filter(([key]) => !hiddenFields.has(key.toLowerCase()))
            .map(([key, value]) => (
              <div key={key} className="dong-phong__o">
                <span>{nhanTruong('tenants', '', key)}</span>
                <strong>{giaTriDep(value, key)}</strong>
              </div>
            ))}
        </div>
      ))}
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
              className="nut nut--phu"
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

function XemDanhSachChiSoDien({ data }) {
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

function MeterReadingCreateButton({ onSuccess }) {
  const [dangMo, setDangMo] = useState(false)
  const [captureMode, setCaptureMode] = useState('manual')
  const [roomOptions, setRoomOptions] = useState([])
  const [roomOptionsLoading, setRoomOptionsLoading] = useState(true)
  const [selectedRoomCode, setSelectedRoomCode] = useState('')
  const [billingMonth, setBillingMonth] = useState(taoThangMacDinh())
  const [currentReading, setCurrentReading] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [imageResult, setImageResult] = useState(null)
  const [trangThai, setTrangThai] = useState('')
  const [mauTrangThai, setMauTrangThai] = useState('')
  const [dangDocAnh, setDangDocAnh] = useState(false)
  const [dangXemTruoc, setDangXemTruoc] = useState(false)
  const [dangLuu, setDangLuu] = useState(false)

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

  const selectedRoom = useMemo(
    () => roomOptions.find((option) => String(option.value).trim().toLowerCase() === String(selectedRoomCode).trim().toLowerCase()) || null,
    [roomOptions, selectedRoomCode],
  )

  const resetMessages = () => {
    setTrangThai('')
    setMauTrangThai('')
  }

  const buildPayload = () => {
    if (!selectedRoom) {
      throw new Error('Vui lòng chọn phòng đang active.')
    }

    if (currentReading === '' || currentReading === null || currentReading === undefined) {
      throw new Error('Vui lòng nhập hoặc đọc ra chỉ số điện mới.')
    }

    return {
      roomId: Number(selectedRoom.roomId),
      contractId: Number(selectedRoom.contractId),
      billingMonth,
      currentReading: Number(currentReading),
    }
  }

  const docChiSoTuAnh = async () => {
    if (!imageFile) {
      setTrangThai('Vui lòng chọn hình ảnh công tơ trước khi đọc.')
      setMauTrangThai('that-bai')
      return
    }

    setDangDocAnh(true)
    resetMessages()
    setImageResult(null)

    try {
      const formData = new FormData()
      formData.append('image', imageFile)

      const result = await guiRequest('/api/MeterReadings/read-from-image', {
        method: 'POST',
        body: formData,
      })

      const payload = result.payload || {}
      const detectedReading = payload.detectedReading ?? payload.DetectedReading

      if (detectedReading === null || detectedReading === undefined || Number.isNaN(Number(detectedReading))) {
        throw new Error('Không đọc được chỉ số điện từ hình ảnh.')
      }

      setCurrentReading(String(detectedReading))
      setImageResult(payload)
      setTrangThai(`Đã đọc được chỉ số ${detectedReading}. Bạn có thể xem trước rồi lưu ngay.`)
      setMauTrangThai('thanh-cong')
    } catch (error) {
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
    } finally {
      setDangDocAnh(false)
    }
  }

  const xemTruoc = async () => {
    setDangXemTruoc(true)
    resetMessages()
    setPreviewData(null)

    try {
      const payload = buildPayload()
      const result = await guiRequest('/api/MeterReadings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setPreviewData(result.payload)
      setTrangThai('Xem trước chỉ số điện thành công.')
      setMauTrangThai('thanh-cong')
    } catch (error) {
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
    } finally {
      setDangXemTruoc(false)
    }
  }

  const luuChiSo = async () => {
    setDangLuu(true)
    resetMessages()

    try {
      const payload = buildPayload()
      await guiRequest('/api/MeterReadings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setTrangThai('Đã tạo bản ghi chỉ số điện nước thành công.')
      setMauTrangThai('thanh-cong')
      setPreviewData(null)
      setImageResult(null)
      setImageFile(null)
      setCurrentReading('')
      if (onSuccess) onSuccess()
    } catch (error) {
      setTrangThai(thongDiepLoi(error))
      setMauTrangThai('that-bai')
    } finally {
      setDangLuu(false)
    }
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

              <div className="meter-mode-switch">
                <button type="button" className={`nut ${captureMode === 'manual' ? 'nut--chinh' : 'nut--phu'}`} onClick={() => setCaptureMode('manual')}>
                  Nhập từ người dùng
                </button>
                <button type="button" className={`nut ${captureMode === 'image' ? 'nut--chinh' : 'nut--phu'}`} onClick={() => setCaptureMode('image')}>
                  Đưa hình ảnh lên
                </button>
              </div>

              <div className="invoice-edit-form meter-capture-form">
                <label className="truong">
                  <span>Phòng đang active</span>
                  <select value={selectedRoomCode} onChange={(event) => setSelectedRoomCode(event.target.value)} disabled={roomOptionsLoading || roomOptions.length === 0}>
                    <option value="">
                      {roomOptionsLoading ? 'Đang tải danh sách phòng...' : roomOptions.length ? 'Chọn phòng đang active' : 'Không có phòng active'}
                    </option>
                    {roomOptions.map((option) => (
                      <option key={`${option.roomId}-${option.contractId}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="truong">
                  <span>Tháng ghi chỉ số</span>
                  <input type="date" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
                </label>

                {captureMode === 'manual' ? (
                  <label className="truong">
                    <span>Chỉ số điện mới</span>
                    <input type="number" min="0" value={currentReading} onChange={(event) => setCurrentReading(event.target.value)} placeholder="Nhập chỉ số công tơ" />
                  </label>
                ) : (
                  <>
                    <label className="truong">
                      <span>Hình ảnh công tơ</span>
                      <input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] || null)} />
                    </label>
                    <label className="truong">
                      <span>Chỉ số đọc được</span>
                      <input type="number" min="0" value={currentReading} onChange={(event) => setCurrentReading(event.target.value)} placeholder="Sau khi đọc ảnh sẽ tự điền" />
                    </label>
                  </>
                )}
              </div>

              {imageResult ? (
                <div className="meter-image-result">
                  <span>Chỉ số nhận diện: {giaTriDep(imageResult.detectedReading ?? imageResult.DetectedReading, 'currentReading')}</span>
                  <span>Văn bản thô: {giaTriDep(imageResult.rawText ?? imageResult.RawText, 'rawText')}</span>
                </div>
              ) : null}

              {previewData ? (
                <div className="meter-preview-card">
                  <div className="meter-preview-card__grid">
                    <div>
                      <span>Phòng</span>
                      <strong>{previewData.roomCode ?? previewData.RoomCode ?? 'Không có dữ liệu'}</strong>
                    </div>
                    <div>
                      <span>Tháng</span>
                      <strong>{giaTriDep(previewData.billingMonth ?? previewData.BillingMonth, 'billingMonth')}</strong>
                    </div>
                    <div>
                      <span>Chỉ số cũ</span>
                      <strong>{giaTriDep(previewData.previousReading ?? previewData.PreviousReading, 'previousReading')}</strong>
                    </div>
                    <div>
                      <span>Chỉ số mới</span>
                      <strong>{giaTriDep(previewData.currentReading ?? previewData.CurrentReading, 'currentReading')}</strong>
                    </div>
                    <div>
                      <span>Số điện tiêu thụ</span>
                      <strong>{giaTriDep(previewData.consumedUnits ?? previewData.ConsumedUnits, 'consumedUnits')}</strong>
                    </div>
                    <div>
                      <span>Thành tiền</span>
                      <strong className="invoice-amount">{giaTriDep(previewData.amount ?? previewData.Amount, 'amount')}</strong>
                    </div>
                  </div>
                </div>
              ) : null}

              {trangThai ? <div className={`thanh-trang-thai ${mauTrangThai}`}>{trangThai}</div> : null}

              <div className="invoice-modal-actions">
                {captureMode === 'image' ? (
                  <button type="button" className="nut nut--phu" onClick={docChiSoTuAnh} disabled={dangDocAnh || !imageFile}>
                    {dangDocAnh ? 'Đang đọc ảnh...' : 'Đọc chỉ số từ ảnh'}
                  </button>
                ) : null}
                <button type="button" className="nut nut--phu" onClick={xemTruoc} disabled={dangXemTruoc || dangLuu}>
                  {dangXemTruoc ? 'Đang xem trước...' : 'Xem trước'}
                </button>
                <button type="button" className="nut" onClick={luuChiSo} disabled={dangLuu || dangXemTruoc}>
                  {dangLuu ? 'Đang lưu...' : 'Lưu bản ghi'}
                </button>
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </>
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

  const suaChiSoGoc = async () => {
    setDangSua(true)
    setTrangThai('')
    setMauTrangThai('')
    try {
      await guiRequest('/api/MeterReadings/current-reading', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

              <div className="invoice-edit-form meter-capture-form">
                <label className="truong">
                  <span>Tháng cần sửa</span>
                  <input type="date" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
                </label>
                <label className="truong">
                  <span>Mã phòng</span>
                  <input type="text" value={roomCode} onChange={(event) => setRoomCode(event.target.value)} placeholder="Ví dụ: A01" />
                </label>
                <label className="truong">
                  <span>Chỉ số điện mới</span>
                  <input type="number" min="0" value={currentReading} onChange={(event) => setCurrentReading(event.target.value)} placeholder="Ví dụ: 1530" />
                </label>
              </div>

              {trangThai ? <div className={`thanh-trang-thai ${mauTrangThai}`}>{trangThai}</div> : null}

              <div className="invoice-modal-actions">
                <button type="button" className="nut" onClick={suaChiSoGoc} disabled={dangSua || !roomCode || currentReading === ''}>
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
              className="nut nut--phu meter-toolbar-button meter-toolbar-button--refresh"
              onClick={() => setReloadKey((value) => value + 1)}
              disabled={dangTai}
            >
              {dangTai ? 'Đang tải...' : 'Làm mới danh sách'}
            </button>
          </div>

          <div className="meter-toolbar-actions">
            <MeterReadingCreateButton onSuccess={() => setReloadKey((value) => value + 1)} />
            <MeterReadingMissingButton />
            <MeterReadingOriginalEditButton />
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
            <XemDanhSachChiSoDien data={danhSachLoc} />
          </div>
        ) : (
          <div className="khung-du-lieu khung-du-lieu--trong">
            {phongFilter.trim() || thangNamFilter ? 'Không có bản ghi chỉ số nào khớp với bộ lọc hiện tại.' : 'Chưa có chỉ số điện nào trong hệ thống.'}
          </div>
        )}
      </section>
    </div>
  )
}

function InvoiceWorkspaceModern() {
  const [hoaDon, setHoaDon] = useState([])
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [phongFilter, setPhongFilter] = useState('')
  const [thangNamFilter, setThangNamFilter] = useState('')
  const [trangThaiFilter, setTrangThaiFilter] = useState('all')
  const [reloadKey, setReloadKey] = useState(0)

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
      'post /api/contracts/{id:int}/end-preview': 'Kết thúc hợp đồng và trả tiền cọc',
      'post /api/contracts/{id}/end-preview': 'Kết thúc hợp đồng và trả tiền cọc',
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
  const response = await fetch(url, options)
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
                      ? 'Chọn phòng đang active'
                      : laChonHopDongTheoPhong
                        ? 'Chọn phòng có hợp đồng'
                        : moduleKey === 'rooms'
                          ? 'Chọn phòng'
                          : 'Chọn người thuê'

                  const emptyText = pathSelectOptionsLoading
                    ? laChonHopDongDaKetThucTheoPhong
                      ? 'Đang tải phòng đã chấm dứt...'
                      : laKetThucHopDongTheoPhong
                        ? 'Đang tải phòng đang active...'
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
                          ? 'Không có phòng đang active'
                          : laChonHopDongTheoPhong
                            ? 'Không có hợp đồng'
                            : moduleKey === 'rooms'
                              ? 'Không có phòng'
                              : 'Không có người thuê'

                  const pathLabel = isIdSelect
                    ? laChonHopDongDaKetThucTheoPhong
                      ? 'Chọn phòng đã chấm dứt'
                      : laKetThucHopDongTheoPhong
                        ? 'Chọn phòng đang active'
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
    return <InvoiceWorkspaceModern />
  }

  if (module.key === 'meterreadings') {
    return <MeterReadingWorkspace />
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


