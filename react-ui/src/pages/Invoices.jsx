import React, { useState, useEffect } from 'react'
import { 
  Receipt, 
  Plus, 
  Search, 
  Trash2, 
  X, 
  Download, 
  CheckSquare, 
  RefreshCw, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
  Layers,
  Clock,
  ArrowRight
} from 'lucide-react'
import { 
  layHoaDonThang, 
  taoHoaDon, 
  taoHoaDonBulk, 
  thanhToanHoaDon, 
  huyThanhToanHoaDon, 
  xoaHoaDon, 
  downloadInvoicePdf,
  layDanhSachHopDong
} from '../api'
import './Invoices.css'

export default function Invoices() {
  const [thang, setThang] = useState(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    return `${yyyy}-${mm}`
  })
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [invoices, setInvoices] = useState([])
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

  // Pay Modal State
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payTarget, setPayTarget] = useState(null)
  const [payForm, setPayForm] = useState({
    amount: '',
    paymentMethod: 'Chuyển khoản',
    paymentReference: '',
    note: ''
  })
  const [payError, setPayError] = useState(null)
  const [paySubmitting, setPaySubmitting] = useState(false)

  const taiDuLieu = async () => {
    setLoading(true)
    setError(null)
    const formattedMonth = `${thang}-01`
    try {
      const [invoicesData, contractsData] = await Promise.all([
        layHoaDonThang(formattedMonth),
        layDanhSachHopDong('active')
      ])
      setInvoices(invoicesData)
      setActiveContracts(contractsData)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Không thể tải danh sách hóa đơn')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    taiDuLieu()
  }, [thang])

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
      alert(`Đã tạo lập đồng loạt ${results.length || 0} hóa đơn thành công.`)
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
      amount: invoice.totalAmount.toString(),
      paymentMethod: 'Chuyển khoản',
      paymentReference: '',
      note: ''
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
        paymentMethod: payForm.paymentMethod,
        paymentReference: payForm.paymentReference.trim() || null,
        note: payForm.note.trim() || null
      })
      setPayModalOpen(false)
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
    if (!window.confirm('Bạn có muốn khôi phục trạng thái Chưa thanh toán cho hóa đơn này?')) return
    
    try {
      await huyThanhToanHoaDon(id)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      alert(err.message || 'Không thể khôi phục trạng thái hóa đơn')
    }
  }

  // Handle delete invoice
  const handleDeleteInvoice = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa hóa đơn này vĩnh viễn? Dữ liệu ghi số điện tương ứng vẫn sẽ được giữ lại.')) return
    
    try {
      await xoaHoaDon(id)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      alert(err.message || 'Lỗi khi xóa hóa đơn')
    }
  }

  // Handle download PDF
  const handleDownloadPdf = async (id, roomCode) => {
    try {
      const blob = await downloadInvoicePdf(id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `HoaDon-${roomCode}-${thang}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error(err)
      alert(err.message || 'Không thể tải PDF hóa đơn')
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
  const filteredInvoices = invoices.filter(inv => {
    const matchesStatus = selectedStatus === 'all' || (inv.status || '').toLowerCase() === selectedStatus.toLowerCase()
    const matchesSearch = inv.roomCode ? inv.roomCode.toLowerCase().includes(searchQuery.toLowerCase()) : false
    return matchesStatus && matchesSearch
  })

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
            Chưa thu ({invoices.filter(i => i.status.toLowerCase() === 'unpaid').length})
          </button>
          <button 
            className={`filter-tab ${selectedStatus === 'paid' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('paid')}
          >
            Đã thu ({invoices.filter(i => i.status.toLowerCase() === 'paid').length})
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
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Phòng</th>
                    <th>Tiền phòng</th>
                    <th>Tiền điện (kWh)</th>
                    <th>Nước & DV khác</th>
                    <th>Giảm giá/Nợ cũ</th>
                    <th>Tổng cộng</th>
                    <th>Trạng thái</th>
                    <th>Mã thanh toán</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.invoiceId}>
                      <td>
                        <strong>{inv.roomCode}</strong>
                        {inv.invoiceType === 'end' && <span className="type-badge-mini">Quyết toán</span>}
                      </td>
                      <td>{dinhDangTien(inv.roomFee)}</td>
                      <td>
                        <div className="details-cell-mini">
                          <span>{dinhDangTien(inv.electricityFee)}</span>
                          {inv.consumedUnits !== null && (
                            <span className="subtext">{inv.consumedUnits} kWh ({inv.previousReading}→{inv.currentReading})</span>
                          )}
                        </div>
                      </td>
                      <td>{dinhDangTien(inv.waterFee + inv.trashFee + inv.extraFee)}</td>
                      <td>
                        <div className="details-cell-mini">
                          {inv.discountAmount > 0 && <span className="text-success">Giảm: -{dinhDangTien(inv.discountAmount)}</span>}
                          {inv.debtAmount > 0 && <span className="text-danger">Nợ cũ: +{dinhDangTien(inv.debtAmount)}</span>}
                          {inv.discountAmount === 0 && inv.debtAmount === 0 && <span className="text-muted">—</span>}
                        </div>
                      </td>
                      <td>
                        <strong>{dinhDangTien(inv.totalAmount)}</strong>
                      </td>
                      <td>
                        <span className={`status-badge ${layBadgeClass(inv.status)}`}>
                          {layTenTrangThai(inv.status)}
                        </span>
                      </td>
                      <td>
                        <span className="payment-code-lbl">{inv.paymentCode || 'N/A'}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="invoice-actions-flex">
                          <button 
                            className="btn-card-edit"
                            onClick={() => handleDownloadPdf(inv.invoiceId, inv.roomCode)}
                            title="Tải hóa đơn PDF"
                          >
                            <Download size={15} />
                          </button>

                          {inv.status.toLowerCase() === 'unpaid' && (
                            <button 
                              className="btn btn-success btn-xs"
                              onClick={() => handleOpenPay(inv)}
                            >
                              Thu tiền
                            </button>
                          )}

                          {inv.status.toLowerCase() === 'paid' && (
                            <button 
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleMarkUnpaid(inv.invoiceId)}
                              title="Hủy thanh toán"
                            >
                              Hủy thu
                            </button>
                          )}

                          <button 
                            className="btn-card-edit btn-danger-icon"
                            onClick={() => handleDeleteInvoice(inv.invoiceId)}
                            title="Xóa hóa đơn"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  />
                  <span className="form-help">Mặc định là số tiền hóa đơn cần thu: {dinhDangTien(payTarget.totalAmount)}</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pay-method">Phương thức thanh toán</label>
                  <select 
                    id="pay-method" 
                    className="form-control"
                    value={payForm.paymentMethod}
                    onChange={(e) => setPayForm({...payForm, paymentMethod: e.target.value})}
                  >
                    <option value="Chuyển khoản">Chuyển khoản ngân hàng</option>
                    <option value="Tiền mặt">Tiền mặt</option>
                    <option value="Ví điện tử">Ví điện tử</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pay-ref">Mã tham chiếu / Số bút toán (nếu có)</label>
                  <input 
                    type="text" 
                    id="pay-ref" 
                    className="form-control"
                    placeholder="Ví dụ: FT200192837..."
                    value={payForm.paymentReference}
                    onChange={(e) => setPayForm({...payForm, paymentReference: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pay-note">Ghi chú thanh toán</label>
                  <input 
                    type="text" 
                    id="pay-note" 
                    className="form-control"
                    placeholder="Ví dụ: Đã trả đủ"
                    value={payForm.note}
                    onChange={(e) => setPayForm({...payForm, note: e.target.value})}
                  />
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
    </div>
  )
}
