import React, { useState, useEffect } from 'react'
import { Zap, Calendar, Image, RefreshCw, Eye } from 'lucide-react'
import { layChiSoDienTenant } from '../api'
import { useNotification } from '../context/NotificationContext'

export default function TenantMeterReadings() {
  const [readings, setReadings] = useState([])
  const [loading, setLoading] = useState(true)
  const [zoomImage, setZoomImage] = useState(null)
  const { toast } = useNotification()

  const fetchReadings = async () => {
    setLoading(true)
    try {
      const data = await layChiSoDienTenant()
      setReadings(data)
    } catch (err) {
      toast.error('Không thể tải chỉ số điện nước: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReadings()
  }, [])

  const formatMonth = (monthStr) => {
    if (!monthStr) return 'N/A'
    const parts = monthStr.split('-')
    if (parts.length >= 2) return `${parts[1]}/${parts[0]}`
    return monthStr
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    return d.toLocaleDateString('vi-VN')
  }

  const layUrlHinhAnh = (path) => {
    if (!path) return null
    if (path.startsWith('http://') || path.startsWith('https://')) return path
    // Remove the leading slash if present, and resolve with the API base URL
    const cleanPath = path.replace(/^\//, '')
    const gocApi = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '').replace(/\/api$/, '')
    return `${gocApi}/${cleanPath}`
  }

  return (
    <div className="page-container" style={{ padding: '24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Chỉ Số Điện Nước</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Lịch sử ghi số công tơ điện nước phòng thuê của bạn</p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={fetchReadings} 
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>Đang tải danh sách chỉ số...</div>
      ) : (
        <div style={{
          background: 'var(--bg-secondary, #fff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary, #f8fafc)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Kỳ ghi chỉ số</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Phòng</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Chỉ số điện cũ</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Chỉ số điện mới</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tiêu thụ (kWh)</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ngày ghi nhận</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Minh chứng công tơ</th>
                </tr>
              </thead>
              <tbody>
                {readings.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Chưa có bản ghi chỉ số điện nước nào</td>
                  </tr>
                ) : (
                  readings.map((reading) => (
                    <tr key={reading.meterReadingId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Tháng {formatMonth(reading.billingMonth)}
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {reading.roomCode || reading.room?.roomCode || 'N/A'}
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-primary)' }}>
                        {reading.previousReading}
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-primary)' }}>
                        {reading.currentReading}
                      </td>
                      <td style={{ padding: '16px', fontWeight: 700, color: 'var(--primary-color, #3b82f6)' }}>
                        {reading.consumedUnits} kWh
                      </td>
                      <td style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {formatDate(reading.readingDate || reading.createdAt)}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        {reading.meterImagePath ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <div 
                              onClick={() => setZoomImage(reading.meterImagePath)}
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#f1f5f9'
                              }}
                              title="Click để phóng to ảnh"
                            >
                              <img 
                                src={layUrlHinhAnh(reading.meterImagePath)} 
                                alt="Công tơ" 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                              />
                            </div>
                            <button
                              onClick={() => setZoomImage(reading.meterImagePath)}
                              className="btn-icon-only"
                              style={{ width: '32px', height: '32px' }}
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Không có ảnh</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Image zoom modal */}
      {zoomImage && (
        <div className="modal-overlay" style={{ zIndex: 100 }} onClick={() => setZoomImage(null)}>
          <div className="modal-content" style={{ maxWidth: '600px', padding: '12px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '0 8px 8px 8px' }}>
              <h3 className="modal-title">Ảnh chụp công tơ thực tế</h3>
              <button className="btn-icon-only close-btn" onClick={() => setZoomImage(null)}>×</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
              <img 
                src={layUrlHinhAnh(zoomImage)} 
                alt="Công tơ phóng to" 
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
