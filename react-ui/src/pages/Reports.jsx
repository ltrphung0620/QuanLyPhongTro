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

export default function Reports() {
  const { toast } = useNotification()
  const [fromMonth, setFromMonth] = useState(() => {
    const today = new Date()
    // Default to current month minus 5 months (6 months total)
    const prevDate = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    const prevY = prevDate.getFullYear()
    const prevM = String(prevDate.getMonth() + 1).padStart(2, '0')
    return `${prevY}-${prevM}`
  })
  
  const [toMonth, setToMonth] = useState(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    return `${yyyy}-${mm}`
  })
  
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

  return (
    <div className="page-body">
      <header className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="page-eyebrow">Báo cáo tài chính</span>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet className="text-accent" size={26} />
            Nhật Ký Sổ Quỹ Thu Chi
          </h1>
        </div>
        
        <button 
          className="btn btn-primary"
          onClick={handleExportPdf}
          disabled={exporting || loading || !ledger}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          {exporting ? (
            <Loader2 className="spinner" size={16} />
          ) : (
            <Download size={16} />
          )}
          Xuất PDF Báo Cáo
        </button>
      </header>

      {/* Filter range section */}
      <section className="reports-filter-section card" aria-label="Bộ lọc khoảng thời gian">
        <div className="filter-row" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
            <label className="form-label" style={{ marginBottom: '6px' }}>Từ tháng</label>
            <div className="auth-input-wrapper" style={{ padding: '0 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center' }}>
              <Calendar size={16} className="text-muted" style={{ marginRight: '8px' }} />
              <input 
                type="month" 
                className="form-control" 
                style={{ border: 'none', padding: '10px 0', width: '100%' }}
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
              />
            </div>
          </div>

          <div className="text-muted" style={{ alignSelf: 'flex-end', paddingBottom: '12px', fontWeight: 'bold' }}>
            <ArrowRight size={18} />
          </div>

          <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
            <label className="form-label" style={{ marginBottom: '6px' }}>Đến tháng</label>
            <div className="auth-input-wrapper" style={{ padding: '0 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center' }}>
              <Calendar size={16} className="text-muted" style={{ marginRight: '8px' }} />
              <input 
                type="month" 
                className="form-control" 
                style={{ border: 'none', padding: '10px 0', width: '100%' }}
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
                min={fromMonth}
              />
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="error-alert" style={{ marginBottom: '24px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container" style={{ minHeight: '300px' }}>
          <Loader2 className="spinner" size={36} />
          <span>Đang tổng hợp dữ liệu sổ quỹ...</span>
        </div>
      ) : (
        <>
          {ledger && (
            <>
              {/* Summary stat box */}
              <section className="reports-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginBottom: '32px' }} aria-label="Tóm tắt doanh thu">
                <div className="stat-card card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div className="stat-icon-wrapper" style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <span className="stat-label" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tổng doanh thu thực nhận (Chuyển khoản đã khớp)</span>
                    <h2 className="stat-value text-success" style={{ fontSize: '1.8rem', fontWeight: '800', marginTop: '4px' }}>
                      {dinhDangTien(ledger.totalAmount)}
                    </h2>
                  </div>
                </div>
              </section>

              {/* Transactions list card */}
              <section className="card" style={{ padding: '24px' }} aria-label="Bút toán chi tiết">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>Chi Tiết Doanh Thu</h3>
                  
                  <div className="search-box" style={{ maxWidth: '300px', width: '100%' }}>
                    <div className="auth-input-wrapper" style={{ padding: '0 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center' }}>
                      <Search size={16} className="text-muted" style={{ marginRight: '8px' }} />
                      <input 
                        type="text"
                        className="form-control"
                        style={{ border: 'none', padding: '8px 0', width: '100%', fontSize: '0.9rem' }}
                        placeholder="Tìm phòng, nội dung..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {filteredRows.length === 0 ? (
                  <div className="meter-empty-state" style={{ padding: '48px 0' }}>
                    <FileSpreadsheet size={64} className="empty-icon" />
                    <h3>Không có dữ liệu doanh thu</h3>
                    <p>Không tìm thấy bản ghi thu chi nào trong khoảng thời gian đã chọn.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Ngày giao dịch</th>
                          <th>Phòng</th>
                          <th>Nội dung chi tiết</th>
                          <th style={{ textAlign: 'right' }}>Số tiền nhận</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row, idx) => (
                          <tr key={row.paymentTransactionId || idx}>
                            <td>
                              <span className="date-cell">
                                {row.transactionDate ? new Date(row.transactionDate).toLocaleDateString('vi-VN') : 'N/A'}
                              </span>
                            </td>
                            <td>
                              <strong>{row.roomCode || 'N/A'}</strong>
                            </td>
                            <td>
                              <span>{row.description}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <strong className="text-success">+{dinhDangTien(row.amount)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}
