import { useState, useEffect, useCallback } from 'react'
import { 
  Receipt, 
  Plus, 
  Search, 
  Trash2, 
  X, 
  Download, 
  RefreshCw, 
  Loader2, 
  AlertCircle, 
  Layers,
  Edit3,
  Info,
  Eye,
  MoreVertical,
  DollarSign
} from 'lucide-react'
import { 
  layHoaDonThang, 
  taoHoaDon, 
  taoHoaDonBulk, 
  thanhToanHoaDon, 
  huyThanhToanHoaDon, 
  xoaHoaDon, 
  downloadInvoiceImage,
  downloadInvoiceImagesZip,
  layDanhSachHopDong,
  thayTheHoaDon,
  suaHoaDon,
  previewHoaDon
} from '../api'
import './Invoices.css'
import { useNotification } from '../context/NotificationContext'
import { getCurrentMonthValue } from '../utils/month'
import { sortByRoomCode } from '../utils/roomSort'

const getPaymentSummary = (invoice, amount) => {
  const total = Math.max(0, Number(invoice?.totalAmount) || 0)
  const paid = Math.min(Math.max(0, Number(amount) || 0), total)
  return { total, paid, remaining: Math.max(0, total - paid) }
}

const getNextBillingMonth = (billingMonth) => {
  const match = String(billingMonth || '').match(/^(\d{4})-(\d{2})/)
  if (!match) return 'tiếp theo'

  const year = Number(match[1])
  const month = Number(match[2])
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  return `${String(nextMonth).padStart(2, '0')}/${nextYear}`
}

export default function Invoices() {
  const { toast, confirm } = useNotification()
  const [thang, setThang] = useState(getCurrentMonthValue)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [invoices, setInvoices] = useState([])
  const [openMenuInvoiceId, setOpenMenuInvoiceId] = useState(null)
  
  useEffect(() => {
    const handleCloseMenu = () => setOpenMenuInvoiceId(null)
    window.addEventListener('click', handleCloseMenu)
    return () => window.removeEventListener('click', handleCloseMenu)
  }, [])

  const [activeContracts, setActiveContracts] = useState([])
  
  // Filtering & Search
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Single Create Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    contractId: '',
    discountAmount: '0',
    debtAmount: '0'
  })
  const [createError, setCreateError] = useState(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)

  // Bulk Create Modal State
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    defaultDiscountAmount: '0',
    defaultDebtAmount: '0'
  })
  const [bulkError, setBulkError] = useState(null)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [imagesDownloading, setImagesDownloading] = useState(false)

  // Pay Modal State
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payTarget, setPayTarget] = useState(null)
  const [payForm, setPayForm] = useState({
    amount: ''
  })
  const [payError, setPayError] = useState(null)
  const [paySubmitting, setPaySubmitting] = useState(false)

  // Edit Invoice Modal State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // invoice object
  const [editForm, setEditForm] = useState({
    roomFee: '0',
    electricityFee: '0',
    waterFee: '0',
    trashFee: '0',
    extraFee: '0',
    discountAmount: '0',
    debtAmount: '0',
    depositDebtAmount: '0',
    extraFeeNote: '',
    note: ''
  })
  const [editError, setEditError] = useState(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState(null)

  const handleOpenDetail = (invoice) => {
    setDetailTarget(invoice)
    setDetailModalOpen(true)
  }

  const taiDuLieu = useCallback(async () => {
    setLoading(true)
    setError(null)
    const formattedMonth = `${thang}-01`
    try {
      const [invoicesData, contractsData] = await Promise.all([
        layHoaDonThang(formattedMonth),
        layDanhSachHopDong('active')
      ])
      setInvoices(sortByRoomCode(invoicesData))
      setActiveContracts(sortByRoomCode(contractsData))
    } catch (err) {
      console.error(err)
      setError(err.message || 'Không thể tải danh sách hóa đơn')
    } finally {
      setLoading(false)
    }
  }, [thang])

  useEffect(() => {
    const timer = setTimeout(() => taiDuLieu(), 0)
    return () => clearTimeout(timer)
  }, [taiDuLieu])

  // SSE Real-time auto-reload: lắng nghe sự kiện từ server để tự động làm mới dữ liệu
  useEffect(() => {
    const handleRealtimeEvent = (event) => {
      const payload = event.detail
      if (
        payload.eventName === 'invoice.created' ||
        payload.eventName === 'invoice.bulk-created' ||
        payload.eventName === 'invoice.marked-paid' ||
        payload.eventName === 'invoice.marked-unpaid' ||
        payload.eventName === 'invoice.replaced' ||
        payload.eventName === 'invoice.updated' ||
        payload.eventName === 'invoice.deleted' ||
        payload.eventName === 'invoice.electricity-updated' ||
        payload.eventName === 'payment.webhook-received' ||
        payload.eventName === 'payment.reconciled'
      ) {
        taiDuLieu()
      }
    }

    window.addEventListener('realtime-event', handleRealtimeEvent)
    return () => {
      window.removeEventListener('realtime-event', handleRealtimeEvent)
    }
  }, [taiDuLieu])

  // Handle open create modal
  const handleOpenCreateModal = () => {
    setCreateForm({
      contractId: '',
      discountAmount: '0',
      debtAmount: '0'
    })
    setCreateError(null)
    setCreateModalOpen(true)
  }

  // Handle submit single create invoice
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setCreateError(null)
    setCreateSubmitting(true)

    const contract = activeContracts.find(c => c.contractId === parseInt(createForm.contractId))
    if (!contract) {
      setCreateError('Vui lòng chọn một phòng thuê hoạt động')
      setCreateSubmitting(false)
      return
    }

    try {
      await taoHoaDon({
        roomId: contract.roomId,
        contractId: contract.contractId,
        billingMonth: `${thang}-01`,
        discountAmount: parseFloat(createForm.discountAmount) || 0,
        debtAmount: parseFloat(createForm.debtAmount) || 0
      })
      setCreateModalOpen(false)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setCreateError(err.message || 'Lỗi khi tạo hóa đơn')
    } finally {
      setCreateSubmitting(false)
    }
  }

  // Handle open edit invoice modal
  const handleOpenEditModal = (invoice) => {
    setEditTarget(invoice)
    setEditForm({
      roomFee: String(invoice.roomFee || 0),
      electricityFee: String(invoice.electricityFee || 0),
      waterFee: String(invoice.waterFee || 0),
      trashFee: String(invoice.trashFee || 0),
      extraFee: String(invoice.extraFee || 0),
      discountAmount: String(invoice.discountAmount || 0),
      debtAmount: String(invoice.debtAmount || 0),
      depositDebtAmount: String(invoice.depositDebtAmount || 0),
      extraFeeNote: invoice.extraFeeNote || '',
      note: invoice.note || ''
    })
    setEditError(null)
    setEditModalOpen(true)
  }

  // Handle submit edit invoice
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditError(null)
    setEditSubmitting(true)

    const dto = {
      roomFee: parseFloat(editForm.roomFee) || 0,
      electricityFee: parseFloat(editForm.electricityFee) || 0,
      waterFee: parseFloat(editForm.waterFee) || 0,
      trashFee: parseFloat(editForm.trashFee) || 0,
      extraFee: parseFloat(editForm.extraFee) || 0,
      discountAmount: parseFloat(editForm.discountAmount) || 0,
      debtAmount: parseFloat(editForm.debtAmount) || 0,
      depositDebtAmount: parseFloat(editForm.depositDebtAmount) || 0,
      extraFeeNote: editForm.extraFeeNote,
      note: editForm.note
    }

    try {
      await suaHoaDon(editTarget.invoiceId, dto)
      setEditModalOpen(false)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setEditError(err.message || 'Không thể chỉnh sửa hóa đơn')
    } finally {
      setEditSubmitting(false)
    }
  }

  // Handle replace/recalculate invoice - lấy preview mới nhất rồi ghi đè
  const handleReplaceInvoice = async (invoiceId) => {
    const isConfirmed = await confirm('Bạn có chắc chắn muốn tính toán lại (ghi đè) hóa đơn này dựa trên chỉ số điện nước mới nhất không?', 'Tính toán lại hóa đơn')
    if (!isConfirmed) return
    try {
      // Tìm hóa đơn hiện tại trong state để lấy thông tin phòng và hợp đồng
      const currentInvoice = invoices.find(inv => inv.invoiceId === invoiceId)
      if (!currentInvoice) {
        toast.error('Không tìm thấy hóa đơn trong danh sách hiện tại.')
        return
      }

      // Gọi preview để Backend tính toán lại chính xác dựa trên chỉ số mới nhất
      const preview = await previewHoaDon({
        roomId: currentInvoice.roomId,
        contractId: currentInvoice.contractId,
        billingMonth: currentInvoice.billingMonth || `${thang}-01`,
        discountAmount: currentInvoice.discountAmount || 0,
        debtAmount: currentInvoice.debtAmount || 0
      })

      // Gửi payload đầy đủ sang API replace để tạo hóa đơn mới ghi đè chính xác
      await thayTheHoaDon(invoiceId, {
        roomFee: preview.roomFee,
        electricityFee: preview.electricityFee,
        waterFee: preview.waterFee,
        trashFee: preview.trashFee,
        discountAmount: preview.discountAmount,
        debtAmount: preview.debtAmount,
        note: currentInvoice.note || null
      })
      taiDuLieu()
      toast.success('Đã tính toán lại hóa đơn thành công!')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Không thể tính toán lại hóa đơn')
    }
  }

  // Handle submit bulk create
  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    setBulkError(null)
    setBulkSubmitting(true)

    try {
      const results = await taoHoaDonBulk({
        billingMonth: `${thang}-01`,
        defaultDiscountAmount: parseFloat(bulkForm.defaultDiscountAmount) || 0,
        defaultDebtAmount: parseFloat(bulkForm.defaultDebtAmount) || 0
      })
      
      setBulkModalOpen(false)
      toast.success(`Đã tạo lập đồng loạt ${results.length || 0} hóa đơn thành công.`)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setBulkError(err.message || 'Lỗi khi tạo hóa đơn đồng loạt')
    } finally {
      setBulkSubmitting(false)
    }
  }

  // Open pay modal
  const handleOpenPay = (invoice) => {
    setPayTarget(invoice)
    setPayForm({
      amount: invoice.totalAmount.toString()
    })
    setPayError(null)
    setPayModalOpen(true)
  }

  // Handle submit pay
  const handlePaySubmit = async (e) => {
    e.preventDefault()
    setPayError(null)
    setPaySubmitting(true)

    const payAmount = parseFloat(payForm.amount)
    if (isNaN(payAmount) || payAmount <= 0) {
      setPayError('Số tiền thanh toán phải lớn hơn 0')
      setPaySubmitting(false)
      return
    }

    try {
      await thanhToanHoaDon(payTarget.invoiceId, {
        amount: payAmount,
        paymentMethod: 'Tiền mặt',
        paymentReference: null,
        note: null
      })
      setPayModalOpen(false)
      const summary = getPaymentSummary(payTarget, payAmount)
      toast.success(
        summary.remaining > 0
          ? `Đã thu ${dinhDangTien(summary.paid)}/${dinhDangTien(summary.total)}. Thiếu ${dinhDangTien(summary.remaining)} được cộng dồn vào tháng ${getNextBillingMonth(payTarget.billingMonth)}.`
          : 'Đã thu đủ hóa đơn.'
      )
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setPayError(err.message || 'Lỗi khi thanh toán hóa đơn')
    } finally {
      setPaySubmitting(false)
    }
  }

  // Handle mark unpaid
  const handleMarkUnpaid = async (id) => {
    const isConfirmed = await confirm('Bạn có muốn khôi phục trạng thái Chưa thanh toán cho hóa đơn này?', 'Khôi phục hóa đơn')
    if (!isConfirmed) return
    
    try {
      await huyThanhToanHoaDon(id)
      taiDuLieu()
      toast.success('Đã khôi phục trạng thái Chưa thanh toán.')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Không thể khôi phục trạng thái hóa đơn')
    }
  }

  // Handle delete invoice
  const handleDeleteInvoice = async (id) => {
    const isConfirmed = await confirm('Bạn có chắc chắn muốn xóa hóa đơn này vĩnh viễn? Dữ liệu ghi số điện tương ứng vẫn sẽ được giữ lại.', 'Xác nhận xóa hóa đơn')
    if (!isConfirmed) return
    
    try {
      await xoaHoaDon(id)
      taiDuLieu()
      toast.success('Đã xóa hóa đơn thành công.')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Lỗi khi xóa hóa đơn')
    }
  }

  // Handle download invoice image
  const handleDownloadImage = async (id, roomCode) => {
    try {
      const blob = await downloadInvoiceImage(id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `HoaDon-${roomCode}-${thang}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Không thể tải ảnh hóa đơn')
    }
  }

  const handleDownloadAllImages = async () => {
    setImagesDownloading(true)
    try {
      const status = selectedStatus === 'all' ? null : selectedStatus
      const blob = await downloadInvoiceImagesZip(`${thang}-01`, status)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `AnhHoaDon-${thang}-${status || 'tat-ca'}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Đã tải file ZIP ảnh hóa đơn.')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Không thể tải ảnh hóa đơn')
    } finally {
      setImagesDownloading(false)
    }
  }

  const dinhDangTien = (so) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(so)
  }

  const layBadgeClass = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'paid': return 'status-badge--success'
      case 'unpaid': return 'status-badge--warning'
      case 'overdue': return 'status-badge--danger'
      default: return 'status-badge--info'
    }
  }

  const layTenTrangThai = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'paid': return 'Đã thu'
      case 'unpaid': return 'Chưa thu'
      case 'overdue': return 'Quá hạn'
      default: return status || ''
    }
  }

  // Filtered list
  const filteredInvoices = sortByRoomCode(invoices.filter(inv => {
    const matchesStatus = selectedStatus === 'all' || (inv.status || '').toLowerCase() === selectedStatus.toLowerCase()
    const query = searchQuery.toLowerCase()
    const matchesSearch = (
      (inv.roomCode && inv.roomCode.toLowerCase().includes(query)) ||
      (inv.tenantName && inv.tenantName.toLowerCase().includes(query))
    )
    return matchesStatus && matchesSearch
  }))

  const visibleInvoiceCurrentMonthTotal = filteredInvoices.reduce((sum, inv) => {
    return sum + (Number(inv.totalAmount || 0) - Number(inv.debtAmount || 0))
  }, 0)

  return (
    <div className="page-body">
      <div className="invoices-header">
        <div>
          <h1>Hóa Đơn Hàng Tháng</h1>
          <p className="subtitle">Lập hóa đơn tiền phòng, tiền điện nước và cập nhật tình trạng công nợ</p>
        </div>

        <div className="invoices-header-actions">
          <div className="month-picker-container">
            <input 
              type="month" 
              className="month-input"
              value={thang} 
              onChange={(e) => setThang(e.target.value)} 
            />
          </div>

          <button className="btn btn-secondary" onClick={() => setBulkModalOpen(true)}>
            <Layers size={18} />
            <span>Tạo đồng loạt</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleDownloadAllImages}
            disabled={imagesDownloading || loading || filteredInvoices.length === 0}
          >
            {imagesDownloading ? <Loader2 className="spinner" size={18} /> : <Download size={18} />}
            <span>{imagesDownloading ? 'Đang tải...' : 'Tải ảnh tất cả'}</span>
          </button>

          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
            <Plus size={18} />
            <span>Lập hóa đơn</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="invoices-toolbar">
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${selectedStatus === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('all')}
          >
            Tất cả ({invoices.length})
          </button>
          <button 
            className={`filter-tab ${selectedStatus === 'unpaid' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('unpaid')}
          >
            Chưa thu ({invoices.filter(i => (i.status || '').toLowerCase() === 'unpaid').length})
          </button>
          <button 
            className={`filter-tab ${selectedStatus === 'paid' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('paid')}
          >
            Đã thu ({invoices.filter(i => (i.status || '').toLowerCase() === 'paid').length})
          </button>
        </div>

        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Tìm theo số phòng..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="error-alert">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <Loader2 className="spinner" size={36} />
          <span>Đang tải danh sách hóa đơn...</span>
        </div>
      ) : (
        <>
          {filteredInvoices.length === 0 ? (
            <div className="invoices-empty-state">
              <Receipt size={64} className="empty-icon" />
              <h3>Không tìm thấy hóa đơn nào</h3>
              <p>Chưa có hóa đơn nào cho tháng này hoặc bộ lọc không khớp.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table invoices-page-table">
                <thead>
                  <tr>
                    <th>Phòng</th>
                    <th>Người thuê</th>
                    <th>Tiền phòng</th>
                    <th>Tiền điện (kWh)</th>
                    <th>Nước & DV khác</th>
                    <th>Giảm giá/Công nợ</th>
                    <th>Tổng cộng</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.invoiceId}>
                      <td>
                        <strong>{inv.roomCode}</strong>
                        {inv.invoiceType === 'end' && <span className="type-badge-mini" style={{ marginLeft: '4px' }}>Quyết toán</span>}
                      </td>
                      <td>
                        <span className="invoice-tenant-name">{inv.tenantName || '—'}</span>
                      </td>
                      <td>{dinhDangTien(inv.roomFee)}</td>
                      <td>
                        <div className="details-cell-mini">
                          <span>{dinhDangTien(inv.electricityFee)}</span>
                          {inv.consumedUnits !== null && (
                            <span className="subtext" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {inv.consumedUnits} kWh ({inv.previousReading}→{inv.currentReading})
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{dinhDangTien(inv.waterFee + inv.trashFee + inv.extraFee)}</td>
                      <td>
                        <div className="details-cell-mini">
                          {inv.discountAmount > 0 && <span className="text-success">Giảm: -{dinhDangTien(inv.discountAmount)}</span>}
                          {inv.debtAmount > 0 && <span className="text-danger">Nợ cũ: +{dinhDangTien(inv.debtAmount)}</span>}
                          {inv.depositDebtAmount > 0 && <span className="text-danger">Nợ cọc: +{dinhDangTien(inv.depositDebtAmount)}</span>}
                          {inv.discountAmount === 0 && inv.debtAmount === 0 && inv.depositDebtAmount === 0 && <span className="text-muted">—</span>}
                        </div>
                      </td>
                      <td>
                        <strong>{dinhDangTien(inv.totalAmount)}</strong>
                      </td>
                      <td>
                        {(() => {
                          const summary = getPaymentSummary(inv, inv.paidAmount ?? inv.totalAmount)
                          const isPartialPayment = (inv.status || '').toLowerCase() === 'paid' && summary.paid > 0 && summary.remaining > 0

                          return (
                            <div className="invoice-payment-status">
                              <span className={`status-badge ${isPartialPayment ? 'status-badge--partial-payment' : layBadgeClass(inv.status)}`}>
                                {isPartialPayment ? `Đã thu ${dinhDangTien(summary.paid)}/${dinhDangTien(summary.total)}` : layTenTrangThai(inv.status)}
                              </span>
                              {isPartialPayment && (
                                <span className="invoice-payment-shortfall">
                                  Thiếu {dinhDangTien(summary.remaining)} được cộng dồn vào tháng {getNextBillingMonth(inv.billingMonth)}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="invoice-actions-flex" style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {(inv.status || '').toLowerCase() === 'unpaid' ? (
                            <button 
                              className="btn btn-success btn-xs btn-collect-money"
                              onClick={() => handleOpenPay(inv)}
                            >
                              <DollarSign size={13} />
                              <span>Thu tiền</span>
                            </button>
                          ) : (
                            <button 
                              className="btn btn-secondary btn-xs btn-cancel-collect"
                              onClick={() => handleMarkUnpaid(inv.invoiceId)}
                              title="Hủy thanh toán"
                            >
                              <span>Hủy thu</span>
                            </button>
                          )}

                          <button 
                            className="btn-card-edit"
                            onClick={() => handleDownloadImage(inv.invoiceId, inv.roomCode)}
                            title="Tải ảnh hóa đơn"
                            style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Download size={14} />
                          </button>

                          {(inv.status || '').toLowerCase() === 'unpaid' && (
                            <button 
                              className="btn-card-edit"
                              onClick={() => handleOpenEditModal(inv)}
                              title="Chỉnh sửa hóa đơn"
                              style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Edit3 size={14} />
                            </button>
                          )}

                          <button 
                            className="btn-card-edit"
                            onClick={() => handleOpenDetail(inv)}
                            title="Xem chi tiết hóa đơn"
                            style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Eye size={14} />
                          </button>

                          <button 
                            className="btn-card-edit btn-danger-icon"
                            onClick={() => handleDeleteInvoice(inv.invoiceId)}
                            title="Xóa hóa đơn"
                            style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="invoice-list-total">
                <div>
                  <span className="invoice-list-total__label">Tổng tiền hóa đơn tháng này</span>
                  <span className="invoice-list-total__note">Không tính nợ cũ chuyển kỳ</span>
                </div>
                <strong>{dinhDangTien(visibleInvoiceCurrentMonthTotal)}</strong>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Single Invoice Modal */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Lập Hóa Đơn Kỳ {thang}</span>
              <button className="btn-close-modal" onClick={() => setCreateModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {createError && (
                  <div className="error-alert">
                    <AlertCircle size={18} />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="inv-contract">Chọn phòng trọ thuê hoạt động</label>
                  <select 
                    id="inv-contract" 
                    className="form-control"
                    required
                    value={createForm.contractId}
                    onChange={(e) => setCreateForm({...createForm, contractId: e.target.value})}
                  >
                    <option value="">-- Chọn phòng --</option>
                    {activeContracts.map(c => (
                      <option key={c.contractId} value={c.contractId}>{c.roomCode} (Khách: {c.tenantName})</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="inv-discount">Miễn giảm số tiền (VND)</label>
                    <input 
                      type="number" 
                      id="inv-discount" 
                      className="form-control"
                      value={createForm.discountAmount}
                      onChange={(e) => setCreateForm({...createForm, discountAmount: e.target.value})}
                      onWheel={(e) => e.target.blur()}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="inv-debt">Cộng dồn nợ cũ (VND)</label>
                    <input 
                      type="number" 
                      id="inv-debt" 
                      className="form-control"
                      value={createForm.debtAmount}
                      onChange={(e) => setCreateForm({...createForm, debtAmount: e.target.value})}
                      onWheel={(e) => e.target.blur()}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setCreateModalOpen(false)}
                  disabled={createSubmitting}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={createSubmitting}
                >
                  {createSubmitting ? 'Đang lập...' : 'Xác nhận Lập'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Bulk Invoices Modal */}
      {bulkModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Lập Hóa Đơn Đồng Loạt Kỳ {thang}</span>
              <button className="btn-close-modal" onClick={() => setBulkModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleBulkSubmit}>
              <div className="modal-body">
                {bulkError && (
                  <div className="error-alert">
                    <AlertCircle size={18} />
                    <span>{bulkError}</span>
                  </div>
                )}
                
                <div className="warning-notice-box" style={{ background: 'var(--accent-light)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                  <Info className="cell-icon-accent" size={24} />
                  <div>
                    <h4>Tính năng tạo đồng loạt</h4>
                    <p>Hệ thống tự động rà soát tất cả các phòng có hợp đồng đang hoạt động chưa xuất hóa đơn trong tháng {thang}. Bắt buộc phòng đó phải được Ghi chỉ số điện trước.</p>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="bulk-discount">Giảm giá mặc định cho mỗi phòng (VND)</label>
                    <input 
                      type="number" 
                      id="bulk-discount" 
                      className="form-control"
                      value={bulkForm.defaultDiscountAmount}
                      onChange={(e) => setBulkForm({...bulkForm, defaultDiscountAmount: e.target.value})}
                      onWheel={(e) => e.target.blur()}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="bulk-debt">Cộng nợ mặc định (VND)</label>
                    <input 
                      type="number" 
                      id="bulk-debt" 
                      className="form-control"
                      value={bulkForm.defaultDebtAmount}
                      onChange={(e) => setBulkForm({...bulkForm, defaultDebtAmount: e.target.value})}
                      onWheel={(e) => e.target.blur()}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setBulkModalOpen(false)}
                  disabled={bulkSubmitting}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={bulkSubmitting}
                >
                  {bulkSubmitting ? 'Đang xử lý...' : 'Xác nhận tạo hàng loạt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {payModalOpen && payTarget && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Ghi Nhận Thanh Toán Phòng {payTarget.roomCode}</span>
              <button className="btn-close-modal" onClick={() => setPayModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handlePaySubmit}>
              <div className="modal-body">
                {payError && (
                  <div className="error-alert">
                    <AlertCircle size={18} />
                    <span>{payError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Số tiền thực tế thanh toán (VND) *</label>
                  <input 
                    type="number" 
                    className="form-control"
                    required
                    value={payForm.amount}
                    onChange={(e) => setPayForm({...payForm, amount: e.target.value})}
                    onWheel={(e) => e.target.blur()}
                  />
                  <span className="form-help">Mặc định là số tiền hóa đơn cần thu: {dinhDangTien(payTarget.totalAmount)}</span>
                  {(() => {
                    const summary = getPaymentSummary(payTarget, parseFloat(payForm.amount))
                    if (summary.paid <= 0) return null

                    return (
                      <div className="payment-collection-preview">
                        <strong>Đã thu {dinhDangTien(summary.paid)} / {dinhDangTien(summary.total)}</strong>
                        {summary.remaining > 0 ? (
                          <span>Thiếu {dinhDangTien(summary.remaining)} được cộng dồn vào tháng {getNextBillingMonth(payTarget.billingMonth)}.</span>
                        ) : (
                          <span>Hóa đơn sẽ được thu đủ.</span>
                        )}
                      </div>
                    )
                  })()}
                </div>

              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setPayModalOpen(false)}
                  disabled={paySubmitting}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-success"
                  disabled={paySubmitting}
                >
                  {paySubmitting ? 'Đang lưu giao dịch...' : 'Xác nhận thu tiền'}
                </button>
              </div>
            </form>
          </div>
            </div>
      )}

      {/* Edit Invoice Modal */}
      {editModalOpen && editTarget && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Sửa Chi Tiết Hóa Đơn - Phòng {editTarget.roomCode}</span>
              <button className="btn-close-modal" onClick={() => setEditModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {editError && (
                  <div className="error-alert">
                    <AlertCircle size={18} />
                    <span>{editError}</span>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-room-fee">Tiền phòng (đ)</label>
                    <input type="number" id="edit-room-fee" className="form-control" min="0" required value={editForm.roomFee} onChange={(e) => setEditForm({...editForm, roomFee: e.target.value})} onWheel={(e) => e.target.blur()} />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-electricity-fee">Tiền điện (đ)</label>
                    <input type="number" id="edit-electricity-fee" className="form-control" min="0" required value={editForm.electricityFee} onChange={(e) => setEditForm({...editForm, electricityFee: e.target.value})} onWheel={(e) => e.target.blur()} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-water-fee">Tiền nước (đ)</label>
                    <input type="number" id="edit-water-fee" className="form-control" min="0" required value={editForm.waterFee} onChange={(e) => setEditForm({...editForm, waterFee: e.target.value})} onWheel={(e) => e.target.blur()} />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-trash-fee">Tiền rác (đ)</label>
                    <input type="number" id="edit-trash-fee" className="form-control" min="0" required value={editForm.trashFee} onChange={(e) => setEditForm({...editForm, trashFee: e.target.value})} onWheel={(e) => e.target.blur()} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-extra-fee">Phí phát sinh (đ)</label>
                    <input type="number" id="edit-extra-fee" className="form-control" min="0" required value={editForm.extraFee} onChange={(e) => setEditForm({...editForm, extraFee: e.target.value})} onWheel={(e) => e.target.blur()} />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-deposit-debt">Nợ tiền cọc (đ)</label>
                    <input type="number" id="edit-deposit-debt" className="form-control" min="0" required value={editForm.depositDebtAmount} onChange={(e) => setEditForm({...editForm, depositDebtAmount: e.target.value})} onWheel={(e) => e.target.blur()} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-extra-note">Ghi chú phí phát sinh</label>
                  <input type="text" id="edit-extra-note" className="form-control" placeholder="Ví dụ: Phụ thu, hoàn tiền, dịch vụ khác..." value={editForm.extraFeeNote} onChange={(e) => setEditForm({...editForm, extraFeeNote: e.target.value})} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-discount">Số tiền giảm giá (đ)</label>
                  <input 
                    type="number" 
                    id="edit-discount" 
                    className="form-control"
                    min="0"
                    required
                    value={editForm.discountAmount}
                    onChange={(e) => setEditForm({...editForm, discountAmount: e.target.value})}
                    onWheel={(e) => e.target.blur()}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-debt">Số tiền nợ cũ cộng thêm (đ)</label>
                  <input 
                    type="number" 
                    id="edit-debt" 
                    className="form-control"
                    min="0"
                    required
                    value={editForm.debtAmount}
                    onChange={(e) => setEditForm({...editForm, debtAmount: e.target.value})}
                    onWheel={(e) => e.target.blur()}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-note">Ghi chú hóa đơn</label>
                  <input 
                    type="text" 
                    id="edit-note" 
                    className="form-control"
                    placeholder="Ví dụ: Giảm giá ngày dịch vụ, chuyển nợ..."
                    value={editForm.note}
                    onChange={(e) => setEditForm({...editForm, note: e.target.value})}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setEditModalOpen(false)}
                  disabled={editSubmitting}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Đang lưu...' : 'Lưu hóa đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Detail Invoice Modal */}
      {detailModalOpen && detailTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span className="modal-title">Chi Tiết Hóa Đơn - Phòng {detailTarget.roomCode}</span>
              <button className="btn-close-modal" onClick={() => setDetailModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="invoice-detail-modal">
                <div className="detail-section">
                  <h4 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '10px' }}>Thông tin chung</h4>
                  <div className="detail-grid">
                    <div className="detail-item"><strong>Kỳ hóa đơn:</strong> <span>{detailTarget.billingMonth || 'N/A'}</span></div>
                    <div className="detail-item"><strong>Mã thanh toán:</strong> <span className="payment-code-lbl" style={{ padding: '2px 6px', fontSize: '0.78rem' }}>{detailTarget.paymentCode || 'N/A'}</span></div>
                    <div className="detail-item" style={{ marginTop: '5px' }}>
                      <strong>Trạng thái: </strong>
                      <span className={`status-badge ${layBadgeClass(detailTarget.status)}`}>
                        {layTenTrangThai(detailTarget.status)}
                      </span>
                    </div>
                    {detailTarget.invoiceType === 'final' && (
                      <div className="detail-item" style={{ marginTop: '5px' }}>
                        <strong>Phân loại:</strong> <span className="type-badge-mini">Quyết toán thanh lý</span>
                      </div>
                    )}
                  </div>
                </div>

                <hr style={{ margin: '15px 0', borderColor: 'var(--border-color)', opacity: 0.5 }} />

                <div className="detail-section">
                  <h4 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '10px' }}>Các hạng mục tiền phòng & dịch vụ</h4>
                  <table className="detail-table">
                    <thead>
                      <tr>
                        <th>Khoản mục</th>
                        <th style={{ textAlign: 'right' }}>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Tiền thuê phòng</td>
                        <td style={{ textAlign: 'right' }}>{dinhDangTien(detailTarget.roomFee)}</td>
                      </tr>
                      <tr>
                        <td>
                          Tiền điện sử dụng
                          {detailTarget.consumedUnits !== null && (
                            <span className="subtext-detail"> ({detailTarget.consumedUnits} kWh: {detailTarget.previousReading} → {detailTarget.currentReading})</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>{dinhDangTien(detailTarget.electricityFee)}</td>
                      </tr>
                      <tr>
                        <td>Tiền nước sinh hoạt</td>
                        <td style={{ textAlign: 'right' }}>{dinhDangTien(detailTarget.waterFee)}</td>
                      </tr>
                      <tr>
                        <td>Tiền thu gom rác & dịch vụ khác</td>
                        <td style={{ textAlign: 'right' }}>{dinhDangTien(detailTarget.trashFee)}</td>
                      </tr>
                      {detailTarget.extraFee > 0 && (
                        <tr>
                          <td>
                            Phí phát sinh khác
                            {detailTarget.extraFeeNote && <span className="subtext-detail"> ({detailTarget.extraFeeNote})</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>{dinhDangTien(detailTarget.extraFee)}</td>
                        </tr>
                      )}
                      {detailTarget.depositDebtAmount > 0 && (
                        <tr>
                          <td>Khấu trừ cọc thanh lý</td>
                          <td style={{ textAlign: 'right' }}>+{dinhDangTien(detailTarget.depositDebtAmount)}</td>
                        </tr>
                      )}
                      {detailTarget.discountAmount > 0 && (
                        <tr>
                          <td className="text-success">Khuyến mãi / Giảm giá</td>
                          <td style={{ textAlign: 'right' }} className="text-success">-{dinhDangTien(detailTarget.discountAmount)}</td>
                        </tr>
                      )}
                      {detailTarget.debtAmount > 0 && (
                        <tr>
                          <td className="text-danger">Nợ cũ cộng thêm</td>
                          <td style={{ textAlign: 'right' }} className="text-danger">+{dinhDangTien(detailTarget.debtAmount)}</td>
                        </tr>
                      )}
                      <tr className="detail-total-row">
                        <td><strong>TỔNG TIỀN CẦN THANH TOÁN</strong></td>
                        <td style={{ textAlign: 'right' }}><strong>{dinhDangTien(detailTarget.totalAmount)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {detailTarget.status === 'paid' && (
                  <>
                    <hr style={{ margin: '15px 0', borderColor: 'var(--border-color)', opacity: 0.5 }} />
                    <div className="detail-section">
                      <h4 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '10px' }}>Thông tin thanh toán</h4>
                      <div className="detail-grid">
                        <div className="detail-item"><strong>Ngày thu tiền:</strong> <span>{detailTarget.paidAt ? new Date(detailTarget.paidAt).toLocaleString('vi-VN') : 'N/A'}</span></div>
                        <div className="detail-item"><strong>Phương thức:</strong> <span>{detailTarget.paymentMethod || 'N/A'}</span></div>
                        <div className="detail-item"><strong>Mã giao dịch/Tham chiếu:</strong> <span>{detailTarget.paymentReference || 'N/A'}</span></div>
                      </div>
                    </div>
                  </>
                )}

                {detailTarget.note && (
                  <>
                    <hr style={{ margin: '15px 0', borderColor: 'var(--border-color)', opacity: 0.5 }} />
                    <div className="detail-section">
                      <strong>Ghi chú:</strong>
                      <p className="detail-note" style={{ margin: '5px 0 0 0' }}>{detailTarget.note}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setDetailModalOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
