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
  FileText,
  Edit3,
  Camera,
  Eye
} from 'lucide-react'
import { 
  layChiSoThang, 
  layChiSoConThieu, 
  nhapChiSoDienNuoc, 
  nhapChiSoDienNuocBulk,
  previewChiSoDienNuoc, 
  xoaChiSoDienNuoc,
  layDanhSachHopDong,
  capNhatChiSoOriginal,
  uploadAnhChiSoOriginal,
  quetOcrCongToDien,
  docAnhCongToDien,
  layCauHinhGia
} from '../api'
import './MeterReadings.css'
import { useNotification } from '../context/NotificationContext'
import { getPreviousMonthValue } from '../utils/month'
import { sortByRoomCode } from '../utils/roomSort'

export default function MeterReadings() {
  const { toast, confirm } = useNotification()
  const [thang, setThang] = useState(getPreviousMonthValue)
  
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

  // Edit Reading Modal State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // reading object
  const [editReadingInput, setEditReadingInput] = useState('')
  const [editError, setEditError] = useState(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Image Preview Modal State
  const [previewImageOpen, setPreviewImageOpen] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  
  // Image Upload State
  const [uploadingReadingId, setUploadingReadingId] = useState(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [selectedFileForUpload, setSelectedFileForUpload] = useState(null)
  const [ocrPreview, setOcrPreview] = useState(null)

  // Bulk Log Modal State
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkInputs, setBulkInputs] = useState({})
  const [bulkError, setBulkError] = useState(null)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [pricing, setPricing] = useState({ electricityUnitPrice: 3500 })

  const taiDuLieu = async () => {
    setLoading(true)
    setError(null)
    const formattedMonth = `${thang}-01`
    try {
      const [readings, missing, contracts, pricingData] = await Promise.all([
        layChiSoThang(formattedMonth),
        layChiSoConThieu(formattedMonth),
        layDanhSachHopDong('active'),
        layCauHinhGia()
      ])
      
      setRecordedReadings(sortByRoomCode(readings))
      setMissingRooms(sortByRoomCode(missing))
      setActiveContracts(sortByRoomCode(contracts))
      setPricing(pricingData)
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
    setOcrLoading(false)
    setSelectedFileForUpload(null)
    setOcrPreview(null)
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

    
    const dto = {
      roomId: modalTarget.roomId,
      contractId: contract.contractId,
      billingMonth: `${thang}-01`,
      currentReading: currentVal
    }

    try {
      const result = await nhapChiSoDienNuoc(dto)
      
      if (selectedFileForUpload && result && result.meterReadingId) {
        toast.info('Đang tải ảnh công tơ điện lên...')
        try {
          await uploadAnhChiSoOriginal(result.meterReadingId, selectedFileForUpload)
          toast.success('Đã tải ảnh chỉ số lên thành công!')
        } catch (uploadErr) {
          toast.error(uploadErr.message || 'Không thể tải ảnh công tơ lên sau khi ghi số.')
        }
      }
      
      setModalOpen(false)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setModalError(err.message || 'Lỗi khi lưu số điện')
    } finally {
      setModalSubmitting(false)
    }
  }

  // Handle open bulk modal
  const handleOpenBulkModal = () => {
    // Filter rooms that have active contracts (or contractId since we populated it)
    const roomsWithContracts = sortByRoomCode(missingRooms.filter(r => r.contractId > 0 || timHopDongPhong(r.roomId) !== undefined))
    if (roomsWithContracts.length === 0) {
      toast.error('Không có phòng nào có hợp đồng hiệu lực để nhập hàng loạt.')
      return
    }

    const initialInputs = {}
    roomsWithContracts.forEach(r => {
      initialInputs[r.roomId] = ''
    })
    setBulkInputs(initialInputs)
    setBulkError(null)
    setBulkModalOpen(true)
  }

  // Handle input change in bulk form
  const handleBulkInputChange = (roomId, val) => {
    setBulkInputs(prev => ({
      ...prev,
      [roomId]: val
    }))
  }

  // Handle submit bulk readings
  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    setBulkError(null)
    setBulkSubmitting(true)

    const readingsList = []
    const roomsWithContracts = sortByRoomCode(missingRooms.filter(r => r.contractId > 0 || timHopDongPhong(r.roomId) !== undefined))

    for (const room of roomsWithContracts) {
      const inputVal = bulkInputs[room.roomId]
      // Skip empty inputs
      if (inputVal === undefined || inputVal === '') continue

      const currentVal = parseInt(inputVal)
      const contract = timHopDongPhong(room.roomId)
      const contractId = room.contractId || (contract ? contract.contractId : null)
      const prevReading = room.previousReading || 0

      if (isNaN(currentVal) || currentVal < prevReading) {
        setBulkError(`Số điện mới của phòng ${room.roomCode} phải lớn hơn hoặc bằng số cũ (${prevReading})`)
        setBulkSubmitting(false)
        return
      }

      if (!contractId) {
        setBulkError(`Không tìm thấy thông tin hợp đồng cho phòng ${room.roomCode}`)
        setBulkSubmitting(false)
        return
      }

      readingsList.push({
        roomId: room.roomId,
        contractId: contractId,
        currentReading: currentVal
      })
    }

    if (readingsList.length === 0) {
      setBulkError('Vui lòng nhập ít nhất một chỉ số điện mới.')
      setBulkSubmitting(false)
      return
    }

    try {
      await nhapChiSoDienNuocBulk({
        billingMonth: `${thang}-01`,
        readings: readingsList
      })
      setBulkModalOpen(false)
      toast.success(`Đã lưu thành công ${readingsList.length} chỉ số điện.`)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setBulkError(err.message || 'Lỗi khi lưu chỉ số hàng loạt')
    } finally {
      setBulkSubmitting(false)
    }
  }

  // Handle open edit reading modal
  const handleOpenEditModal = (reading) => {
    setEditTarget(reading)
    setEditReadingInput(String(reading.currentReading))
    setEditError(null)
    setEditModalOpen(true)
  }

  // Handle submit edit reading
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditError(null)
    setEditSubmitting(true)
    
    const newReading = parseInt(editReadingInput)
    if (isNaN(newReading) || newReading < editTarget.previousReading) {
      setEditError(`Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ (${editTarget.previousReading})`)
      setEditSubmitting(false)
      return
    }
    
    const dto = {
      meterReadingId: editTarget.meterReadingId,
      roomCode: editTarget.roomCode,
      billingMonth: editTarget.billingMonth,
      currentReading: newReading
    }
    
    try {
      await capNhatChiSoOriginal(dto)
      setEditModalOpen(false)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setEditError(err.message || 'Lỗi khi sửa chỉ số điện')
    } finally {
      setEditSubmitting(false)
    }
  }

  // Handle upload image
  const handleUploadImage = async (readingId, file) => {
    if (!file) return
    setUploadingReadingId(readingId)
    try {
      // 1. Tải ảnh lên trước
      await uploadAnhChiSoOriginal(readingId, file)
      
      // 2. Chạy quét OCR bằng AI
      toast.info('Đang quét chỉ số điện từ ảnh bằng AI...')
      const ocrResult = await quetOcrCongToDien(file)
      
      taiDuLieu()
      
      if (ocrResult && ocrResult.reading !== undefined) {
        const val = ocrResult.reading
        const readingObj = recordedReadings.find(r => r.meterReadingId === readingId)
        const roomCode = readingObj ? readingObj.roomCode : ''
        
        if (readingObj && readingObj.currentReading !== val) {
          const isConfirmed = await confirm(
            `AI phát hiện chỉ số điện trong ảnh là ${val}. Bạn có muốn cập nhật chỉ số phòng ${roomCode} từ ${readingObj.currentReading} thành ${val} không?`,
            'Cập nhật chỉ số bằng AI'
          )
          
          if (isConfirmed) {
            const dto = {
              meterReadingId: readingId,
              roomCode: roomCode,
              billingMonth: readingObj.billingMonth,
              currentReading: val
            }
            await capNhatChiSoOriginal(dto)
            taiDuLieu()
            toast.success('Đã cập nhật chỉ số điện bằng AI thành công!')
          }
        } else {
          toast.success('Tải ảnh và khớp chỉ số thành công!')
        }
      } else {
        toast.success('Đã tải ảnh chỉ số lên thành công!')
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tải ảnh hoặc quét chỉ số')
    } finally {
      setUploadingReadingId(null)
    }
  }

  const handleOcrFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setSelectedFileForUpload(file)
    setOcrLoading(true)
    setOcrPreview(null)
    toast.info('Đang gửi ảnh tới Gemini AI để nhận diện chỉ số...')
    
    try {
      const result = await docAnhCongToDien(file, previousReading)
      if (result && result.success) {
        const val = result.reading
        setOcrPreview({
          rawDigits: result.rawDigits,
          reading: result.reading,
          integerWheelCount: result.integerWheelCount,
          decimalDigitExcluded: result.decimalDigitExcluded,
          confidence: result.confidence,
          requiresManualConfirmation: result.requiresManualConfirmation,
          reason: result.reason,
          imageUrl: URL.createObjectURL(file)
        })

        if (!result.requiresManualConfirmation) {
          setCurrentReadingInput(String(val))
          toast.success(`Đã tự động nhận diện chỉ số điện từ ảnh: ${val}`)
        } else {
          toast.warning(`Độ tin cậy thấp (${(result.confidence * 100).toFixed(0)}%). Vui lòng tự kiểm tra và điền chỉ số thủ công.`)
        }
      } else {
        toast.error(result.reason || 'AI không nhận diện được chỉ số điện từ ảnh này.')
      }
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Lỗi khi nhận dạng chỉ số bằng AI')
    } finally {
      setOcrLoading(false)
    }
  }

  // Handle delete reading
  const handleDeleteReading = async (id) => {
    const isConfirmed = await confirm('Bạn có chắc muốn xóa chỉ số điện đã ghi này? Việc này có thể ảnh hưởng đến hóa đơn chưa thu.', 'Xác nhận xóa chỉ số')
    if (!isConfirmed) return
    
    try {
      await xoaChiSoDienNuoc(id)
      taiDuLieu()
      toast.success('Đã xóa chỉ số thành công.')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Lỗi khi xóa chỉ số')
    }
  }

  const dinhDangTien = (so) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(so)
  }

  // Filter lists based on search query
  const filteredMissing = sortByRoomCode(missingRooms.filter(r => 
    (r.roomCode || '').toLowerCase().includes(searchQuery.toLowerCase())
  ))

  const filteredRecorded = sortByRoomCode(recordedReadings.filter(r => 
    (r.roomCode || '').toLowerCase().includes(searchQuery.toLowerCase())
  ))

  const inputReading = parseInt(currentReadingInput) || 0
  const consumedUnits = inputReading >= previousReading ? inputReading - previousReading : 0
  const electricPrice = pricing.electricityUnitPrice || 3500
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

        <div className="search-box" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} className="search-icon" style={{ position: 'absolute', left: '12px' }} />
            <input 
              type="text" 
              placeholder="Tìm theo số phòng..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          {activeTab === 'missing' && filteredMissing.length > 0 && (
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={handleOpenBulkModal}
              style={{ whiteSpace: 'nowrap' }}
            >
              Nhập hàng loạt
            </button>
          )}
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
                      <th>Ảnh công tơ</th>
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
                          <div className="meter-image-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {r.meterImagePath ? (
                              <button 
                                type="button"
                                className="btn-view-image" 
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
                                onClick={() => {
                                  setPreviewImageUrl(`http://localhost:5103/${r.meterImagePath}`)
                                  setPreviewImageOpen(true)
                                }}
                              >
                                <Eye size={14} /> Xem ảnh
                              </button>
                            ) : null}
                            <label className="btn-upload-image-label" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', color: 'var(--text-muted)', gap: '4px' }} title="Tải ảnh lên">
                              {uploadingReadingId === r.meterReadingId ? (
                                <Loader2 className="spinner" size={14} />
                              ) : (
                                <>
                                  <Camera size={14} />
                                  <span style={{ fontSize: '0.78rem' }}>{r.meterImagePath ? 'Thay ảnh' : 'Tải ảnh'}</span>
                                </>
                              )}
                              <input 
                                type="file" 
                                accept="image/*" 
                                style={{ display: 'none' }}
                                onChange={(e) => handleUploadImage(r.meterReadingId, e.target.files[0])}
                                disabled={uploadingReadingId !== null}
                              />
                            </label>
                          </div>
                        </td>
                        <td>
                          <span className="date-cell">
                            {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleOpenEditModal(r)}
                              title="Sửa chỉ số"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button 
                              className="btn btn-danger btn-xs"
                              onClick={() => handleDeleteReading(r.meterReadingId)}
                              title="Xóa chỉ số"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
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
                        autoFocus
                        min={previousReading}
                        placeholder={`Nhập số lớn hơn hoặc bằng ${previousReading}`}
                        value={currentReadingInput}
                        onChange={(e) => setCurrentReadingInput(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Camera size={16} /> Tải ảnh chụp công tơ để quét bằng AI (Tùy chọn)
                      </label>
                      <div className="ocr-upload-box" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input 
                          type="file" 
                          accept="image/*" 
                          id="ocr-file-input"
                          className="form-control"
                          onChange={handleOcrFileChange}
                          disabled={ocrLoading}
                          style={{ flex: 1 }}
                        />
                        {ocrLoading && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: 'var(--accent)', fontWeight: 'bold' }}>
                            <Loader2 className="spinner" size={16} /> Đang quét...
                          </div>
                        )}
                      </div>
                    </div>

                    {ocrPreview && (
                      <div className="ocr-preview-container" style={{ margin: '12px 0', padding: '12px', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '6px', backgroundColor: 'var(--bg-card, #f8fafc)' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)' }}>
                          <CheckCircle2 size={16} /> Kết quả nhận diện bằng Gemini AI
                        </h4>
                        
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <div style={{ flex: '0 0 100px', maxWidth: '100px' }}>
                            <img 
                              src={ocrPreview.imageUrl} 
                              alt="Xem trước ảnh công tơ" 
                              style={{ width: '100%', height: '80px', borderRadius: '4px', objectFit: 'cover', cursor: 'pointer', border: '1px solid #cbd5e1' }}
                              onClick={() => {
                                setPreviewImageUrl(ocrPreview.imageUrl)
                                setPreviewImageOpen(true)
                              }}
                              title="Click để phóng to"
                            />
                          </div>
                          
                          <div style={{ flex: 1, minWidth: '150px', fontSize: '0.85rem', display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
                            <div>Chỉ số đọc gốc: <strong style={{ letterSpacing: '1px' }}>{ocrPreview.rawDigits}</strong></div>
                            <div>Giá trị lưu trữ: <strong style={{ color: 'var(--success, #10b981)' }}>{ocrPreview.reading} kWh</strong></div>
                            {ocrPreview.integerWheelCount > 0 && (
                              <div>Số chữ số nguyên: <strong>{ocrPreview.integerWheelCount} bánh số</strong></div>
                            )}
                            {ocrPreview.decimalDigitExcluded && (
                              <div style={{ color: 'var(--text-muted, #64748b)' }}>Bánh số thập phân đỏ bị bỏ: <strong>{ocrPreview.decimalDigitExcluded}</strong></div>
                            )}
                            <div>
                              Độ tin cậy: <span style={{ 
                                fontWeight: 'bold', 
                                color: ocrPreview.confidence >= 0.90 ? '#10b981' : (ocrPreview.confidence >= 0.85 ? '#eab308' : '#ef4444')
                              }}>
                                {(ocrPreview.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {ocrPreview.reason && (
                          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                            Giải thích từ AI: {ocrPreview.reason}
                          </div>
                        )}

                        {ocrPreview.requiresManualConfirmation ? (
                          <div className="error-alert" style={{ marginTop: '8px', padding: '6px 10px', fontSize: '0.8rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <AlertCircle size={14} />
                            <span>Độ tin cậy thấp (&lt; 85%). Vui lòng tự đối chiếu ảnh và nhập chỉ số thủ công vào ô bên dưới.</span>
                          </div>
                        ) : (
                          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => {
                                setCurrentReadingInput(String(ocrPreview.reading));
                                toast.success('Đã áp dụng chỉ số AI');
                              }}
                              style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                            >
                              Xác nhận chỉ số AI
                            </button>
                          </div>
                        )}
                      </div>
                    )}

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
      {/* Edit Reading Modal */}
      {editModalOpen && editTarget && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Sửa Chỉ Số Điện Phòng {editTarget.roomCode}</span>
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

                <div className="checkout-tenant-summary-box" style={{ gridTemplateColumns: '1fr', gap: '4px' }}>
                  <p>Kỳ hóa đơn: <strong>Tháng {thang}</strong></p>
                </div>

                <div className="form-group">
                  <label className="form-label">Chỉ số điện cũ (Previous Reading)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    disabled 
                    value={editTarget.previousReading} 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-new-reading">Chỉ số điện mới hiện tại *</label>
                  <input 
                    type="number" 
                    id="edit-new-reading" 
                    className="form-control"
                    required
                    autoFocus
                    min={editTarget.previousReading}
                    value={editReadingInput}
                    onChange={(e) => setEditReadingInput(e.target.value)}
                  />
                </div>

                {editReadingInput !== '' && parseInt(editReadingInput) >= editTarget.previousReading && (
                  <div className="reading-calc-preview">
                    <div className="calc-row">
                      <span>Sản lượng tiêu thụ mới:</span>
                      <strong>{parseInt(editReadingInput) - editTarget.previousReading} kWh</strong>
                    </div>
                    <div className="calc-row">
                      <span>Đơn giá:</span>
                      <span>{dinhDangTien(editTarget.unitPrice)}/kWh</span>
                    </div>
                    <div className="calc-row total-row">
                      <span>Thành tiền mới:</span>
                      <span>{dinhDangTien((parseInt(editReadingInput) - editTarget.previousReading) * editTarget.unitPrice)}</span>
                    </div>
                  </div>
                )}
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
                  {editSubmitting ? 'Đang lưu...' : 'Lưu chỉ số điện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImageOpen && (
        <div className="modal-overlay" onClick={() => setPreviewImageOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <span className="modal-title">Ảnh chụp công tơ điện</span>
              <button className="btn-close-modal" onClick={() => setPreviewImageOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '16px' }}>
              <img 
                src={previewImageUrl} 
                alt="Công tơ điện" 
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px', objectFit: 'contain' }} 
              />
            </div>
          </div>
        </div>
      )}
      {/* Bulk Log Reading Modal */}
      {bulkModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '95%' }}>
            <div className="modal-header">
              <span className="modal-title">Nhập Chỉ Số Điện Hàng Loạt - Tháng {thang}</span>
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

                <p style={{ marginBottom: '16px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Nhập chỉ số điện mới cho các phòng dưới đây. Các ô trống sẽ được bỏ qua.
                </p>

                <div className="bulk-reading-table-container">
                  <table className="bulk-table">
                    <thead>
                      <tr>
                        <th>Phòng</th>
                        <th>Khách thuê</th>
                        <th>Chỉ số cũ</th>
                        <th>Chỉ số mới *</th>
                        <th>Tiêu thụ</th>
                        <th>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortByRoomCode(missingRooms.filter(r => r.contractId > 0 || timHopDongPhong(r.roomId) !== undefined)).map(room => {
                        const prevReading = room.previousReading || 0
                        const currentInput = bulkInputs[room.roomId] || ''
                        const currentVal = parseInt(currentInput)
                        const consumed = !isNaN(currentVal) && currentVal >= prevReading ? currentVal - prevReading : 0
                        const amount = consumed * electricPrice
                        const tenantName = timHopDongPhong(room.roomId)?.tenantName || 'Khách thuê'

                        return (
                          <tr key={room.roomId}>
                            <td><strong>{room.roomCode}</strong></td>
                            <td>{tenantName}</td>
                            <td>{prevReading}</td>
                            <td>
                              <input
                                type="number"
                                className="bulk-input-field"
                                min={prevReading}
                                placeholder={`>= ${prevReading}`}
                                value={currentInput}
                                onChange={(e) => handleBulkInputChange(room.roomId, e.target.value)}
                              />
                            </td>
                            <td>
                              <span style={{ fontWeight: consumed > 0 ? '700' : 'normal', color: consumed > 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                                {consumed} kWh
                              </span>
                            </td>
                            <td>
                              <strong>{dinhDangTien(amount)}</strong>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
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
                  {bulkSubmitting ? 'Đang lưu...' : 'Lưu tất cả'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

