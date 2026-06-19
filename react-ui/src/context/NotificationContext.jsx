import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'

const NotificationContext = createContext(null)

export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm', // 'confirm' or 'alert'
    resolve: null
  })

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const toast = {
    success: useCallback((msg, dur) => showToast(msg, 'success', dur), [showToast]),
    error: useCallback((msg, dur) => showToast(msg, 'error', dur), [showToast]),
    warning: useCallback((msg, dur) => showToast(msg, 'warning', dur), [showToast]),
    info: useCallback((msg, dur) => showToast(msg, 'info', dur), [showToast]),
  }

  const confirm = useCallback((message, title = 'Xác nhận yêu cầu') => {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        type: 'confirm',
        resolve
      })
    })
  }, [])

  const alert = useCallback((message, title = 'Thông báo') => {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        type: 'alert',
        resolve
      })
    })
  }, [])

  const handleConfirm = () => {
    if (confirmDialog.resolve) {
      confirmDialog.resolve(true)
    }
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
  }

  const handleCancel = () => {
    if (confirmDialog.resolve) {
      confirmDialog.resolve(false)
    }
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
  }

  return (
    <NotificationContext.Provider value={{ toast, confirm, alert }}>
      {children}
      
      {/* Toast container */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-card toast-${t.type}`}>
            <div className="toast-icon-wrapper">
              {t.type === 'success' && <CheckCircle2 size={18} />}
              {t.type === 'error' && <XCircle size={18} />}
              {t.type === 'warning' && <AlertTriangle size={18} />}
              {t.type === 'info' && <Info size={18} />}
            </div>
            <div className="toast-message">{t.message}</div>
            <button 
              className="toast-close-btn" 
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm / Alert Modal overlay */}
      {confirmDialog.isOpen && (
        <div className="modal-overlay custom-notification-overlay" onClick={handleCancel}>
          <div className="modal-content custom-notification-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{confirmDialog.title}</h3>
              <button className="btn-icon-only close-btn" onClick={handleCancel} style={{ width: '32px', height: '32px' }}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px 24px' }}>
              <p className="notification-message" style={{ margin: 0, fontSize: '0.98rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {confirmDialog.message}
              </p>
            </div>
            <div className="modal-footer" style={{ padding: '16px 24px', gap: '12px' }}>
              {confirmDialog.type === 'confirm' && (
                <button className="btn btn-secondary" onClick={handleCancel}>
                  Hủy
                </button>
              )}
              <button 
                className={`btn ${confirmDialog.type === 'confirm' && confirmDialog.title.toLowerCase().includes('xóa') ? 'btn-danger' : 'btn-primary'}`} 
                onClick={handleConfirm}
                autoFocus
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  )
}
