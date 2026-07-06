import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Search
} from 'lucide-react'
import { downloadSalesLedgerPdf, laySalesLedger } from '../api'
import { useNotification } from '../context/NotificationContext'
import { getCurrentMonthValue, getRelativeMonthValue } from '../utils/month'
import { sortByRoomCode } from '../utils/roomSort'
import './Reports.css'

const LEDGER_OWNER_OPTIONS = [
  { key: '', label: 'Tất cả sổ', fileSuffix: 'TatCa' },
  { key: 'pham-sai', label: 'Phạm Thị Sại', fileSuffix: 'PhamThiSai' },
  { key: 'kim-loan', label: 'Trịnh Thị Kim Loan', fileSuffix: 'TrinhThiKimLoan' }
]

export default function Reports() {
  const { toast } = useNotification()
  const [fromMonth, setFromMonth] = useState(() => getRelativeMonthValue(-6))
  const [toMonth, setToMonth] = useState(getCurrentMonthValue)
  const [ledgerOwnerKey, setLedgerOwnerKey] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [ledger, setLedger] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  const taiDuLieu = async () => {
    setLoading(true)
    setError(null)
    const formattedFrom = `${fromMonth}-01`
    const formattedTo = `${toMonth}-01`

    try {
      const data = await laySalesLedger(formattedFrom, formattedTo, ledgerOwnerKey || null)
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
  }, [fromMonth, toMonth, ledgerOwnerKey])

  const handleExportPdf = async () => {
    setExporting(true)
    const formattedFrom = `${fromMonth}-01`
    const formattedTo = `${toMonth}-01`
    const selectedOwner = LEDGER_OWNER_OPTIONS.find(option => option.key === ledgerOwnerKey) || LEDGER_OWNER_OPTIONS[0]

    try {
      const blob = await downloadSalesLedgerPdf(
        formattedFrom,
        formattedTo,
        `Báo cáo Nhật ký thu tiền từ ${fromMonth} đến ${toMonth}`,
        ledgerOwnerKey || null
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `SoDoanhThu_${selectedOwner.fileSuffix}_${fromMonth}_den_${toMonth}.pdf`
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

  const filteredRows = sortByRoomCode(ledger?.rows?.filter(row => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true

    return (
      (row.roomCode || '').toLowerCase().includes(query) ||
      (row.paymentMethod || '').toLowerCase().includes(query) ||
      (row.description || '').toLowerCase().includes(query) ||
      String(row.amount).includes(query)
    )
  }) || [], row => row.roomCode)

  const filteredTotal = filteredRows.reduce((sum, row) => sum + row.amount, 0)

  return (
    <div className="page-body reports-page">
      <header className="reports-header">
        <div>
          <span className="page-eyebrow">Báo cáo tài chính</span>
          <h1 className="page-title reports-page-title">
            <FileSpreadsheet className="text-accent" size={28} />
            Nhật Ký Sổ Quỹ Thu Chi
          </h1>
        </div>

        <button
          className="btn btn-primary reports-export-button"
          onClick={handleExportPdf}
          disabled={exporting || loading || !ledger}
        >
          {exporting ? <Loader2 className="spinner" size={16} /> : <Download size={16} />}
          Xuất PDF Báo Cáo
        </button>
      </header>

      <section className="reports-controls-card">
        <div className="reports-controls-row">
          <div className="form-group reports-date-range-field">
            <label className="form-label">Khoảng tháng</label>
            <div className="reports-date-range-inputs">
              <div className="form-group reports-date-field">
              <label className="form-label">Từ tháng</label>
              <div className="reports-input-wrapper">
                <input
                  type="month"
                  className="form-control reports-input"
                  value={fromMonth}
                  onChange={(e) => setFromMonth(e.target.value)}
                />
              </div>
            </div>

            <div className="text-muted reports-date-arrow">
              <ArrowRight size={18} />
            </div>

              <div className="form-group reports-date-field">
              <label className="form-label">Đến tháng</label>
              <div className="reports-input-wrapper">
                <input
                  type="month"
                  className="form-control reports-input"
                  value={toMonth}
                  onChange={(e) => setToMonth(e.target.value)}
                  min={fromMonth}
                />
              </div>
            </div>

            </div>
          </div>

          <div className="form-group reports-owner-field">
              <label className="form-label">Sổ doanh thu</label>
              <select
                className="form-control reports-select"
                value={ledgerOwnerKey}
                onChange={(e) => setLedgerOwnerKey(e.target.value)}
              >
                {LEDGER_OWNER_OPTIONS.map(option => (
                  <option key={option.key || 'all'} value={option.key}>{option.label}</option>
                ))}
              </select>
          </div>

          <div className="reports-search-wrapper">
            <label className="form-label">Tìm kiếm nhanh</label>
            <div className="reports-input-wrapper">
              <Search size={16} className="text-muted" />
              <input
                type="text"
                className="form-control reports-input"
                placeholder="Tìm phòng, phương thức, nội dung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="error-alert reports-error-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container reports-loading">
          <Loader2 className="spinner" size={36} />
          <span>Đang tổng hợp dữ liệu sổ quỹ...</span>
        </div>
      ) : ledger && (
        <div className="reports-tables-container">
          <section className="reports-table-card" aria-label="Danh sách doanh thu">
            <div className="reports-table-header">
              <div className="reports-table-title">
                <span className="reports-title-dot" />
                Danh sách doanh thu
              </div>
              <span className="reports-table-total">Tổng: {dinhDangTien(filteredTotal)}</span>
            </div>

            {filteredRows.length === 0 ? (
              <div className="premium-empty-state">
                <FileSpreadsheet size={48} />
                <h4>Không có dữ liệu doanh thu</h4>
                <p>Không tìm thấy bản ghi nào trong khoảng thời gian đã chọn.</p>
              </div>
            ) : (
              <div className="table-container reports-ledger-table-container">
                <table className="reports-custom-table custom-table">
                  <thead>
                    <tr>
                      <th>Ngày tháng</th>
                      <th>Phòng</th>
                      <th>Phương thức</th>
                      <th>Nội dung chi tiết</th>
                      <th style={{ textAlign: 'right' }}>Số tiền</th>
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
                          <span className="room-badge-premium">{row.roomCode || 'N/A'}</span>
                        </td>
                        <td>
                          <span className="payment-method-badge">{row.paymentMethod || 'N/A'}</span>
                        </td>
                        <td>
                          <span className="ledger-description">{row.description}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <strong className="ledger-amount">+{dinhDangTien(row.amount)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
