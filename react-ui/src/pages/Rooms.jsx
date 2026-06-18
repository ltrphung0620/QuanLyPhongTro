import React, { useState, useEffect } from 'react'
import { 
  Home, 
  Plus, 
  Search, 
  Edit3, 
  FileText, 
  User, 
  Calendar, 
  DollarSign, 
  ShieldAlert,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import { 
  layDanhSachPhong, 
  themPhong, 
  suaPhong, 
  layHopDongActiveCuaPhong 
} from '../api'
import './Rooms.css'

export default function Rooms() {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Filtering and Searching
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Drawer state
  const [activeRoom, setActiveRoom] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [activeContract, setActiveContract] = useState(null)
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editRoomId, setEditRoomId] = useState(null)
  const [formValues, setFormValues] = useState({
    roomCode: '',
    listedPrice: '',
    status: 'vacant'
  })
  const [formError, setFormError] = useState(null)
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Fetch rooms list
  const taiDanhSachPhong = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await layDanhSachPhong()
      setRooms(data)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Không thể tải danh sách phòng')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    taiDanhSachPhong()
  }, [])

  // Open drawer and load contract details if occupied
  const handleRoomClick = async (room) => {
    setActiveRoom(room)
    setActiveContract(null)
    
    if (room.status === 'occupied') {
      setDrawerLoading(true)
      try {
        const contract = await layHopDongActiveCuaPhong(room.roomCode)
        setActiveContract(contract)
      } catch (err) {
        console.warn('Không tìm thấy hợp đồng đang hoạt động cho phòng này:', err)
        setActiveContract(null)
      } finally {
        setDrawerLoading(false)
      }
    }
  }

  // Open Add Room Modal
  const handleOpenAddModal = () => {
    setIsEditMode(false)
    setFormValues({
      roomCode: '',
      listedPrice: '',
      status: 'vacant'
    })
    setFormError(null)
    setModalOpen(true)
  }

  // Open Edit Room Modal
  const handleOpenEditModal = (e, room) => {
    e.stopPropagation() // Prevent opening drawer
    setIsEditMode(true)
    setEditRoomId(room.roomId)
    setFormValues({
      roomCode: room.roomCode,
      listedPrice: room.listedPrice,
      status: room.status
    })
    setFormError(null)
    setModalOpen(true)
  }

  // Handle submit form
  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setFormSubmitting(true)
    setFormError(null)
    
    const priceNumber = parseFloat(formValues.listedPrice)
    if (isNaN(priceNumber) || priceNumber < 0) {
      setFormError('Giá niêm yết phải là số dương')
      setFormSubmitting(false)
      return
    }

    try {
      if (isEditMode) {
        await suaPhong(editRoomId, {
          roomCode: formValues.roomCode.trim(),
          listedPrice: priceNumber,
          status: formValues.status
        })
      } else {
        await themPhong({
          roomCode: formValues.roomCode.trim(),
          listedPrice: priceNumber,
          status: formValues.status
        })
      }
      
      setModalOpen(false)
      // Reload rooms and update active room if open
      await taiDanhSachPhong()
      if (activeRoom && activeRoom.roomId === editRoomId) {
        // Refresh active room details
        const updated = rooms.find(r => r.roomId === editRoomId)
        if (updated) setActiveRoom(updated)
      }
    } catch (err) {
      console.error(err)
      setFormError(err.message || 'Lỗi khi lưu thông tin phòng')
    } finally {
      setFormSubmitting(false)
    }
  }

  const dinhDangTien = (so) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(so)
  }

  const layTenTrangThai = (status) => {
    switch(status) {
      case 'vacant': return 'Trống'
      case 'occupied': return 'Đang thuê'
      case 'maintenance': return 'Bảo trì'
      default: return status
    }
  }

  const layBadgeClass = (status) => {
    switch(status) {
      case 'vacant': return 'status-badge--success'
      case 'occupied': return 'status-badge--info'
      case 'maintenance': return 'status-badge--warning'
      default: return 'status-badge--info'
    }
  }

  // Filtered rooms
  const filteredRooms = rooms.filter(room => {
    const matchesStatus = selectedStatus === 'all' || room.status === selectedStatus
    const matchesSearch = room.roomCode.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  return (
    <div className="page-body">
      <div className="rooms-header">
        <div>
          <h1>Quản Lý Phòng</h1>
          <p className="subtitle">Xem trạng thái, bảng giá và thông tin khách thuê chi tiết</p>
        </div>
        
        <button className="btn btn-primary" onClick={handleOpenAddModal}>
          <Plus size={18} />
          <span>Thêm phòng mới</span>
        </button>
      </div>

      {/* Filter and Search Section */}
      <div className="rooms-toolbar">
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${selectedStatus === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('all')}
          >
            Tất cả ({rooms.length})
          </button>
          <button 
            className={`filter-tab ${selectedStatus === 'vacant' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('vacant')}
          >
            Trống ({rooms.filter(r => r.status === 'vacant').length})
          </button>
          <button 
            className={`filter-tab ${selectedStatus === 'occupied' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('occupied')}
          >
            Đang thuê ({rooms.filter(r => r.status === 'occupied').length})
          </button>
          <button 
            className={`filter-tab ${selectedStatus === 'maintenance' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('maintenance')}
          >
            Bảo trì ({rooms.filter(r => r.status === 'maintenance').length})
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
          <ShieldAlert size={20} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <Loader2 className="spinner" size={36} />
          <span>Đang tải danh sách phòng...</span>
        </div>
      ) : (
        <>
          {filteredRooms.length === 0 ? (
            <div className="rooms-empty-state">
              <Home size={64} className="empty-icon" />
              <h3>Không tìm thấy phòng nào</h3>
              <p>Thử đổi bộ lọc hoặc thêm phòng mới vào hệ thống.</p>
            </div>
          ) : (
            <div className="rooms-grid">
              {filteredRooms.map((room) => (
                <div 
                  key={room.roomId} 
                  className={`room-card ${room.status} ${activeRoom?.roomId === room.roomId ? 'selected' : ''}`}
                  onClick={() => handleRoomClick(room)}
                >
                  <div className="room-card-header">
                    <span className="room-number">{room.roomCode}</span>
                    <span className={`status-badge ${layBadgeClass(room.status)}`}>
                      {layTenTrangThai(room.status)}
                    </span>
                  </div>
                  
                  <div className="room-card-body">
                    <div className="price-label">Giá thuê niêm yết:</div>
                    <div className="room-price">{dinhDangTien(room.listedPrice)}</div>
                  </div>

                  <div className="room-card-actions">
                    <button 
                      className="btn-card-edit" 
                      onClick={(e) => handleOpenEditModal(e, room)}
                      title="Sửa thông tin phòng"
                    >
                      <Edit3 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Sliding Details Drawer */}
      {activeRoom && (
        <>
          <div className="drawer-overlay" onClick={() => setActiveRoom(null)}></div>
          <div className="drawer-content">
            <div className="drawer-header">
              <div className="drawer-header-left">
                <span className="drawer-title">Phòng {activeRoom.roomCode}</span>
                <span className={`status-badge ${layBadgeClass(activeRoom.status)}`}>
                  {layTenTrangThai(activeRoom.status)}
                </span>
              </div>
              <button className="btn-close-drawer" onClick={() => setActiveRoom(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body">
              <div className="drawer-section">
                <h3 className="section-title-mini">Thông tin cơ bản</h3>
                <div className="detail-info-list">
                  <div className="detail-info-item">
                    <span className="detail-label">Giá niêm yết:</span>
                    <span className="detail-val">{dinhDangTien(activeRoom.listedPrice)}/tháng</span>
                  </div>
                  <div className="detail-info-item">
                    <span className="detail-label">Mã số phòng:</span>
                    <span className="detail-val">{activeRoom.roomCode}</span>
                  </div>
                </div>
              </div>

              {activeRoom.status === 'occupied' && (
                <div className="drawer-section">
                  <h3 className="section-title-mini">Hợp đồng thuê hiện tại</h3>
                  
                  {drawerLoading ? (
                    <div className="drawer-loading">
                      <Loader2 className="spinner" size={24} />
                      <span>Đang tải thông tin hợp đồng...</span>
                    </div>
                  ) : activeContract ? (
                    <div className="contract-mini-card">
                      <div className="contract-field">
                        <User size={16} className="field-icon" />
                        <div>
                          <label>Khách đại diện thuê</label>
                          <span>{activeContract.tenantName || 'Không rõ tên'}</span>
                        </div>
                      </div>

                      <div className="contract-field">
                        <Calendar size={16} className="field-icon" />
                        <div>
                          <label>Thời hạn thuê</label>
                          <span>
                            {activeContract.startDate ? new Date(activeContract.startDate).toLocaleDateString('vi-VN') : 'N/A'} - {activeContract.endDate ? new Date(activeContract.endDate).toLocaleDateString('vi-VN') : 'Dài hạn'}
                          </span>
                        </div>
                      </div>

                      <div className="contract-field">
                        <DollarSign size={16} className="field-icon" />
                        <div>
                          <label>Giá thuê thỏa thuận</label>
                          <span>{dinhDangTien(activeContract.rentalPrice)}/tháng</span>
                        </div>
                      </div>

                      <div className="contract-field">
                        <CheckCircle2 size={16} className="field-icon" />
                        <div>
                          <label>Tiền cọc giữ chỗ</label>
                          <span>{dinhDangTien(activeContract.depositAmount)}</span>
                        </div>
                      </div>
                      
                      <div className="contract-actions-list">
                        <Link to="/contracts" className="btn btn-secondary btn-full">
                          <FileText size={16} />
                          <span>Chi tiết Hợp đồng</span>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="contract-empty-warning">
                      <AlertTriangle className="text-warning" size={24} />
                      <p>Không tìm thấy hợp đồng đang hoạt động hợp lệ cho phòng đang thuê này.</p>
                      <Link to="/contracts" className="btn btn-primary btn-full">Tạo hợp đồng ngay</Link>
                    </div>
                  )}
                </div>
              )}

              {activeRoom.status === 'vacant' && (
                <div className="drawer-section vacant-cta-section">
                  <CheckCircle2 className="cta-icon text-success" size={48} />
                  <h3>Sẵn sàng đón khách</h3>
                  <p>Phòng này đang trống. Bạn có thể tạo hợp đồng mới để làm thủ tục nhận phòng cho khách thuê.</p>
                  <Link to="/contracts" className="btn btn-primary">
                    <Plus size={16} />
                    <span>Lập hợp đồng thuê mới</span>
                  </Link>
                </div>
              )}
            </div>
            
            <div className="drawer-footer">
              <button 
                className="btn btn-secondary btn-full"
                onClick={(e) => {
                  setActiveRoom(null);
                  handleOpenEditModal(e, activeRoom);
                }}
              >
                Sửa thông tin phòng
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">
                {isEditMode ? `Cập nhật Phòng ${formValues.roomCode}` : 'Thêm phòng trọ mới'}
              </span>
              <button className="btn-close-modal" onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="error-alert">
                    <ShieldAlert size={18} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="roomCode">Mã số/Tên phòng</label>
                  <input 
                    type="text" 
                    id="roomCode" 
                    className="form-control"
                    placeholder="Ví dụ: P101, Phòng 102"
                    required
                    value={formValues.roomCode}
                    onChange={(e) => setFormValues({...formValues, roomCode: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="listedPrice">Giá cho thuê niêm yết (VND/tháng)</label>
                  <input 
                    type="number" 
                    id="listedPrice" 
                    className="form-control"
                    placeholder="Ví dụ: 2500000"
                    required
                    value={formValues.listedPrice}
                    onChange={(e) => setFormValues({...formValues, listedPrice: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="status">Trạng thái phòng</label>
                  <select 
                    id="status" 
                    className="form-control"
                    value={formValues.status}
                    onChange={(e) => setFormValues({...formValues, status: e.target.value})}
                  >
                    <option value="vacant">Trống (Sẵn sàng cho thuê)</option>
                    <option value="occupied">Đang thuê</option>
                    <option value="maintenance">Đang bảo trì/sửa chữa</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu thông tin</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
