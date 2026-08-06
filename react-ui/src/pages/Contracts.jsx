import { useState, useEffect } from 'react'
import { 
  FileText, 
  Plus, 
  Trash2, 
  X, 
  User, 
  Home, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  ChevronRight,
  Search,
  Edit3
} from 'lucide-react'
import { 
  layDanhSachHopDong, 
  taoHopDong, 
  suaHopDong,
  xoaHopDong, 
  huyHopDong, 
  layBaoCaoKetThucHopDong, 
  ketThucHopDong,
  layDanhSachPhong,
  layDanhSachNguoiThue,
  layCauHinhGia
} from '../api'
import './Contracts.css'
import { useNotification } from '../context/NotificationContext'
import { sortByRoomCode } from '../utils/roomSort'

export default function Contracts() {
  const { toast, confirm } = useNotification()
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Lists for dropdowns
  const [rooms, setRooms] = useState([])
  const [tenants, setTenants] = useState([])
  const [defaultTrashFee, setDefaultTrashFee] = useState(0)
  const [defaultWaterFeePerPerson, setDefaultWaterFeePerPerson] = useState(0)
  
  // Filtering
  const [selectedStatus, setSelectedStatus] = useState('active')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Create Contract Modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    roomId: '',
    tenantId: '',
    startDate: '',
    expectedEndDate: '',
    depositAmount: '0',
    depositPaidAmount: '0',
    occupantCount: '1',
    customWaterFee: '',
    actualRoomPrice: '',
    trashFee: '0'
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
    currentReading: '',
    discountAmount: '0'
  })
  const [checkoutPreview, setCheckoutPreview] = useState(null)
  const [checkoutError, setCheckoutError] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutNote, setCheckoutNote] = useState('')
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)

  // Edit Contract Modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editTargetId, setEditTargetId] = useState(null)
  const [editForm, setEditForm] = useState({
    roomId: '',
    tenantId: '',
    startDate: '',
    expectedEndDate: '',
    depositAmount: '0',
    depositPaidAmount: '0',
    occupantCount: '1',
    customWaterFee: '',
    actualRoomPrice: '',
    trashFee: '0',
    status: 'Active'
  })
  const [editError, setEditError] = useState(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  const taiDuLieu = async () => {
    setLoading(true)
    setError(null)
    try {
      const [contractsData, roomsData, tenantsData, pricingData] = await Promise.all([
        layDanhSachHopDong(null, null, true), // includeArchived
        layDanhSachPhong(),
        layDanhSachNguoiThue(),
        layCauHinhGia()
      ])
      setContracts(sortByRoomCode(contractsData))
      setRooms(sortByRoomCode(roomsData))
      setTenants(tenantsData)
      setDefaultTrashFee(Number(pricingData?.trashFee) || 0)
      setDefaultWaterFeePerPerson(Number(pricingData?.waterFeePerPerson) || 0)
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
      actualRoomPrice: room ? room.listedPrice.toString() : '',
      depositAmount: room ? room.listedPrice.toString() : '0',
      depositPaidAmount: room ? room.listedPrice.toString() : '0',
      trashFee: prev.trashFee || String(defaultTrashFee)
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
      depositPaidAmount: '0',
      occupantCount: '1',
      customWaterFee: '',
      actualRoomPrice: '',
      trashFee: String(defaultTrashFee)
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
      depositPaidAmount: parseFloat(createForm.depositPaidAmount),
      occupantCount: parseInt(createForm.occupantCount),
      customWaterFee: createForm.customWaterFee === '' ? null : parseFloat(createForm.customWaterFee),
      actualRoomPrice: parseFloat(createForm.actualRoomPrice),
      trashFee: parseFloat(createForm.trashFee)
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

    if (isNaN(values.depositPaidAmount) || values.depositPaidAmount < 0 || values.depositPaidAmount > values.depositAmount) {
      setCreateError('Tiền cọc đã nhận phải từ 0 đến số tiền cọc phải thu')
      setCreateSubmitting(false)
      return
    }

    if (isNaN(values.actualRoomPrice) || values.actualRoomPrice <= 0) {
      setCreateError('Giá thuê thực tế phải lớn hơn 0')
      setCreateSubmitting(false)
      return
    }

    if (values.customWaterFee !== null && (isNaN(values.customWaterFee) || values.customWaterFee < 0)) {
      setCreateError('Tiền nước tùy chỉnh không hợp lệ')
      setCreateSubmitting(false)
      return
    }

    if (isNaN(values.trashFee) || values.trashFee < 0) {
      setCreateError('Tiền rác không hợp lệ')
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

  // Handle open edit contract modal
  const handleOpenEdit = (contract) => {
    setEditTargetId(contract.contractId)
    setEditForm({
      roomId: contract.roomId || '',
      tenantId: contract.tenantId || '',
      startDate: contract.startDate ? contract.startDate.substring(0, 10) : '',
      expectedEndDate: contract.expectedEndDate ? contract.expectedEndDate.substring(0, 10) : '',
      depositAmount: String(contract.depositAmount || 0),
      depositPaidAmount: String(contract.depositPaidAmount || 0),
      occupantCount: String(contract.occupantCount || 1),
      customWaterFee: contract.customWaterFee == null ? '' : String(contract.customWaterFee),
      actualRoomPrice: String(contract.actualRoomPrice || 0),
      trashFee: String(contract.trashFee || 0),
      status: contract.status || 'Active'
    })
    setEditError(null)
    setEditModalOpen(true)
  }

  // Handle submit edit contract
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditError(null)
    setEditSubmitting(true)

    const dto = {
      startDate: editForm.startDate || null,
      expectedEndDate: editForm.expectedEndDate || null,
      depositAmount: parseFloat(editForm.depositAmount) || 0,
      depositPaidAmount: parseFloat(editForm.depositPaidAmount) || 0,
      occupantCount: parseInt(editForm.occupantCount) || 1,
      customWaterFee: editForm.customWaterFee === '' ? null : parseFloat(editForm.customWaterFee),
      actualRoomPrice: parseFloat(editForm.actualRoomPrice) || 0,
      trashFee: parseFloat(editForm.trashFee) || 0,
      status: editForm.status
    }

    if (isNaN(dto.actualRoomPrice) || dto.actualRoomPrice <= 0) {
      setEditError('Giá thuê thực tế phải lớn hơn 0')
      setEditSubmitting(false)
      return
    }

    if (dto.depositPaidAmount < 0 || dto.depositPaidAmount > dto.depositAmount) {
      setEditError('Tiền cọc đã nhận phải từ 0 đến số tiền cọc phải thu')
      setEditSubmitting(false)
      return
    }

    if (dto.customWaterFee !== null && (isNaN(dto.customWaterFee) || dto.customWaterFee < 0)) {
      setEditError('Tiền nước tùy chỉnh không hợp lệ')
      setEditSubmitting(false)
      return
    }

    if (dto.trashFee < 0) {
      setEditError('Tiền rác không hợp lệ')
      setEditSubmitting(false)
      return
    }

    try {
      await suaHopDong(editTargetId, dto)
      setEditModalOpen(false)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setEditError(err.message || 'Lỗi khi chỉnh sửa hợp đồng')
    } finally {
      setEditSubmitting(false)
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
      currentReading: '',
      discountAmount: '0'
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
    const discountAmount = parseFloat(checkoutForm.discountAmount) || 0

    try {
      const data = await layBaoCaoKetThucHopDong(checkoutTarget.contractId, {
        actualEndDate: checkoutForm.actualEndDate,
        currentReading: currentReading,
        discountAmount
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
    const discountAmount = parseFloat(checkoutForm.discountAmount) || 0

    try {
      await ketThucHopDong(checkoutTarget.contractId, {
        actualEndDate: checkoutForm.actualEndDate,
        currentReading: currentReading,
        discountAmount,
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
    const isConfirmed = await confirm('Bạn có chắc chắn muốn xóa vĩnh viễn dữ liệu hợp đồng này?', 'Xác nhận xóa hợp đồng')
    if (!isConfirmed) return
    
    try {
      await xoaHopDong(id)
      taiDuLieu()
      toast.success('Đã xóa dữ liệu hợp đồng thành công')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Không thể xóa hợp đồng')
    }
  }

  const dinhDangTien = (so) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(so)
  }

  const layTrangThaiHopDong = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'active': return 'Còn hạn'
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
  const filteredContracts = sortByRoomCode(contracts.filter(c => {
    const matchesStatus = selectedStatus === 'all' || (c.status || '').toLowerCase() === selectedStatus.toLowerCase()
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const matchesSearch = !normalizedQuery || [c.roomCode, c.tenantName, c.contractId]
      .some(value => String(value || '').toLowerCase().includes(normalizedQuery))

    return matchesStatus && matchesSearch
  }))

  const contractCounts = {
    all: contracts.length,
    active: contracts.filter(c => (c.status || '').toLowerCase() === 'active').length,
    ended: contracts.filter(c => (c.status || '').toLowerCase() === 'ended').length,
    cancelled: contracts.filter(c => (c.status || '').toLowerCase() === 'cancelled').length
  }

  // Get list of rooms that are vacant (plus the room already in editing if necessary, but here we only create new contracts for vacant rooms)
  const vacantRooms = sortByRoomCode(rooms.filter(r => r.status === 'vacant'))

  return (
    <div className="page-body contracts-page">
      <section className="contracts-header">
        <div className="contracts-heading">
          <span className="page-eyebrow">Quản lý lưu trú</span>
          <h1>
            <FileText size={26} aria-hidden="true" />
            Hợp đồng thuê phòng
          </h1>
          <p className="subtitle">Theo dõi thông tin, chi phí và vòng đời hợp đồng tại một nơi.</p>
        </div>
        
        <button className="btn btn-primary contracts-create-button" onClick={handleOpenCreateModal}>
          <Plus size={18} />
          <span>Tạo hợp đồng mới</span>
        </button>
      </section>

      {/* Filter Toolbar */}
      <section className="contracts-toolbar" aria-label="Bộ lọc hợp đồng">
        <div className="contracts-filter-tabs" role="group" aria-label="Lọc theo trạng thái">
          <button
            className={`contracts-filter-tab ${selectedStatus === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('all')}
          >
            <span>Tất cả</span>
            <strong>{contractCounts.all}</strong>
          </button>
          <button 
            className={`contracts-filter-tab ${selectedStatus === 'active' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('active')}
          >
            <span>Đang hoạt động</span>
            <strong>{contractCounts.active}</strong>
          </button>
          <button 
            className={`contracts-filter-tab ${selectedStatus === 'ended' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('ended')}
          >
            <span>Đã thanh lý</span>
            <strong>{contractCounts.ended}</strong>
          </button>
          <button 
            className={`contracts-filter-tab ${selectedStatus === 'cancelled' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('cancelled')}
          >
            <span>Đã hủy</span>
            <strong>{contractCounts.cancelled}</strong>
          </button>
        </div>

        <label className="contracts-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm phòng, khách thuê, mã HĐ..."
            aria-label="Tìm kiếm hợp đồng"
          />
        </label>
      </section>

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
            <div className="table-container contracts-table-container">
              <table className="custom-table contracts-table">
                <colgroup>
                  <col className="contracts-col-identity" />
                  <col className="contracts-col-cost" />
                  <col className="contracts-col-deposit" />
                  <col className="contracts-col-term" />
                  <col className="contracts-col-status" />
                  <col className="contracts-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Hợp đồng</th>
                    <th>Chi phí hàng tháng</th>
                    <th>Tiền cọc</th>
                    <th>Thời hạn</th>
                    <th>Trạng thái</th>
                    <th>Chức năng</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map((c) => (
                    <tr key={c.contractId}>
                      <td data-label="Hợp đồng">
                        <div className="contract-room-cell">
                          <Home size={15} className="cell-icon-accent" />
                          <strong>Phòng {c.roomCode}</strong>
                        </div>
                        <div className="contract-tenant-cell">
                          <User size={14} className="cell-icon" />
                          <span>{c.tenantName}</span>
                        </div>
                        <span className="contract-occupants">{c.occupantCount || 1} người ở</span>
                      </td>
                      <td data-label="Chi phí hàng tháng">
                        <div className="contract-cost-cell">
                          <strong>{dinhDangTien(c.actualRoomPrice)}<small>/tháng</small></strong>
                          <span>Nước: {dinhDangTien(c.customWaterFee ?? (defaultWaterFeePerPerson * c.occupantCount))}</span>
                          <span>Rác: {dinhDangTien(c.trashFee || 0)}</span>
                        </div>
                      </td>
                      <td data-label="Tiền cọc">
                        <div className="contract-deposit-cell">
                          <strong>{dinhDangTien(c.depositPaidAmount)}</strong>
                          <span>Đã nhận / {dinhDangTien(c.depositAmount)}</span>
                          {c.depositDebtAmount > 0
                            ? <span className="text-danger">Còn thiếu {dinhDangTien(c.depositDebtAmount)}</span>
                            : <span className="contract-paid-label">Đã thu đủ</span>}
                        </div>
                      </td>
                      <td data-label="Thời hạn">
                        <div className="contract-date-cell">
                          <span className="contract-date-value">{c.startDate ? new Date(c.startDate).toLocaleDateString('vi-VN') : 'Chưa có'}</span>
                          <ChevronRight size={14} className="text-muted" aria-hidden="true" />
                          <span className="contract-date-value">
                            {c.actualEndDate 
                              ? new Date(c.actualEndDate).toLocaleDateString('vi-VN') 
                              : c.expectedEndDate 
                              ? new Date(c.expectedEndDate).toLocaleDateString('vi-VN') 
                              : 'Dài hạn'}
                          </span>
                        </div>
                      </td>
                      <td data-label="Trạng thái">
                        <span className={`status-badge ${layBadgeClass(c.status)}`}>
                          {layTrangThaiHopDong(c.status)}
                        </span>
                      </td>
                      <td data-label="Chức năng">
                        <div className="contract-action-buttons">
                          {(c.status || '').toLowerCase() === 'active' && (
                            <>
                              <button 
                                className="btn btn-success contract-action-button contract-action-button--finish"
                                onClick={() => handleOpenCheckout(c)}
                                title="Thanh lý & Chốt điện nước"
                              >
                                <CheckCircle2 size={14} />
                                <span>Kết thúc</span>
                              </button>
                              <button 
                                className="btn btn-secondary contract-action-button"
                                onClick={() => handleOpenEdit(c)}
                                title="Sửa thông tin hợp đồng"
                              >
                                <Edit3 size={14} />
                                <span>Sửa</span>
                              </button>
                              <button 
                                className="btn btn-secondary contract-action-button"
                                onClick={() => handleOpenCancel(c.contractId)}
                                title="Hủy bỏ hợp đồng lập tức"
                              >
                                <X size={14} />
                                <span>Hủy</span>
                              </button>
                            </>
                          )}
                          
                          {(c.status || '').toLowerCase() !== 'active' && (
                            <button 
                              className="btn btn-danger contract-action-button contract-action-button--delete"
                              onClick={() => handleDeleteContract(c.contractId)}
                              title="Xóa vĩnh viễn"
                            >
                              <Trash2 size={14} />
                              <span>Xóa dữ liệu</span>
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
                  <label className="form-label" htmlFor="create-trash-fee">Tiền rác theo phòng (VND/tháng) *</label>
                  <input
                    type="number"
                    id="create-trash-fee"
                    className="form-control"
                    required
                    min="0"
                    value={createForm.trashFee}
                    onChange={(e) => setCreateForm({...createForm, trashFee: e.target.value})}
                  />
                  <span className="form-help">Mặc định lấy từ cấu hình giá, có thể chỉnh riêng cho từng hợp đồng.</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="create-custom-water-fee">Tiền nước tùy chỉnh (VND/tháng)</label>
                  <input
                    type="number"
                    id="create-custom-water-fee"
                    className="form-control"
                    min="0"
                    placeholder="Để trống để tính theo số người"
                    value={createForm.customWaterFee}
                    onChange={(e) => setCreateForm({...createForm, customWaterFee: e.target.value})}
                  />
                  <span className="form-help">
                    Để trống: {dinhDangTien(defaultWaterFeePerPerson)} × {Number(createForm.occupantCount) || 0} người = {dinhDangTien(defaultWaterFeePerPerson * (Number(createForm.occupantCount) || 0))}/tháng.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="create-deposit-paid">Tiền cọc đã nhận (VND)</label>
                  <input
                    type="number"
                    id="create-deposit-paid"
                    className="form-control"
                    required
                    min="0"
                    max={createForm.depositAmount || undefined}
                    value={createForm.depositPaidAmount}
                    onChange={(e) => setCreateForm({...createForm, depositPaidAmount: e.target.value})}
                  />
                  {Number(createForm.depositAmount) > Number(createForm.depositPaidAmount) && (
                    <span className="form-help text-danger">
                      Nợ tiền cọc sẽ đưa vào hóa đơn tiếp theo: {dinhDangTien(Number(createForm.depositAmount) - Number(createForm.depositPaidAmount))}
                    </span>
                  )}
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
                  <div className="form-group">
                    <label className="form-label" htmlFor="chk-discount">{'Gi\u1ea3m tr\u1eeb thanh l\u00fd (\u0111)'}</label>
                    <input
                      type="number"
                      id="chk-discount"
                      className="form-control"
                      min="0"
                      placeholder={'Nh\u1eadp s\u1ed1 ti\u1ec1n gi\u1ea3m tr\u1eeb n\u1ebfu c\u00f3'}
                      value={checkoutForm.discountAmount}
                      onChange={(e) => setCheckoutForm({...checkoutForm, discountAmount: e.target.value})}
                      onWheel={(e) => e.target.blur()}
                    />
                    <span className="form-help">{'S\u1ed1 ti\u1ec1n n\u00e0y s\u1ebd tr\u1eeb v\u00e0o t\u1ed5ng ph\u00ed thanh l\u00fd tr\u01b0\u1edbc khi c\u1ea5n tr\u1eeb ti\u1ec1n c\u1ecdc.'}</span>
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

                      {checkoutPreview.discountAmount > 0 && (
                        <div className="sheet-row">
                          <span>Giảm trừ thanh lý</span>
                          <span className="text-success">-{dinhDangTien(checkoutPreview.discountAmount)}</span>
                        </div>
                      )}

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
                        {checkoutPreview.depositAmount > checkoutPreview.deductedAmount ? (
                          <>
                            <span className="reconcile-label">Số tiền cần trả lại khách:</span>
                            <span className="reconcile-value text-success">{dinhDangTien(checkoutPreview.refundedAmount)}</span>
                          </>
                        ) : (
                          <>
                            <span className="reconcile-label">Khách thuê cần thanh toán thêm:</span>
                            <span className="reconcile-value text-danger">{dinhDangTien(checkoutPreview.remainingAmount)}</span>
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

      {/* Edit Contract Modal */}
      {editModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Chỉnh Sửa Hợp Đồng</span>
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
                    <label className="form-label" htmlFor="edit-start-date">Ngày bắt đầu *</label>
                    <input 
                      type="date" 
                      id="edit-start-date" 
                      className="form-control"
                      required
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({...editForm, startDate: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-end-date">Ngày kết thúc dự kiến</label>
                    <input 
                      type="date" 
                      id="edit-end-date" 
                      className="form-control"
                      value={editForm.expectedEndDate}
                      onChange={(e) => setEditForm({...editForm, expectedEndDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-room-price">Giá thuê thực tế (đ/tháng) *</label>
                    <input 
                      type="number" 
                      id="edit-room-price" 
                      className="form-control"
                      required
                      min="0"
                      value={editForm.actualRoomPrice}
                      onChange={(e) => setEditForm({...editForm, actualRoomPrice: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-deposit">Tiền đặt cọc (đ)</label>
                    <input 
                      type="number" 
                      id="edit-deposit" 
                      className="form-control"
                      min="0"
                      value={editForm.depositAmount}
                      onChange={(e) => setEditForm({...editForm, depositAmount: e.target.value})}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-trash-fee">Tiền rác theo phòng (đ/tháng) *</label>
                  <input
                    type="number"
                    id="edit-trash-fee"
                    className="form-control"
                    required
                    min="0"
                    value={editForm.trashFee}
                    onChange={(e) => setEditForm({...editForm, trashFee: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-custom-water-fee">Tiền nước tùy chỉnh (đ/tháng)</label>
                  <input
                    type="number"
                    id="edit-custom-water-fee"
                    className="form-control"
                    min="0"
                    placeholder="Để trống để tính theo số người"
                    value={editForm.customWaterFee}
                    onChange={(e) => setEditForm({...editForm, customWaterFee: e.target.value})}
                  />
                  <span className="form-help">
                    Để trống: {dinhDangTien(defaultWaterFeePerPerson)} × {Number(editForm.occupantCount) || 0} người = {dinhDangTien(defaultWaterFeePerPerson * (Number(editForm.occupantCount) || 0))}/tháng.
                  </span>
                </div>


                <div className="form-group">
                  <label className="form-label" htmlFor="edit-deposit-paid">Tiền cọc đã nhận (đ)</label>
                  <input
                    type="number"
                    id="edit-deposit-paid"
                    className="form-control"
                    min="0"
                    max={editForm.depositAmount || undefined}
                    value={editForm.depositPaidAmount}
                    onChange={(e) => setEditForm({...editForm, depositPaidAmount: e.target.value})}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-occupants">Số lượng người ở *</label>
                    <input 
                      type="number" 
                      id="edit-occupants" 
                      className="form-control"
                      required
                      min="1"
                      value={editForm.occupantCount}
                      onChange={(e) => setEditForm({...editForm, occupantCount: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-status">Trạng thái *</label>
                    <select 
                      id="edit-status" 
                      className="form-control"
                      required
                      value={editForm.status}
                      onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                    >
                      <option value="Active">Còn hạn</option>
                      <option value="Ended">Kết thúc hợp đồng</option>
                      <option value="Cancelled">Hủy bỏ</option>
                    </select>
                  </div>
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
                  {editSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
