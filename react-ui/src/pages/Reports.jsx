import React, { useState, useEffect } from 'react'
import { 
  FileSpreadsheet, 
  Calendar, 
  Download, 
  Loader2, 
  AlertCircle, 
  Search, 
  ArrowRight,
  TrendingUp
} from 'lucide-react'
import { laySalesLedger, downloadSalesLedgerPdf } from '../api'
import './Reports.css'
import { useNotification } from '../context/NotificationContext'
import { getPreviousMonthValue, getRelativeMonthValue } from '../utils/month'

export default function Reports() {
  const { toast } = useNotification()
  const [fromMonth, setFromMonth] = useState(() => getRelativeMonthValue(-6))
  
  const [toMonth, setToMonth] = useState(getPreviousMonthValue)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ledger, setLedger] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const taiDuLieu = async () => {
    setLoading(true)
    setError(null)
    const formattedFrom = `${fromMonth}-01`
    const formattedTo = `${toMonth}-01`
    try {
      const data = await laySalesLedger(formattedFrom, formattedTo)
      setLedger(data)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Không thể tải báo cáo sổ quỹ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    taiDuLieu()
  }, [fromMonth, toMonth])

  const handleExportPdf = async () => {
    setExporting(true)
    const formattedFrom = `${fromMonth}-01`
    const formattedTo = `${toMonth}-01`
    try {
      const blob = await downloadSalesLedgerPdf(formattedFrom, formattedTo, `Báo cáo Nhật ký thu tiền từ ${fromMonth} đến ${toMonth}`)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `SoDoanhThu_${fromMonth}_den_${toMonth}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Không thể tải tệp PDF báo cáo')
    } finally {
      setExporting(false)
    }
  }

  const dinhDangTien = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0)
  }

  // Filter rows based on search
  const filteredRows = ledger?.rows?.filter(r => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return (
      (r.roomCode || '').toLowerCase().includes(query) ||
      (r.description || '').toLowerCase().includes(query) ||
      String(r.amount).includes(query)
    )
  }) || []

  const transferRows = filteredRows.filter(r => r.paymentMethod === 'Chuyển khoản')
  const cashRows = filteredRows.filter(r => r.paymentMethod === 'Tiền mặt')

  return (
    <div className="page-body">
      {/* Header section with page banner styling */}
      <header className="reports-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="page-eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Báo cáo tài chính</span>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: '800' }}>
            <FileSpreadsheet className="text-accent" size={28} />
            Nhật Ký Sổ Quỹ Thu Chi
          </h1>
        </div>
        
        <button 
          className="btn btn-primary"
          onClick={handleExportPdf}
          disabled={exporting || loading || !ledger}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: 'var(--radius-md)', fontWeight: 'bold' }}
        >
          {exporting ? (
            <Loader2 className="spinner" size={16} />
          ) : (
            <Download size={16} />
          )}
          Xuất PDF Báo Cáo
        </button>
      </header>

      {/* Filter and search controls panel */}
      <section className="reports-controls-card">
        <div className="reports-controls-row">
          <div className="reports-filter-inputs">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ marginBottom: '6px', fontSize: '0.8rem', fontWeight: '600' }}>Từ tháng</label>
              <div className="auth-input-wrapper" style={{ padding: '0 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center' }}>
                <Calendar size={16} className="text-muted" style={{ marginRight: '8px' }} />
                <input 
                  type="month" 
                  className="form-control" 
                  style={{ border: 'none', padding: '10px 0', width: '100%', background: 'transparent' }}
                  value={fromMonth}
                  onChange={(e) => setFromMonth(e.target.value)}
                />
              </div>
            </div>

            <div className="text-muted" style={{ alignSelf: 'flex-end', paddingBottom: '12px', display: 'flex', alignItems: 'center' }}>
              <ArrowRight size={18} />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ marginBottom: '6px', fontSize: '0.8rem', fontWeight: '600' }}>Đến tháng</label>
              <div className="auth-input-wrapper" style={{ padding: '0 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center' }}>
                <Calendar size={16} className="text-muted" style={{ marginRight: '8px' }} />
                <input 
                  type="month" 
                  className="form-control" 
                  style={{ border: 'none', padding: '10px 0', width: '100%', background: 'transparent' }}
                  value={toMonth}
                  onChange={(e) => setToMonth(e.target.value)}
                  min={fromMonth}
                />
              </div>
            </div>
          </div>

          <div className="reports-search-wrapper">
            <label className="form-label" style={{ marginBottom: '6px', fontSize: '0.8rem', fontWeight: '600' }}>Tìm kiếm nhanh</label>
            <div className="auth-input-wrapper" style={{ padding: '0 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', background: 'var(--bg-primary)' }}>
              <Search size={16} className="text-muted" style={{ marginRight: '8px' }} />
              <input 
                type="text"
                className="form-control"
                style={{ border: 'none', padding: '10px 0', width: '100%', fontSize: '0.9rem', background: 'transparent' }}
                placeholder="Tìm phòng, nội dung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="error-alert" style={{ marginBottom: '24px', padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(166, 93, 87, 0.2)' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
          <Loader2 className="spinner" size={36} />
          <span>Đang tổng hợp dữ liệu sổ quỹ...</span>
        </div>
      ) : (
        <>
          {ledger && (
            <>
              {/* Summary Cards Grid */}
              <section className="reports-summary-grid" aria-label="Tóm tắt doanh thu">
                <div className="reports-stat-card total">
                  <div className="stat-icon-wrapper-premium">
                    <TrendingUp size={26} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', opacity: '0.9', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Tổng doanh thu thực nhận</span>
                    <h2 style={{ fontSize: '1.9rem', fontWeight: '800', marginTop: '4px', margin: 0 }}>
                      {dinhDangTien(ledger.totalAmount)}
                    </h2>
                  </div>
                </div>

                <div className="reports-stat-card transfer">
                  <div className="stat-icon-wrapper-premium">
                    <TrendingUp size={26} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', opacity: '0.9', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Doanh thu Chuyển khoản</span>
                    <h2 style={{ fontSize: '1.9rem', fontWeight: '800', marginTop: '4px', margin: 0 }}>
                      {dinhDangTien(ledger.rows.filter(r => r.paymentMethod === 'Chuyển khoản').reduce((sum, r) => sum + r.amount, 0))}
                    </h2>
                  </div>
                </div>

                <div className="reports-stat-card cash">
                  <div className="stat-icon-wrapper-premium">
                    <TrendingUp size={26} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', opacity: '0.9', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Doanh thu Tiền mặt</span>
                    <h2 style={{ fontSize: '1.9rem', fontWeight: '800', marginTop: '4px', margin: 0 }}>
                      {dinhDangTien(ledger.rows.filter(r => r.paymentMethod === 'Tiền mặt').reduce((sum, r) => sum + r.amount, 0))}
                    </h2>
                  </div>
                </div>
              </section>

              {/* Side-by-Side Tables Container */}
              <div className="reports-tables-container">
                
                {/* Bank Transfer Table Card */}
                <section className="reports-table-card" aria-label="Doanh thu chuyển khoản">
                  <div className="reports-table-header">
                    <div className="reports-table-title">
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block' }}></span>
                      Chi Tiết Doanh Thu Chuyển Khoản
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', padding: '6px 12px', borderRadius: '20px' }}>
                      Cộng: {dinhDangTien(transferRows.reduce((sum, r) => sum + r.amount, 0))}
                    </span>
                  </div>

                  {transferRows.length === 0 ? (
                    <div className="premium-empty-state">
                      <FileSpreadsheet size={48} />
                      <h4>Không có dữ liệu chuyển khoản</h4>
                      <p>Không tìm thấy bản ghi chuyển khoản nào trong khoảng thời gian đã chọn.</p>
                    </div>
                  ) : (
                    <div className="table-container" style={{ flexGrow: 1, overflowY: 'auto' }}>
                      <table className="reports-custom-table custom-table">
                        <thead>
                          <tr>
                            <th>Ngày tháng</th>
                            <th>Phòng</th>
                            <th>Nội dung chi tiết</th>
                            <th style={{ textAlign: 'right' }}>Số tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transferRows.map((row, idx) => (
                            <tr key={row.paymentTransactionId || idx}>
                              <td>
                                <span className="date-cell" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  {row.transactionDate ? new Date(row.transactionDate).toLocaleDateString('vi-VN') : 'N/A'}
                                </span>
                              </td>
                              <td>
                                <span className="room-badge-premium">{row.roomCode || 'N/A'}</span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{row.description}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <strong style={{ color: 'var(--success)', fontWeight: '700' }}>+{dinhDangTien(row.amount)}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Cash Table Card */}
                <section className="reports-table-card" aria-label="Doanh thu tiền mặt">
                  <div className="reports-table-header">
                    <div className="reports-table-title">
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }}></span>
                      Chi Tiết Doanh Thu Tiền Mặt
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 12px', borderRadius: '20px' }}>
                      Cộng: {dinhDangTien(cashRows.reduce((sum, r) => sum + r.amount, 0))}
                    </span>
                  </div>

                  {cashRows.length === 0 ? (
                    <div className="premium-empty-state">
                      <FileSpreadsheet size={48} />
                      <h4>Không có dữ liệu tiền mặt</h4>
                      <p>Không tìm thấy bản ghi tiền mặt nào trong khoảng thời gian đã chọn.</p>
                    </div>
                  ) : (
                    <div className="table-container" style={{ flexGrow: 1, overflowY: 'auto' }}>
                      <table className="reports-custom-table custom-table">
                        <thead>
                          <tr>
                            <th>Ngày tháng</th>
                            <th>Phòng</th>
                            <th>Nội dung chi tiết</th>
                            <th style={{ textAlign: 'right' }}>Số tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cashRows.map((row, idx) => (
                            <tr key={row.paymentTransactionId || idx}>
                              <td>
                                <span className="date-cell" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  {row.transactionDate ? new Date(row.transactionDate).toLocaleDateString('vi-VN') : 'N/A'}
                                </span>
                              </td>
                              <td>
                                <span className="room-badge-premium">{row.roomCode || 'N/A'}</span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{row.description}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <strong style={{ color: 'var(--success)', fontWeight: '700' }}>+{dinhDangTien(row.amount)}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
                
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
