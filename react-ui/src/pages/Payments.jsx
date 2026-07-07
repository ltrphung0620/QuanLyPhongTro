import React, { useState, useEffect } from 'react'
import { 
  History, 
  Plus, 
  Search, 
  Trash2, 
  X, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Calendar,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Link2,
  Clock
} from 'lucide-react'
import { 
  layDanhSachGiaoDich, 
  themGiaoDichPhatSinh, 
  suaGiaoDichPhatSinh, 
  xoaGiaoDichPhatSinh,
  layDanhSachThanhToan,
  soKhopThanhToan,
  xoaThanhToan,
  layDanhSachPhong,
  layHoaDonChuaThu
} from '../api'
import './Payments.css'
import { useNotification } from '../context/NotificationContext'
import { getCurrentMonthValue } from '../utils/month'
import { sortByRoomCode } from '../utils/roomSort'

const FIXED_MONTHLY_EXPENSE_ITEMS = ['Cáp', 'Rác', 'Tiền nc', 'Tiền điện']

const taoFixedExpenseDrafts = (transactions = []) => {
  const drafts = {}
  FIXED_MONTHLY_EXPENSE_ITEMS.forEach((itemName) => {
    const matched = transactions.find((tx) => laGiaoDichCoDinhThang(tx, itemName))
    drafts[itemName] = matched ? String(matched.amount || 0) : '0'
  })
  return drafts
}

const chuanHoaTenKhoan = (value) => (value || '').trim().toLowerCase()

const laGiaoDichCoDinhThang = (tx, itemName) => (
  tx &&
  chuanHoaTenKhoan(tx.itemName) === chuanHoaTenKhoan(itemName) &&
  (tx.transactionDirection || '').toLowerCase() === 'expense' &&
  (tx.category || '').toLowerCase() === 'operating' &&
  !tx.relatedRoomId &&
  !tx.relatedInvoiceId
)

export default function Payments() {
  const { toast, confirm } = useNotification()
  const [thang, setThang] = useState(getCurrentMonthValue)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Tabs: 'ledger' (manual transactions) or 'bank' (sepay webhook transactions)
  const [activeTab, setActiveTab] = useState('ledger')
  
  const [ledgerTransactions, setLedgerTransactions] = useState([])
  const [bankTransactions, setBankTransactions] = useState([])
  const [rooms, setRooms] = useState([])
  const [unpaidInvoices, setUnpaidInvoices] = useState([])
  const [fixedExpenseDrafts, setFixedExpenseDrafts] = useState(() => taoFixedExpenseDrafts())
  const [fixedExpenseSaving, setFixedExpenseSaving] = useState(false)

  // Search filter
  const [searchQuery, setSearchQuery] = useState('')

  // Ledger Modal Form State
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editTransactionId, setEditTransactionId] = useState(null)
  const [ledgerForm, setLedgerForm] = useState({
    transactionDirection: 'expense', // income | expense
    category: 'operating', // operating | other
    itemName: '',
    amount: '',
    transactionDate: '',
    description: '',
    relatedRoomId: ''
  })
  const [ledgerFormError, setLedgerFormError] = useState(null)
  const [ledgerFormSubmitting, setLedgerFormSubmitting] = useState(false)

  // Reconcile Modal State
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false)
  const [reconcileTarget, setReconcileTarget] = useState(null) // bank transaction
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [reconcileError, setReconcileError] = useState(null)
  const [reconcileSubmitting, setReconcileSubmitting] = useState(false)

  const taiDuLieu = async () => {
    setLoading(true)
    setError(null)
    const formattedMonth = `${thang}-01`
    try {
      const [ledgerData, bankData, roomsData, unpaidData] = await Promise.all([
        layDanhSachGiaoDich(formattedMonth),
        layDanhSachThanhToan(),
        layDanhSachPhong(),
        layHoaDonChuaThu()
      ])
      
      setLedgerTransactions(ledgerData)
      setFixedExpenseDrafts(taoFixedExpenseDrafts(ledgerData))
      setBankTransactions(bankData)
      setRooms(sortByRoomCode(roomsData))
      setUnpaidInvoices(sortByRoomCode(unpaidData))
    } catch (err) {
      console.error(err)
      setError(err.message || 'Không thể tải dữ liệu sổ thu chi & giao dịch')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    taiDuLieu()
  }, [thang])

  useEffect(() => {
    const handleRealtimeEvent = (event) => {
      const payload = event.detail
      if (
        payload.eventName === 'payment.webhook-received' ||
        payload.eventName === 'payment.reconciled' ||
        payload.eventName === 'payment.deleted' ||
        payload.eventName === 'transaction.created' ||
        payload.eventName === 'transaction.updated' ||
        payload.eventName === 'transaction.deleted'
      ) {
        taiDuLieu()
      }
    }

    window.addEventListener('realtime-event', handleRealtimeEvent)
    return () => {
      window.removeEventListener('realtime-event', handleRealtimeEvent)
    }
  }, [thang])

  // Open Add Ledger Modal
  const handleOpenAddLedger = () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')

    setIsEditMode(false)
    setLedgerForm({
      transactionDirection: 'expense',
      category: 'operating',
      itemName: '',
      amount: '',
      transactionDate: `${yyyy}-${mm}-${dd}`,
      description: '',
      relatedRoomId: ''
    })
    setLedgerFormError(null)
    setLedgerModalOpen(true)
  }

  // Open Edit Ledger Modal
  const handleOpenEditLedger = (tx) => {
    setIsEditMode(true)
    setEditTransactionId(tx.transactionId)
    setLedgerForm({
      transactionDirection: tx.transactionDirection,
      category: tx.category,
      itemName: tx.itemName || '',
      amount: tx.amount.toString(),
      transactionDate: tx.transactionDate,
      description: tx.description || '',
      relatedRoomId: tx.relatedRoomId || ''
    })
    setLedgerFormError(null)
    setLedgerModalOpen(true)
  }

  // Handle submit ledger transaction
  const handleLedgerSubmit = async (e) => {
    e.preventDefault()
    setLedgerFormError(null)
    setLedgerFormSubmitting(true)

    const amountVal = parseFloat(ledgerForm.amount)
    if (isNaN(amountVal) || amountVal <= 0) {
      setLedgerFormError('Số tiền giao dịch phải lớn hơn 0')
      setLedgerFormSubmitting(false)
      return
    }

    const payload = {
      transactionDirection: ledgerForm.transactionDirection,
      category: ledgerForm.category || 'operating',
      itemName: ledgerForm.itemName.trim() || null,
      amount: amountVal,
      transactionDate: ledgerForm.transactionDate,
      description: ledgerForm.description.trim() || null,
      relatedRoomId: ledgerForm.transactionDirection === 'income' && ledgerForm.relatedRoomId ? parseInt(ledgerForm.relatedRoomId) : null
    }

    try {
      if (isEditMode) {
        await suaGiaoDichPhatSinh(editTransactionId, payload)
      } else {
        await themGiaoDichPhatSinh(payload)
      }
      setLedgerModalOpen(false)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setLedgerFormError(err.message || 'Lỗi khi lưu giao dịch thu chi')
    } finally {
      setLedgerFormSubmitting(false)
    }
  }

  // Delete manual transaction
  const handleDeleteLedger = async (id) => {
    const isConfirmed = await confirm('Bạn có chắc muốn xóa giao dịch thu chi này?', 'Xác nhận xóa giao dịch')
    if (!isConfirmed) return
    try {
      await xoaGiaoDichPhatSinh(id)
      taiDuLieu()
      toast.success('Đã xóa giao dịch thành công.')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Không thể xóa giao dịch')
    }
  }

  // Open Reconcile Modal
  const handleOpenReconcile = (bankTx) => {
    setReconcileTarget(bankTx)
    setSelectedInvoiceId('')
    setReconcileError(null)
    setReconcileModalOpen(true)
  }

  // Submit Reconcile
  const handleReconcileSubmit = async (e) => {
    e.preventDefault()
    setReconcileError(null)
    setReconcileSubmitting(true)

    const invoiceId = parseInt(selectedInvoiceId)
    if (isNaN(invoiceId)) {
      setReconcileError('Vui lòng chọn một hóa đơn để đối soát')
      setReconcileSubmitting(false)
      return
    }

    try {
      await soKhopThanhToan(reconcileTarget.paymentTransactionId, { invoiceId })
      setReconcileModalOpen(false)
      taiDuLieu()
    } catch (err) {
      console.error(err)
      setReconcileError(err.message || 'Lỗi khi đối soát giao dịch')
    } finally {
      setReconcileSubmitting(false)
    }
  }

  // Delete Bank transfer log
  const handleDeleteBankTx = async (id) => {
    const isConfirmed = await confirm('Bạn có chắc muốn xóa vĩnh viễn log chuyển khoản ngân hàng này?', 'Xác nhận xóa log chuyển khoản')
    if (!isConfirmed) return
    try {
      await xoaThanhToan(id)
      taiDuLieu()
      toast.success('Đã xóa giao dịch chuyển khoản thành công.')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Không thể xóa giao dịch chuyển khoản')
    }
  }

  const layNgayDauThang = () => `${thang}-01`

  const handleFixedExpenseDraftChange = (itemName, value) => {
    setFixedExpenseDrafts((current) => ({
      ...current,
      [itemName]: value
    }))
  }

  const handleSaveFixedMonthlyExpenses = async () => {
    setFixedExpenseSaving(true)
    setError(null)

    try {
      for (const itemName of FIXED_MONTHLY_EXPENSE_ITEMS) {
        const existing = ledgerTransactions.find((tx) => laGiaoDichCoDinhThang(tx, itemName))
        const amount = parseFloat(fixedExpenseDrafts[itemName]) || 0

        if (amount <= 0) {
          if (existing) {
            await xoaGiaoDichPhatSinh(existing.transactionId)
          }
          continue
        }

        const payload = {
          transactionDirection: 'expense',
          category: 'operating',
          itemName,
          amount,
          transactionDate: layNgayDauThang(),
          description: null,
          relatedRoomId: null
        }

        if (existing) {
          await suaGiaoDichPhatSinh(existing.transactionId, payload)
        } else {
          await themGiaoDichPhatSinh(payload)
        }
      }

      toast.success('Đã lưu 4 khoản cố định của tháng.')
      await taiDuLieu()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Không thể lưu các khoản cố định')
    } finally {
      setFixedExpenseSaving(false)
    }
  }

  const dinhDangTien = (so) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(so)
  }

  // Filter items
  const fixedLedgerRows = FIXED_MONTHLY_EXPENSE_ITEMS.map((itemName) => {
    const existing = ledgerTransactions.find((tx) => laGiaoDichCoDinhThang(tx, itemName))
    return {
      ...(existing || {}),
      transactionId: existing?.transactionId ?? `fixed-${itemName}`,
      transactionDirection: 'expense',
      category: 'operating',
      itemName,
      amount: parseFloat(fixedExpenseDrafts[itemName]) || 0,
      transactionDate: existing?.transactionDate ?? layNgayDauThang(),
      description: existing?.description || null,
      relatedRoomId: null,
      relatedRoomCode: null,
      isFixedMonthly: true
    }
  })

  const normalLedgerRows = ledgerTransactions.filter((tx) => (
    !FIXED_MONTHLY_EXPENSE_ITEMS.some((itemName) => laGiaoDichCoDinhThang(tx, itemName))
  ))

  const filteredFixedLedger = fixedLedgerRows.filter(tx => {
    const query = searchQuery.toLowerCase()
    return (
      (tx.itemName && tx.itemName.toLowerCase().includes(query)) ||
      (tx.description && tx.description.toLowerCase().includes(query)) ||
      (tx.relatedRoomCode && tx.relatedRoomCode.toLowerCase().includes(query))
    )
  })

  const filteredNormalLedger = sortByRoomCode(normalLedgerRows.filter(tx => {
    const query = searchQuery.toLowerCase()
    return (
      (tx.itemName && tx.itemName.toLowerCase().includes(query)) ||
      (tx.description && tx.description.toLowerCase().includes(query)) ||
      (tx.relatedRoomCode && tx.relatedRoomCode.toLowerCase().includes(query))
    )
  }), tx => tx.relatedRoomCode)

  const filteredLedger = [...filteredFixedLedger, ...filteredNormalLedger]

  const filteredBank = bankTransactions.filter(tx => {
    const query = searchQuery.toLowerCase()
    return (
      (tx.content && tx.content.toLowerCase().includes(query)) ||
      (tx.paymentCode && tx.paymentCode.toLowerCase().includes(query)) ||
      (tx.accountNumber && tx.accountNumber.includes(query))
    )
  })

  return (
    <div className="page-body">
      <div className="payments-header">
        <div>
          <h1>Thu Chi Tháng</h1>
          <p className="subtitle">Quản lý quỹ thu chi phát sinh vận hành và log chuyển khoản ngân hàng tự động</p>
        </div>

        <div className="payments-header-actions">
          {activeTab === 'ledger' && (
            <>
              <div className="month-picker-container">
                <input 
                  type="month" 
                  className="month-input"
                  value={thang} 
                  onChange={(e) => setThang(e.target.value)} 
                />
              </div>

              <button className="btn btn-primary" onClick={handleOpenAddLedger}>
                <Plus size={18} />
                <span>Ghi chép thu chi</span>
              </button>

              <button className="btn btn-secondary" onClick={handleSaveFixedMonthlyExpenses} disabled={fixedExpenseSaving}>
                {fixedExpenseSaving ? (
                  <>
                    <Loader2 className="spinner" size={16} />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Lưu 4 khoản</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab select & Search Toolbar */}
      <div className="payments-toolbar">
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => setActiveTab('ledger')}
          >
            Sổ Quỹ Thu Chi ({fixedLedgerRows.length + normalLedgerRows.length})
          </button>
          <button 
            className={`filter-tab ${activeTab === 'bank' ? 'active' : ''}`}
            onClick={() => setActiveTab('bank')}
          >
            Ngân Hàng Sepay ({bankTransactions.length})
          </button>
        </div>

        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder={activeTab === 'ledger' ? "Tìm theo khoản chi, phòng..." : "Tìm theo nội dung ck, mã..."}
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
          <span>Đang tải lịch sử giao dịch...</span>
        </div>
      ) : (
        <>
          {activeTab === 'ledger' ? (
            /* TAB 1: LEDGER LIST */
            filteredLedger.length === 0 ? (
              <div className="payments-empty-state">
                <History size={64} className="empty-icon" />
                <h3>Chưa có khoản thu chi nào</h3>
                <p>Kỳ báo cáo tháng này chưa ghi nhận khoản phát sinh nào.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Khoản thu/chi</th>
                      <th>Phòng</th>
                      <th>Số tiền</th>
                      <th>Ngày phát sinh</th>
                      <th>Ghi chú</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map((tx) => (
                      <tr key={tx.transactionId}>
                        <td>
                          <div className="ledger-item-cell">
                            {tx.transactionDirection === 'income' ? (
                              <div className="dir-icon-bg income" title="Thu nhập"><ArrowDownLeft size={14} /></div>
                            ) : (
                              <div className="dir-icon-bg expense" title="Chi phí"><ArrowUpRight size={14} /></div>
                            )}
                            <div>
                              <strong>{tx.itemName || 'Giao dịch phát sinh'}</strong>
                              {tx.isFixedMonthly && <div className="fixed-ledger-hint">Cố định theo tháng</div>}
                            </div>
                          </div>
                        </td>
                        <td>{tx.relatedRoomCode || <span className="text-muted">—</span>}</td>
                        <td>
                          {tx.isFixedMonthly ? (
                            <div className="fixed-ledger-amount">
                              <span>-</span>
                              <input
                                type="number"
                                min="0"
                                value={fixedExpenseDrafts[tx.itemName] ?? '0'}
                                onChange={(e) => handleFixedExpenseDraftChange(tx.itemName, e.target.value)}
                                onWheel={(e) => e.target.blur()}
                              />
                              <span>đ</span>
                            </div>
                          ) : (
                            <span className={tx.transactionDirection === 'income' ? 'text-success font-bold' : 'text-danger font-bold'}>
                              {tx.transactionDirection === 'income' ? '+' : '-'}{dinhDangTien(tx.amount)}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="date-cell">
                            {new Date(tx.transactionDate).toLocaleDateString('vi-VN')}
                          </span>
                        </td>
                        <td>
                          <span className="desc-cell-txt">
                            {tx.isFixedMonthly ? 'Sửa số tiền rồi bấm Lưu 4 khoản' : (tx.description || <span className="text-muted">—</span>)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {tx.isFixedMonthly ? (
                            <span className="fixed-ledger-action">Mặc định</span>
                          ) : (
                            <div className="invoice-actions-flex">
                              <button
                                className="btn-card-edit"
                                onClick={() => handleOpenEditLedger(tx)}
                                title="Sửa bản ghi"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                className="btn-card-edit btn-danger-icon"
                                onClick={() => handleDeleteLedger(tx.transactionId)}
                                title="Xóa bản ghi"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* TAB 2: BANK TRANSACTIONS LIST */
            filteredBank.length === 0 ? (
              <div className="payments-empty-state">
                <RefreshCw size={64} className="empty-icon" />
                <h3>Chưa có giao dịch chuyển khoản</h3>
                <p>Hệ thống webhook ngân hàng chưa gửi bản ghi nào về.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Ngân hàng / GD ID</th>
                      <th>Nội dung chuyển khoản</th>
                      <th>Mã thanh toán</th>
                      <th>Số tiền chuyển</th>
                      <th>Ngày chuyển</th>
                      <th>Trạng thái đối soát</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBank.map((tx) => (
                      <tr key={tx.paymentTransactionId}>
                        <td>
                          <div className="bank-provider-cell">
                            <strong>{tx.provider || 'SePay'}</strong>
                            <span className="subtext">GD: {tx.providerTransactionId}</span>
                          </div>
                        </td>
                        <td>
                          <span className="bank-content-txt" title={tx.content}>{tx.content}</span>
                        </td>
                        <td>
                          <span className="payment-code-lbl">{tx.paymentCode || 'N/A'}</span>
                        </td>
                        <td>
                          <strong className="text-success">+{dinhDangTien(tx.transferAmount)}</strong>
                        </td>
                        <td>
                          <span className="date-cell">
                            {tx.transactionDate ? new Date(tx.transactionDate).toLocaleString('vi-VN') : ''}
                          </span>
                        </td>
                        <td>
                          {tx.processStatus === 'paid' ? (
                            <div className="reconcile-status-badge success">
                              <CheckCircle2 size={12} />
                              <span>Đã đối soát (HD #{tx.matchedInvoiceId})</span>
                            </div>
                          ) : (
                            <div className="reconcile-status-badge pending">
                              <Clock size={12} />
                              <span>Chờ đối soát</span>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="invoice-actions-flex">
                            {tx.processStatus !== 'paid' && (
                              <button 
                                className="btn btn-success btn-xs"
                                onClick={() => handleOpenReconcile(tx)}
                                title="Đối soát thủ công"
                              >
                                Đối soát
                              </button>
                            )}
                            <button 
                              className="btn-card-edit btn-danger-icon"
                              onClick={() => handleDeleteBankTx(tx.paymentTransactionId)}
                              title="Xóa log"
                            >
                              <Trash2 size={15} />
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

      {/* Ledger modal form */}
      {ledgerModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">
                {isEditMode ? 'Cập nhật giao dịch thu chi' : 'Ghi chép thu chi phát sinh'}
              </span>
              <button className="btn-close-modal" onClick={() => setLedgerModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleLedgerSubmit}>
              <div className="modal-body">
                {ledgerFormError && (
                  <div className="error-alert">
                    <AlertCircle size={18} />
                    <span>{ledgerFormError}</span>
                  </div>
                )}

                <div className="form-group">
                    <label className="form-label" htmlFor="tx-dir">Loại phát sinh</label>
                    <select 
                      id="tx-dir" 
                      className="form-control"
                      value={ledgerForm.transactionDirection}
                      onChange={(e) => setLedgerForm({
                        ...ledgerForm,
                        transactionDirection: e.target.value,
                        relatedRoomId: e.target.value === 'income' ? ledgerForm.relatedRoomId : ''
                      })}
                    >
                      <option value="expense">Chi tiền</option>
                      <option value="income">Thu tiền</option>
                    </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tx-name">Tên khoản thu/chi phát sinh *</label>
                  <input 
                    type="text" 
                    id="tx-name" 
                    className="form-control"
                    placeholder="Ví dụ: Thay bóng đèn, Sửa vòi nước, Thu bán ve chai..."
                    required
                    value={ledgerForm.itemName}
                    onChange={(e) => setLedgerForm({...ledgerForm, itemName: e.target.value})}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="tx-amount">Số tiền phát sinh (VND) *</label>
                    <input 
                      type="number" 
                      id="tx-amount" 
                      className="form-control"
                      required
                      value={ledgerForm.amount}
                      onChange={(e) => setLedgerForm({...ledgerForm, amount: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="tx-date">Ngày phát sinh *</label>
                    <input 
                      type="date" 
                      id="tx-date" 
                      className="form-control"
                      required
                      value={ledgerForm.transactionDate}
                      onChange={(e) => setLedgerForm({...ledgerForm, transactionDate: e.target.value})}
                    />
                  </div>
                </div>

                {ledgerForm.transactionDirection === 'income' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="tx-room">Liên kết phòng trọ (Nếu có)</label>
                      <select 
                        id="tx-room" 
                        className="form-control"
                        value={ledgerForm.relatedRoomId}
                        onChange={(e) => setLedgerForm({...ledgerForm, relatedRoomId: e.target.value})}
                      >
                        <option value="">-- Không liên kết --</option>
                        {rooms.map(r => (
                          <option key={r.roomId} value={r.roomId}>{r.roomCode}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="tx-desc">Chi tiết diễn giải thêm</label>
                  <input 
                    type="text" 
                    id="tx-desc" 
                    className="form-control"
                    placeholder="Ví dụ: Thay bóng điện phòng P101..."
                    value={ledgerForm.description}
                    onChange={(e) => setLedgerForm({...ledgerForm, description: e.target.value})}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setLedgerModalOpen(false)}
                  disabled={ledgerFormSubmitting}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={ledgerFormSubmitting}
                >
                  {ledgerFormSubmitting ? 'Đang lưu...' : 'Lưu giao dịch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Reconcile Modal */}
      {reconcileModalOpen && reconcileTarget && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Đối Soát Chuyển Khoản Thủ Công</span>
              <button className="btn-close-modal" onClick={() => setReconcileModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleReconcileSubmit}>
              <div className="modal-body">
                {reconcileError && (
                  <div className="error-alert">
                    <AlertCircle size={18} />
                    <span>{reconcileError}</span>
                  </div>
                )}

                <div className="checkout-tenant-summary-box" style={{ gridTemplateColumns: '1fr', gap: '4px' }}>
                  <p>Số tiền nhận: <strong>{dinhDangTien(reconcileTarget.transferAmount)}</strong></p>
                  <p>Nội dung chuyển khoản: <em>"{reconcileTarget.content}"</em></p>
                  <p>Mã tham chiếu: <strong>{reconcileTarget.referenceCode || 'N/A'}</strong></p>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="rec-inv">Chọn hóa đơn chưa thanh toán để gán khớp *</label>
                  <select 
                    id="rec-inv" 
                    className="form-control"
                    required
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  >
                    <option value="">-- Chọn hóa đơn công nợ --</option>
                    {unpaidInvoices.map(inv => (
                      <option key={inv.invoiceId} value={inv.invoiceId}>
                        Phòng {inv.roomCode} - Cần thu: {dinhDangTien(inv.totalAmount)} (Kỳ {inv.billingMonth})
                      </option>
                    ))}
                  </select>
                  <span className="form-help">Hóa đơn sau khi khớp đối soát sẽ được đánh dấu trạng thái Đã thanh toán tự động.</span>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setReconcileModalOpen(false)}
                  disabled={reconcileSubmitting}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-success"
                  disabled={reconcileSubmitting}
                >
                  {reconcileSubmitting ? 'Đang khớp...' : 'Xác nhận khớp hóa đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
