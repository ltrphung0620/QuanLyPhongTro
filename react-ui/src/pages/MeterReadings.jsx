import React, { useState, useEffect } from 'react'
import { 
  Zap, 
  Search, 
  Trash2, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Calendar,
  Layers,
  FileText
} from 'lucide-react'
import { 
  layChiSoThang, 
  layChiSoConThieu, 
  nhapChiSoDienNuoc, 
  previewChiSoDienNuoc, 
  xoaChiSoDienNuoc,
  layDanhSachHopDong
} from '../api'
import './MeterReadings.css'

export default function MeterReadings() {
  const [thang, setThang] = useState(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    return `${yyyy}-${mm}`
  })
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [recordedReadings, setRecordedReadings] = useState([])
  const [missingRooms, setMissingRooms] = useState([])
  const [activeContracts, setActiveContracts] = useState([])
  
  // Tab/Filter
  const [activeTab, setActiveTab] = useState('missing') // 'missing' or 'recorded'
  const [searchQuery, setSearchQuery] = useState('')
  
  // Log Reading Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTarget, setModalTarget] = useState(null) // room object
  const [previousReading, setPreviousReading] = useState(0)
  const [previousReadingLoading, setPreviousReadingLoading] = useState(false)
  const [currentReadingInput, setCurrentReadingInput] = useState('')
  const [modalError, setModalError] = useState(null)
  const [modalSubmitting, setModalSubmitting] = useState(false)

  const taiDuLieu = async () => {
    setLoading(true)
    setError(null)
    const formattedMonth = `${thang}-01`
    try {
      const [readings, missing, contracts] = await Promise.all([
        layChiSoThang(formattedMonth),
        layChiSoConThieu(formattedMonth),
        layDanhSachHopDong('active')
      ])
      
      setRecordedReadings(readings)
      setMissingRooms(missing)
      setActiveContracts(contracts)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Không thể tải dữ liệu ghi số điện nước')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    taiDuLieu()
  }, [thang])

  // Get active contract for a room
  const timHopDongPhong = (roomId) => {
    return activeContracts.find(c => c.roomId === roomId)
  }

  // Open log reading modal and fetch previous reading using the preview API hack
  const handleOpenLogModal = async (room) => {
    setModalTarget(room)
    setCurrentReadingInput('')
    setModalError(null)
    setPreviousReading(0)
    setPreviousReadingLoading(true)
    setModalOpen(true)
    
    const contract = timHopDongPhong(room.roomId)
    if (!contract) {
      setModalError('Phòng này không có hợp đồng hoạt động. Vui lòng lập hợp đồng trước.')
      setPreviousReadingLoading(false)
      return
    }

    try {
      // Call preview API with a high number to extract the previous reading safely
      const preview = await previewChiSoDienNuoc({
        roomId: room.roomId,
        contractId: contract.contractId,
        billingMonth: `${thang}-01`,
        currentReading: 999999
      })
      setPreviousReading(preview.previousReading)
    } catch (err) {
      console.warn('Lỗi khi lấy chỉ số cũ:', err)
      // Check if already has data
      if (err.message && err.message.includes('Đã có dữ liệu')) {
        setModalError('Phòng này đã có chỉ số điện tháng này.')
      } else {
        // Fallback to 0 if new room/contract
        setPreviousReading(0)
      }
    } finally {
      setPreviousReadingLoading(false)
    }
  }

  // Handle submit reading
  const handleLogSubmit = async (e) => {
    e.preventDefault()
    setModalSubmitting(true)
    setModalError(null)

    const contract = timHopDongPhong(modalTarget.roomId)
    const currentVal = parseInt(currentReadingInput)

    if (isNaN(currentVal) || currentVal < previousReading) {
      setModalError(`Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ (${previousReading})`)
      setModalSubmitting(false)
      return
    }

    try {
      await nhapChiSoDienNuoc({
        roomId: modalTarget.roomId,
        contractId: contract.contractId,
        billingMonth: `${thang}-01`,
        currentReading: currentVal
      })
      
      setModalOpen(false)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setModalError(err.message || 'Lỗi khi nhập chỉ số điện')
    } finally {
      setModalSubmitting(false)
    }
  }

  // Handle delete reading
  const handleDeleteReading = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa chỉ số điện đã ghi này? Việc này có thể ảnh hưởng đến hóa đơn chưa thu.')) return
    
    try {
      await xoaChiSoDienNuoc(id)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      alert(err.message || 'Lỗi khi xóa chỉ số')
    }
  }

  const dinhDangTien = (so) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(so)
  }

  // Filter lists based on search query
  const filteredMissing = missingRooms.filter(r => 
    r.roomCode.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredRecorded = recordedReadings.filter(r => 
    r.roomCode.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const inputReading = parseInt(currentReadingInput) || 0
  const consumedUnits = inputReading >= previousReading ? inputReading - previousReading : 0
  const electricPrice = 3500 // hardcoded in BE
  const totalAmount = consumedUnits * electricPrice

  return (
    <div className="page-body">
      <div className="meter-header">
        <div>
          <h1>Chỉ Số Điện</h1>
          <p className="subtitle">Chốt chỉ số điện của các phòng trọ hàng tháng để lập hóa đơn</p>
        </div>

        <div className="month-picker-container">
          <label htmlFor="month-select" className="month-label">Kỳ ghi chỉ số:</label>
          <input 
            type="month" 
            id="month-select" 
            className="month-input"
            value={thang} 
            onChange={(e) => setThang(e.target.value)} 
          />
        </div>
      </div>

      {/* Toolbar / Search & Tab Toggle */}
      <div className="meter-toolbar">
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${activeTab === 'missing' ? 'active' : ''}`}
            onClick={() => setActiveTab('missing')}
          >
            Chưa ghi ({missingRooms.length})
          </button>
          <button 
            className={`filter-tab ${activeTab === 'recorded' ? 'active' : ''}`}
            onClick={() => setActiveTab('recorded')}
          >
            Đã ghi ({recordedReadings.length})
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
          <span>Đang tải số liệu công tơ...</span>
        </div>
      ) : (
        <>
          {activeTab === 'missing' ? (
            /* MISSING LIST */
            filteredMissing.length === 0 ? (
              <div className="meter-empty-state">
                <CheckCircle2 className="text-success" size={64} className="empty-icon" />
                <h3>Tất cả các phòng đã được ghi nhận!</h3>
                <p>Không còn phòng nào bị thiếu chỉ số điện trong kỳ này.</p>
              </div>
            ) : (
              <div className="meter-list-grid">
                {filteredMissing.map(room => {
                  const contract = timHopDongPhong(room.roomId)
                  return (
                    <div className="meter-room-card" key={room.roomId}>
                      <div className="card-top">
                        <span className="room-number">{room.roomCode}</span>
                        {contract ? (
                          <div className="tenant-name">
                            <span>Khách thuê: <strong>{contract.tenantName}</strong></span>
                          </div>
                        ) : (
                          <span className="text-danger-custom text-xs">Chưa có hợp đồng</span>
                        )}
                      </div>
                      
                      <div className="card-bottom">
                        <button 
                          className="btn btn-primary btn-full"
                          disabled={!contract}
                          onClick={() => handleOpenLogModal(room)}
                        >
                          Ghi số điện
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            /* RECORDED LIST */
            filteredRecorded.length === 0 ? (
              <div className="meter-empty-state">
                <Zap size={64} className="empty-icon" />
                <h3>Chưa có phòng nào được ghi số điện</h3>
                <p>Chọn tab "Chưa ghi" để bắt đầu cập nhật số liệu.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Phòng</th>
                      <th>Chỉ số cũ</th>
                      <th>Chỉ số mới</th>
                      <th>Tiêu thụ (kWh)</th>
                      <th>Đơn giá</th>
                      <th>Thành tiền</th>
                      <th>Ngày ghi</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecorded.map(r => (
                      <tr key={r.meterReadingId}>
                        <td><strong>{r.roomCode}</strong></td>
                        <td>{r.previousReading}</td>
                        <td>{r.currentReading}</td>
                        <td>
                          <span className="consumed-badge">{r.consumedUnits} kWh</span>
                        </td>
                        <td>{dinhDangTien(r.unitPrice)}</td>
                        <td><strong>{dinhDangTien(r.amount)}</strong></td>
                        <td>
                          <span className="date-cell">
                            {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-danger btn-xs"
                            onClick={() => handleDeleteReading(r.meterReadingId)}
                            title="Xóa chỉ số"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}

      {/* Log Reading Modal */}
      {modalOpen && modalTarget && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Ghi Chỉ Số Điện Phòng {modalTarget.roomCode}</span>
              <button className="btn-close-modal" onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleLogSubmit}>
              <div className="modal-body">
                {modalError && (
                  <div className="error-alert">
                    <AlertCircle size={18} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="checkout-tenant-summary-box" style={{ gridTemplateColumns: '1fr', gap: '4px' }}>
                  <p>Kỳ hóa đơn: <strong>Tháng {thang}</strong></p>
                  <p>Khách đại diện: <strong>{timHopDongPhong(modalTarget.roomId)?.tenantName}</strong></p>
                </div>

                {previousReadingLoading ? (
                  <div className="drawer-loading">
                    <Loader2 className="spinner" size={24} />
                    <span>Đang tải chỉ số điện cũ...</span>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Chỉ số điện cũ (Previous Reading)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        disabled 
                        value={previousReading} 
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="new-reading">Chỉ số điện mới hiện tại *</label>
                      <input 
                        type="number" 
                        id="new-reading" 
                        className="form-control"
                        required
                        autofocus
                        min={previousReading}
                        placeholder={`Nhập số lớn hơn hoặc bằng ${previousReading}`}
                        value={currentReadingInput}
                        onChange={(e) => setCurrentReadingInput(e.target.value)}
                      />
                    </div>

                    {currentReadingInput !== '' && !modalError && (
                      <div className="reading-calc-preview">
                        <div className="calc-row">
                          <span>Sản lượng tiêu thụ:</span>
                          <strong>{consumedUnits} kWh</strong>
                        </div>
                        <div className="calc-row">
                          <span>Đơn giá:</span>
                          <span>{dinhDangTien(electricPrice)}/kWh</span>
                        </div>
                        <div className="calc-row total-row">
                          <span>Thành tiền dự kiến:</span>
                          <span>{dinhDangTien(totalAmount)}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setModalOpen(false)}
                  disabled={modalSubmitting}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={modalSubmitting || previousReadingLoading || !!modalError}
                >
                  {modalSubmitting ? 'Đang lưu...' : 'Ghi nhận số điện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
