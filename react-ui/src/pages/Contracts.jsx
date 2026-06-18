import React, { useState, useEffect } from 'react'
import { 
  FileText, 
  Plus, 
  Trash2, 
  X, 
  HelpCircle, 
  Calendar, 
  User, 
  Home, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  ChevronRight,
  TrendingDown,
  Info,
  Clock
} from 'lucide-react'
import { 
  layDanhSachHopDong, 
  taoHopDong, 
  xoaHopDong, 
  huyHopDong, 
  layBaoCaoKetThucHopDong, 
  ketThucHopDong,
  layDanhSachPhong,
  layDanhSachNguoiThue
} from '../api'
import './Contracts.css'

export default function Contracts() {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Lists for dropdowns
  const [rooms, setRooms] = useState([])
  const [tenants, setTenants] = useState([])
  
  // Filtering
  const [selectedStatus, setSelectedStatus] = useState('active')
  
  // Create Contract Modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    roomId: '',
    tenantId: '',
    startDate: '',
    expectedEndDate: '',
    depositAmount: '0',
    occupantCount: '1',
    actualRoomPrice: ''
  })
  const [createError, setCreateError] = useState(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)

  // Cancel Contract Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelTargetId, setCancelTargetId] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  // Checkout (End Contract) Wizard Modal
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
  const [checkoutTarget, setCheckoutTarget] = useState(null)
  const [checkoutStep, setCheckoutStep] = useState(1) // 1: Input readings, 2: Preview calculation
  const [checkoutForm, setCheckoutForm] = useState({
    actualEndDate: '',
    currentReading: ''
  })
  const [checkoutPreview, setCheckoutPreview] = useState(null)
  const [checkoutError, setCheckoutError] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutNote, setCheckoutNote] = useState('')
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)

  const taiDuLieu = async () => {
    setLoading(true)
    setError(null)
    try {
      const [contractsData, roomsData, tenantsData] = await Promise.all([
        layDanhSachHopDong(null, null, true), // includeArchived
        layDanhSachPhong(),
        layDanhSachNguoiThue()
      ])
      setContracts(contractsData)
      setRooms(roomsData)
      setTenants(tenantsData)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Không thể tải danh sách hợp đồng')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    taiDuLieu()
  }, [])

  // Auto fill room price when room is selected
  const handleRoomChange = (roomId) => {
    const room = rooms.find(r => r.roomId === parseInt(roomId))
    setCreateForm(prev => ({
      ...prev,
      roomId: roomId,
      actualRoomPrice: room ? room.listedPrice.toString() : ''
    }))
  }

  // Handle open create modal
  const handleOpenCreateModal = () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    
    setCreateForm({
      roomId: '',
      tenantId: '',
      startDate: `${yyyy}-${mm}-${dd}`,
      expectedEndDate: '',
      depositAmount: '0',
      occupantCount: '1',
      actualRoomPrice: ''
    })
    setCreateError(null)
    setCreateModalOpen(true)
  }

  // Handle submit create contract
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setCreateError(null)
    setCreateSubmitting(true)

    const values = {
      roomId: parseInt(createForm.roomId),
      tenantId: parseInt(createForm.tenantId),
      startDate: createForm.startDate,
      expectedEndDate: createForm.expectedEndDate || null,
      depositAmount: parseFloat(createForm.depositAmount),
      occupantCount: parseInt(createForm.occupantCount),
      actualRoomPrice: parseFloat(createForm.actualRoomPrice)
    }

    if (isNaN(values.roomId) || isNaN(values.tenantId)) {
      setCreateError('Vui lòng chọn phòng và khách thuê')
      setCreateSubmitting(false)
      return
    }

    if (isNaN(values.depositAmount) || values.depositAmount < 0) {
      setCreateError('Tiền cọc không hợp lệ')
      setCreateSubmitting(false)
      return
    }

    if (isNaN(values.actualRoomPrice) || values.actualRoomPrice <= 0) {
      setCreateError('Giá thuê thực tế phải lớn hơn 0')
      setCreateSubmitting(false)
      return
    }

    try {
      await taoHopDong(values)
      setCreateModalOpen(false)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setCreateError(err.message || 'Lỗi khi tạo hợp đồng mới')
    } finally {
      setCreateSubmitting(false)
    }
  }

  // Handle open cancel modal
  const handleOpenCancel = (id) => {
    setCancelTargetId(id)
    setCancelReason('')
    setCancelError(null)
    setCancelModalOpen(true)
  }

  // Handle submit cancel contract
  const handleCancelSubmit = async (e) => {
    e.preventDefault()
    setCancelError(null)
    setCancelSubmitting(true)

    try {
      await huyHopDong(cancelTargetId, { reason: cancelReason.trim() || null })
      setCancelModalOpen(false)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setCancelError(err.message || 'Lỗi khi hủy hợp đồng')
    } finally {
      setCancelSubmitting(false)
    }
  }

  // Handle open checkout (end contract) wizard modal
  const handleOpenCheckout = (contract) => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')

    setCheckoutTarget(contract)
    setCheckoutStep(1)
    setCheckoutForm({
      actualEndDate: `${yyyy}-${mm}-${dd}`,
      currentReading: ''
    })
    setCheckoutPreview(null)
    setCheckoutError(null)
    setCheckoutNote('')
    setCheckoutModalOpen(true)
  }

  // Handle submit preview check-out calculations
  const handleCheckoutPreviewSubmit = async (e) => {
    e.preventDefault()
    setCheckoutError(null)
    setCheckoutLoading(true)

    const readingVal = checkoutForm.currentReading.trim()
    const currentReading = readingVal !== '' ? parseInt(readingVal) : null

    try {
      const data = await layBaoCaoKetThucHopDong(checkoutTarget.contractId, {
        actualEndDate: checkoutForm.actualEndDate,
        currentReading: currentReading
      })
      setCheckoutPreview(data)
      setCheckoutStep(2)
    } catch (err) {
      console.error(err)
      setCheckoutError(err.message || 'Lỗi khi lấy thông tin quyết toán')
    } finally {
      setCheckoutLoading(false)
    }
  }

  // Handle finalize check-out (end contract)
  const handleCheckoutFinalize = async () => {
    setCheckoutError(null)
    setCheckoutSubmitting(true)

    const readingVal = checkoutForm.currentReading.trim()
    const currentReading = readingVal !== '' ? parseInt(readingVal) : null

    try {
      await ketThucHopDong(checkoutTarget.contractId, {
        actualEndDate: checkoutForm.actualEndDate,
        currentReading: currentReading,
        note: checkoutNote.trim() || null
      })
      setCheckoutModalOpen(false)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setCheckoutError(err.message || 'Lỗi khi thanh lý hợp đồng')
    } finally {
      setCheckoutSubmitting(false)
    }
  }

  // Handle delete archived contract
  const handleDeleteContract = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn dữ liệu hợp đồng này?')) return
    
    try {
      await xoaHopDong(id)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      alert(err.message || 'Không thể xóa hợp đồng')
    }
  }

  const dinhDangTien = (so) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(so)
  }

  const layTrangThaiHopDong = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'active': return 'Đang chạy'
      case 'ended': return 'Đã thanh lý'
      case 'cancelled': return 'Đã hủy bỏ'
      default: return status || ''
    }
  }

  const layBadgeClass = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'active': return 'status-badge--success'
      case 'ended': return 'status-badge--info'
      case 'cancelled': return 'status-badge--danger'
      default: return 'status-badge--info'
    }
  }

  // Filtered contracts
  const filteredContracts = contracts.filter(c => {
    if (selectedStatus === 'all') return true
    return (c.status || '').toLowerCase() === selectedStatus.toLowerCase()
  })

  // Get list of rooms that are vacant (plus the room already in editing if necessary, but here we only create new contracts for vacant rooms)
  const vacantRooms = rooms.filter(r => r.status === 'vacant')

  return (
    <div className="page-body">
      <div className="contracts-header">
        <div>
          <h1>Hợp Đồng Thuê Phòng</h1>
          <p className="subtitle">Lập mới, chấm dứt, tính tiền quyết toán và lưu trữ lịch sử hợp đồng</p>
        </div>
        
        <button className="btn btn-primary" onClick={handleOpenCreateModal}>
          <Plus size={18} />
          <span>Tạo hợp đồng mới</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="contracts-toolbar">
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${selectedStatus === 'active' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('active')}
          >
            Đang hoạt động ({contracts.filter(c => (c.status || '').toLowerCase() === 'active').length})
          </button>
          <button 
            className={`filter-tab ${selectedStatus === 'ended' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('ended')}
          >
            Đã thanh lý ({contracts.filter(c => (c.status || '').toLowerCase() === 'ended').length})
          </button>
          <button 
            className={`filter-tab ${selectedStatus === 'cancelled' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('cancelled')}
          >
            Đã hủy bỏ ({contracts.filter(c => (c.status || '').toLowerCase() === 'cancelled').length})
          </button>
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
          <span>Đang tải hồ sơ hợp đồng...</span>
        </div>
      ) : (
        <>
          {filteredContracts.length === 0 ? (
            <div className="contracts-empty-state">
              <FileText size={64} className="empty-icon" />
              <h3>Không tìm thấy hợp đồng nào</h3>
              <p>Hệ thống không ghi nhận hợp đồng nào thuộc trạng thái này.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Phòng</th>
                    <th>Khách thuê</th>
                    <th>Giá thuê thực tế</th>
                    <th>Tiền cọc</th>
                    <th>Thời hạn</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map((c) => (
                    <tr key={c.contractId}>
                      <td>
                        <div className="contract-room-cell">
                          <Home size={15} className="cell-icon-accent" />
                          <strong>{c.roomCode}</strong>
                        </div>
                      </td>
                      <td>
                        <div className="contract-tenant-cell">
                          <User size={14} className="cell-icon" />
                          <span>{c.tenantName}</span>
                          <span className="occupant-pill">{c.occupantCount} khách</span>
                        </div>
                      </td>
                      <td>
                        <strong>{dinhDangTien(c.actualRoomPrice)}</strong>
                      </td>
                      <td>
                        <span>{dinhDangTien(c.depositAmount)}</span>
                      </td>
                      <td>
                        <div className="contract-date-cell">
                          <span>{c.startDate ? new Date(c.startDate).toLocaleDateString('vi-VN') : ''}</span>
                          <ChevronRight size={12} className="text-muted" />
                          <span>
                            {c.actualEndDate 
                              ? new Date(c.actualEndDate).toLocaleDateString('vi-VN') 
                              : c.expectedEndDate 
                              ? new Date(c.expectedEndDate).toLocaleDateString('vi-VN') 
                              : 'Dài hạn'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${layBadgeClass(c.status)}`}>
                          {layTrangThaiHopDong(c.status)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="contract-action-buttons">
                          {(c.status || '').toLowerCase() === 'active' && (
                            <>
                              <button 
                                className="btn btn-success btn-xs"
                                onClick={() => handleOpenCheckout(c)}
                                title="Thanh lý & Chốt điện nước"
                              >
                                Thanh lý (Check-out)
                              </button>
                              <button 
                                className="btn btn-secondary btn-xs"
                                onClick={() => handleOpenCancel(c.contractId)}
                                title="Hủy bỏ hợp đồng lập tức"
                              >
                                Hủy bỏ
                              </button>
                            </>
                          )}
                          
                          {(c.status || '').toLowerCase() !== 'active' && (
                            <button 
                              className="btn btn-danger btn-xs"
                              onClick={() => handleDeleteContract(c.contractId)}
                              title="Xóa vĩnh viễn"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
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

      {/* Create Contract Modal */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Lập Hợp Đồng Thuê Mới</span>
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

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="create-room">Chọn phòng *</label>
                    <select 
                      id="create-room" 
                      className="form-control"
                      required
                      value={createForm.roomId}
                      onChange={(e) => handleRoomChange(e.target.value)}
                    >
                      <option value="">-- Chọn phòng trống --</option>
                      {vacantRooms.map(r => (
                        <option key={r.roomId} value={r.roomId}>{r.roomCode} (Niêm yết: {dinhDangTien(r.listedPrice)})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="create-tenant">Chọn khách thuê đại diện *</label>
                    <select 
                      id="create-tenant" 
                      className="form-control"
                      required
                      value={createForm.tenantId}
                      onChange={(e) => setCreateForm({...createForm, tenantId: e.target.value})}
                    >
                      <option value="">-- Chọn khách thuê --</option>
                      {tenants.map(t => (
                        <option key={t.tenantId} value={t.tenantId}>{t.fullName} {t.phone ? `(${t.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="create-start">Ngày bắt đầu thuê *</label>
                    <input 
                      type="date" 
                      id="create-start" 
                      className="form-control"
                      required
                      value={createForm.startDate}
                      onChange={(e) => setCreateForm({...createForm, startDate: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="create-expected">Hạn trả phòng dự kiến</label>
                    <input 
                      type="date" 
                      id="create-expected" 
                      className="form-control"
                      placeholder="Không bắt buộc"
                      value={createForm.expectedEndDate}
                      onChange={(e) => setCreateForm({...createForm, expectedEndDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="create-price">Giá thuê thực tế (VND/tháng) *</label>
                    <input 
                      type="number" 
                      id="create-price" 
                      className="form-control"
                      required
                      value={createForm.actualRoomPrice}
                      onChange={(e) => setCreateForm({...createForm, actualRoomPrice: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="create-deposit">Tiền đặt cọc cọc giữ chỗ (VND)</label>
                    <input 
                      type="number" 
                      id="create-deposit" 
                      className="form-control"
                      required
                      value={createForm.depositAmount}
                      onChange={(e) => setCreateForm({...createForm, depositAmount: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="create-occupants">Số lượng khách lưu trú tối đa *</label>
                  <input 
                    type="number" 
                    id="create-occupants" 
                    className="form-control"
                    required
                    min="1"
                    value={createForm.occupantCount}
                    onChange={(e) => setCreateForm({...createForm, occupantCount: e.target.value})}
                  />
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
                  {createSubmitting ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      <span>Đang lập hợp đồng...</span>
                    </>
                  ) : (
                    <span>Lập hợp đồng</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Contract Modal */}
      {cancelModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Hủy Hợp Đồng Lập Tức</span>
              <button className="btn-close-modal" onClick={() => setCancelModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCancelSubmit}>
              <div className="modal-body">
                {cancelError && (
                  <div className="error-alert">
                    <AlertCircle size={18} />
                    <span>{cancelError}</span>
                  </div>
                )}
                
                <div className="warning-notice-box">
                  <AlertCircle className="text-danger" size={24} />
                  <div>
                    <h4>Cảnh báo hủy hợp đồng</h4>
                    <p>Việc hủy hợp đồng sẽ lập tức chuyển trạng thái phòng sang Trống mà không qua bước đối soát chốt tiền điện nước quyết toán.</p>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="cancel-reason">Lý do hủy hợp đồng</label>
                  <textarea 
                    id="cancel-reason" 
                    className="form-control"
                    rows="3"
                    placeholder="Nhập lý do hủy..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setCancelModalOpen(false)}
                  disabled={cancelSubmitting}
                >
                  Bỏ qua
                </button>
                <button 
                  type="submit" 
                  className="btn btn-danger"
                  disabled={cancelSubmitting}
                >
                  {cancelSubmitting ? 'Đang hủy...' : 'Đồng ý hủy hợp đồng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout (End Contract) Wizard Modal */}
      {checkoutModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content checkout-modal-size">
            <div className="modal-header">
              <span className="modal-title">
                Quyết Toán Thanh Lý Phòng {checkoutTarget?.roomCode}
              </span>
              <button className="btn-close-modal" onClick={() => setCheckoutModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {checkoutStep === 1 ? (
              <form onSubmit={handleCheckoutPreviewSubmit}>
                <div className="modal-body">
                  {checkoutError && (
                    <div className="error-alert">
                      <AlertCircle size={18} />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  <div className="checkout-wizard-steps">
                    <div className="step-indicator active">
                      <span>1</span>
                      <label>Chốt số liệu</label>
                    </div>
                    <div className="step-line"></div>
                    <div className="step-indicator">
                      <span>2</span>
                      <label>Bảng tính quyết toán</label>
                    </div>
                  </div>

                  <div className="checkout-tenant-summary-box">
                    <p>Khách hàng: <strong>{checkoutTarget?.tenantName}</strong></p>
                    <p>Ngày bắt đầu thuê: {checkoutTarget?.startDate ? new Date(checkoutTarget.startDate).toLocaleDateString('vi-VN') : ''}</p>
                    <p>Tiền đặt cọc giữ chân: <strong>{dinhDangTien(checkoutTarget?.depositAmount)}</strong></p>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="chk-end-date">Ngày trả phòng thực tế (Actual End Date) *</label>
                    <input 
                      type="date" 
                      id="chk-end-date" 
                      className="form-control"
                      required
                      value={checkoutForm.actualEndDate}
                      onChange={(e) => setCheckoutForm({...checkoutForm, actualEndDate: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="chk-reading">
                      Chỉ số điện chốt cuối cùng (Số điện hiện tại)
                    </label>
                    <input 
                      type="number" 
                      id="chk-reading" 
                      className="form-control"
                      placeholder="Nếu không nhập, hệ thống sẽ tự tính theo trung bình hoặc bỏ qua"
                      value={checkoutForm.currentReading}
                      onChange={(e) => setCheckoutForm({...checkoutForm, currentReading: e.target.value})}
                    />
                    <span className="form-help">Chỉ số này dùng để chốt tiền điện nước phát sinh từ kỳ ghi số điện gần nhất đến hôm nay.</span>
                  </div>
                </div>

                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setCheckoutModalOpen(false)}
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={checkoutLoading}
                  >
                    {checkoutLoading ? (
                      <>
                        <Loader2 className="spinner" size={16} />
                        <span>Đang tính toán...</span>
                      </>
                    ) : (
                      <>
                        <span>Tiếp tục (Xem trước quyết toán)</span>
                        <ChevronRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="modal-body">
                  {checkoutError && (
                    <div className="error-alert">
                      <AlertCircle size={18} />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  <div className="checkout-wizard-steps">
                    <div className="step-indicator completed">
                      <span>1</span>
                      <label>Chốt số liệu</label>
                    </div>
                    <div className="step-line active"></div>
                    <div className="step-indicator active">
                      <span>2</span>
                      <label>Bảng tính quyết toán</label>
                    </div>
                  </div>

                  {checkoutPreview && (
                    <div className="checkout-preview-sheet">
                      <div className="sheet-row header-row">
                        <span>Hạng mục quyết toán</span>
                        <span>Số tiền</span>
                      </div>

                      <div className="sheet-row">
                        <span>Tiền phòng phát sinh ({checkoutPreview.numberOfDays} ngày)</span>
                        <span>{dinhDangTien(checkoutPreview.roomFee)}</span>
                      </div>

                      <div className="sheet-row">
                        <span>Tiền điện chốt dư phát sinh</span>
                        <span>{dinhDangTien(checkoutPreview.electricityFee)}</span>
                      </div>

                      <div className="sheet-row">
                        <span>Tiền nước & dịch vụ khác phát sinh</span>
                        <span>{dinhDangTien(checkoutPreview.waterFee + checkoutPreview.trashFee)}</span>
                      </div>

                      <div className="sheet-row highlight-subtotal">
                        <span>Tổng hóa đơn thanh lý cuối</span>
                        <span>{dinhDangTien(checkoutPreview.finalInvoiceAmount)}</span>
                      </div>

                      <div className="sheet-row">
                        <span>Tổng tiền cọc của khách</span>
                        <span className="text-success">+{dinhDangTien(checkoutPreview.depositAmount)}</span>
                      </div>

                      <div className="sheet-row">
                        <span>Khấu trừ nợ hóa đơn (nếu có)</span>
                        <span className="text-danger">-{dinhDangTien(checkoutPreview.deductedAmount)}</span>
                      </div>

                      <div className="sheet-row final-reconcile-row">
                        {checkoutPreview.remainingAmount >= 0 ? (
                          <>
                            <span className="reconcile-label">Khách thuê cần thanh toán thêm:</span>
                            <span className="reconcile-value text-danger">{dinhDangTien(checkoutPreview.remainingAmount)}</span>
                          </>
                        ) : (
                          <>
                            <span className="reconcile-label">Chủ nhà hoàn trả lại cọc thừa cho khách:</span>
                            <span className="reconcile-value text-success">{dinhDangTien(Math.abs(checkoutPreview.remainingAmount))}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="form-group" style={{ marginTop: '20px' }}>
                    <label className="form-label" htmlFor="chk-note">Ghi chú thanh lý hợp đồng</label>
                    <input 
                      type="text" 
                      id="chk-note" 
                      className="form-control"
                      placeholder="VD: Đã bàn giao phòng sạch sẽ, chìa khóa đầy đủ"
                      value={checkoutNote}
                      onChange={(e) => setCheckoutNote(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setCheckoutStep(1)}
                    disabled={checkoutSubmitting}
                  >
                    Quay lại bước 1
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    disabled={checkoutSubmitting}
                    onClick={handleCheckoutFinalize}
                  >
                    {checkoutSubmitting ? (
                      <>
                        <Loader2 className="spinner" size={16} />
                        <span>Đang thanh lý hợp đồng...</span>
                      </>
                    ) : (
                      <span>Xác nhận Thanh lý & Chốt phòng</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
