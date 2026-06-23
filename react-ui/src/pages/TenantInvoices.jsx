import React, { useState, useEffect } from 'react'
import { FileText, Download, Eye, Calendar, DollarSign, RefreshCw, AlertCircle, Info } from 'lucide-react'
import { layHoaDonTenant, taiPdfHoaDonTenant } from '../api'
import { useNotification } from '../context/NotificationContext'

export default function TenantInvoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)
  const { toast } = useNotification()

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const data = await layHoaDonTenant()
      setInvoices(data)
    } catch (err) {
      toast.error('Không thể tải danh sách hóa đơn: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [])

  useEffect(() => {
    const handleRealtimeEvent = (event) => {
      const payload = event.detail
      if (payload?.eventName === 'tenant.invoice.created') {
        fetchInvoices()
      }
    }

    window.addEventListener('realtime-event', handleRealtimeEvent)
    return () => window.removeEventListener('realtime-event', handleRealtimeEvent)
  }, [])

  const handleDownloadPdf = async (e, inv) => {
    e.stopPropagation()
    setDownloadingId(inv.invoiceId)
    try {
      const blob = await taiPdfHoaDonTenant(inv.invoiceId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `HoaDon_${inv.roomCode || 'Room'}_Thang_${inv.billingMonth || 'Billing'}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Tải hóa đơn PDF thành công!')
    } catch (err) {
      toast.error('Lỗi khi tải PDF hóa đơn: ' + err.message)
    } finally {
      setDownloadingId(null)
    }
  }

  const formatVnd = (amount) => {
    if (amount === undefined || amount === null) return '0 đ'
    return amount.toLocaleString('vi-VN') + ' đ'
  }

  const formatMonth = (monthStr) => {
    if (!monthStr) return 'N/A'
    // monthStr is typically YYYY-MM
    const parts = monthStr.split('-')
    if (parts.length >= 2) return `${parts[1]}/${parts[0]}`
    return monthStr
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    return d.toLocaleDateString('vi-VN')
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Hóa Đơn Thuê Phòng</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Xem và tải các hóa đơn tiền phòng và dịch vụ hàng tháng</p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={fetchInvoices} 
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>Đang tải danh sách hóa đơn...</div>
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
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Kỳ hóa đơn</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Phòng</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Thời gian tính tiền</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tổng tiền thanh toán</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Trạng thái</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Bạn chưa có hóa đơn nào</td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.invoiceId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Tháng {formatMonth(inv.billingMonth)}
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {inv.roomCode || 'N/A'}
                      </td>
                      <td style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {formatDate(inv.fromDate)} - {formatDate(inv.toDate)}
                      </td>
                      <td style={{ padding: '16px', fontWeight: 700, color: 'var(--primary-color, #3b82f6)' }}>
                        {formatVnd(inv.totalAmount)}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: inv.status === 'paid' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: inv.status === 'paid' ? 'var(--text-success, #22c55e)' : 'var(--text-danger, #ef4444)'
                        }}>
                          {inv.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedInvoice(inv)
                              setShowDetailModal(true)
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '0.8rem' }}
                          >
                            <Eye size={14} />
                            <span>Chi tiết</span>
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={(e) => handleDownloadPdf(e, inv)}
                            disabled={downloadingId === inv.invoiceId}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '0.8rem' }}
                          >
                            <Download size={14} />
                            <span>{downloadingId === inv.invoiceId ? 'Đang tải...' : 'Tải PDF'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {showDetailModal && selectedInvoice && (
        <div className="modal-overlay" style={{ zIndex: 100 }} onClick={() => {
          setShowDetailModal(false)
          setSelectedInvoice(null)
        }}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Chi tiết hóa đơn - Tháng {formatMonth(selectedInvoice.billingMonth)}</h3>
              <button className="btn-icon-only close-btn" onClick={() => {
                setShowDetailModal(false)
                setSelectedInvoice(null)
              }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Payment Status banner */}
              <div style={{
                background: selectedInvoice.status === 'paid' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: selectedInvoice.status === 'paid' ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>Trạng thái thanh toán</span>
                <span style={{
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  color: selectedInvoice.status === 'paid' ? 'var(--text-success, #22c55e)' : 'var(--text-danger, #ef4444)'
                }}>
                  {selectedInvoice.status === 'paid' ? 'ĐÃ THANH TOÁN' : 'CHƯA THANH TOÁN'}
                </span>
              </div>

              {/* Bill Details List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Mã phòng</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedInvoice.roomCode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Tiền phòng cố định</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{formatVnd(selectedInvoice.roomFee)}</span>
                </div>
                
                {/* Electricity breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Tiền điện sinh hoạt</span>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{formatVnd(selectedInvoice.electricityFee)}</span>
                  </div>
                  {selectedInvoice.consumedUnits !== undefined && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                      <span>Số cũ: {selectedInvoice.previousReading}</span>
                      <span>•</span>
                      <span>Số mới: {selectedInvoice.currentReading}</span>
                      <span>•</span>
                      <span>Tiêu thụ: {selectedInvoice.consumedUnits} kWh</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Tiền nước</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{formatVnd(selectedInvoice.waterFee)}</span>
                </div>
                
                {selectedInvoice.trashFee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Phí rác / vệ sinh</span>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{formatVnd(selectedInvoice.trashFee)}</span>
                  </div>
                )}

                {selectedInvoice.extraFee > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Chi phí phát sinh</span>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{formatVnd(selectedInvoice.extraFee)}</span>
                    </div>
                    {selectedInvoice.extraFeeNote && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        * Ghi chú: {selectedInvoice.extraFeeNote}
                      </span>
                    )}
                  </div>
                )}

                {selectedInvoice.discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Giảm trừ ưu đãi</span>
                    <span style={{ fontWeight: 500, color: 'var(--text-success, #22c55e)' }}>-{formatVnd(selectedInvoice.discountAmount)}</span>
                  </div>
                )}

                {selectedInvoice.debtAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Nợ cũ chưa trả</span>
                    <span style={{ fontWeight: 500, color: 'var(--text-danger, #ef4444)' }}>{formatVnd(selectedInvoice.debtAmount)}</span>
                  </div>
                )}

                {/* Total amount highlight */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: 'var(--bg-primary, #f8fafc)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginTop: '8px'
                }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Tổng cộng cần trả</span>
                  <span style={{ fontWeight: 800, color: 'var(--primary-color, #3b82f6)', fontSize: '1.1rem' }}>
                    {formatVnd(selectedInvoice.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Payment code if unpaid */}
              {selectedInvoice.status !== 'paid' && selectedInvoice.paymentCode && (
                <div style={{
                  background: 'rgba(59, 130, 246, 0.03)',
                  border: '1px dashed var(--primary-color, #3b82f6)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  fontSize: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Quét mã QR để thanh toán tự động:</div>
                  <div style={{
                    background: '#fff',
                    padding: '8px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    display: 'inline-flex'
                  }}>
                    <img 
                      src={`https://img.vietqr.io/image/mbbank-556062006-compact2.jpg?amount=${Math.max(0, Math.round(selectedInvoice.totalAmount))}&addInfo=${encodeURIComponent(selectedInvoice.paymentCode.trim())}&accountName=LaiTrinhPhuocHung`}
                      alt="VietQR Payment Code"
                      style={{ width: '220px', height: 'auto', display: 'block' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Hoặc chuyển khoản thủ công với nội dung chuyển khoản chính xác:
                  </div>
                  <div style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: 800, 
                    color: 'var(--primary-color, #3b82f6)', 
                    letterSpacing: '1px',
                    background: 'rgba(59, 130, 246, 0.08)',
                    padding: '6px 16px',
                    borderRadius: '6px',
                    display: 'inline-block'
                  }}>
                    {selectedInvoice.paymentCode}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', maxWidth: '90%' }}>
                    * Hệ thống sẽ tự động gạch nợ hóa đơn ngay khi nhận được giao dịch chuyển khoản đúng cú pháp.
                  </div>
                </div>
              )}

              {selectedInvoice.note && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  background: 'var(--bg-primary, #f8fafc)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)'
                }}>
                  <Info size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>Ghi chú từ chủ trọ: {selectedInvoice.note}</span>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ padding: '16px 24px', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => {
                setShowDetailModal(false)
                setSelectedInvoice(null)
              }}>Đóng</button>
              <button 
                className="btn btn-primary" 
                onClick={(e) => {
                  handleDownloadPdf(e, selectedInvoice)
                  setShowDetailModal(false)
                  setSelectedInvoice(null)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Download size={14} />
                <span>Tải PDF hóa đơn</span>
              </button>
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
