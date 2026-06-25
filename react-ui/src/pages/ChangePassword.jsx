import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { doiMatKhau } from '../api'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { getAdminHomePath } from '../adminPermissions'

export default function ChangePassword() {
  const { user, refreshUser } = useAuth()
  const { toast } = useNotification()
  const navigate = useNavigate()

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng điền đầy đủ các trường')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới và xác nhận mật khẩu không khớp')
      return
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải từ 6 ký tự trở lên')
      return
    }

    setLoading(true)
    try {
      await doiMatKhau(oldPassword, newPassword)
      toast.success('Đổi mật khẩu thành công!')
      await refreshUser()
      
      // Redirect based on role
      if (user?.role === 'SuperAdmin') {
        navigate('/organizations')
      } else if (user?.role === 'Tenant') {
        navigate('/invoices')
      } else {
        navigate(getAdminHomePath(user))
      }
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra khi đổi mật khẩu')
      toast.error('Đổi mật khẩu thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 'calc(100vh - 120px)',
      padding: '20px',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: 'var(--bg-secondary, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '16px',
        padding: '32px',
        width: '100%',
        maxWidth: '450px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'rgba(59, 130, 246, 0.1)',
            color: 'var(--primary-color, #3b82f6)',
            marginBottom: '16px'
          }}>
            <Lock size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            {user?.mustChangePassword ? 'Yêu cầu đổi mật khẩu' : 'Đổi mật khẩu'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #64748b)', margin: 0 }}>
            {user?.mustChangePassword 
              ? 'Tài khoản của bạn được tạo mới hoặc reset. Vui lòng đổi mật khẩu để tiếp tục.' 
              : 'Hãy chọn một mật khẩu an toàn và dễ nhớ để bảo vệ tài khoản.'}
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--text-danger, #ef4444)',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '20px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Mật khẩu hiện tại</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại"
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  background: 'var(--bg-input, #fff)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Mật khẩu mới</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  background: 'var(--bg-input, #fff)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Xác nhận mật khẩu mới</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  background: 'var(--bg-input, #fff)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--primary-color, #3b82f6)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.2s',
              marginTop: '10px'
            }}
          >
            {loading ? 'Đang cập nhật...' : (
              <>
                <ShieldCheck size={18} />
                <span>Cập nhật mật khẩu</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
