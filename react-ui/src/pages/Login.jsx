import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api'
import { User, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { getAdminHomePath } from '../adminPermissions'
import '../Auth.css'

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { user, loading, loginUser } = useAuth()
  const { toast } = useNotification()

  useEffect(() => {
    if (loading || !user) return

    if (user.mustChangePassword) {
      navigate('/change-password', { replace: true })
    } else if (user.role === 'SuperAdmin') {
      navigate('/organizations', { replace: true })
    } else if (user.role === 'Tenant') {
      navigate('/invoices', { replace: true })
    } else {
      navigate(getAdminHomePath(user), { replace: true })
    }
  }, [loading, navigate, user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await login(emailOrUsername, password)
      if (response && response.token) {
        const u = await loginUser(response.token)
        if (u) {
          toast.success('Đăng nhập thành công!')
          if (u.mustChangePassword) {
            navigate('/change-password')
          } else if (u.role === 'SuperAdmin') {
            navigate('/organizations')
          } else if (u.role === 'Tenant') {
            navigate('/invoices')
          } else {
            navigate(getAdminHomePath(u))
          }
        } else {
          throw new Error('Không thể tải thông tin tài khoản sau khi đăng nhập.')
        }
      } else {
        throw new Error('Phản hồi đăng nhập không chứa token hợp lệ.')
      }
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page auth-split-container">
      {/* Left Pane: Form */}
      <div className="auth-left-pane">
        <div className="auth-form-wrapper">
          {/* Brand/logo row */}
          <div className="auth-brand-logo">
            <img src="/logo-lph.jpg" alt="LPH Logo" />
            <h2>Hệ thống quản lý phòng trọ</h2>
          </div>

          <h1 className="auth-title">Chào mừng trở lại</h1>
          <p className="auth-subtitle">Đăng nhập tài khoản của bạn để truy cập hệ thống.</p>

          {error && (
            <div className="auth-error-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email-input">Email hoặc Tên đăng nhập</label>
              <div className="auth-input-wrapper">
                <User className="auth-input-icon" size={16} />
                <input
                  id="email-input"
                  type="text"
                  className="auth-input-control"
                  placeholder="Nhập email hoặc username"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password-input">Mật khẩu</label>
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon" size={16} />
                <input
                  id="password-input"
                  type="password"
                  className="auth-input-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn-pill" disabled={isLoading}>
              {isLoading ? 'Đang xử lý...' : 'Tiếp tục đăng nhập'}
              {!isLoading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="auth-terms-text">
            Bằng cách tiếp tục, bạn đồng ý với <a href="#!">Điều khoản dịch vụ</a> và <a href="#!">Chính sách bảo mật</a> của chúng tôi.
          </div>
        </div>
      </div>

      <div className="auth-owner-footer">
        <span>Hệ thống thuộc về: <strong>Lại Trình Phước Hưng</strong></span>
        <span>Email: <a href="mailto:hungltp206@gmail.com">hungltp206@gmail.com</a></span>
        <span>SĐT: <a href="tel:0909638206">0909638206</a></span>
      </div>
    </div>
  )
}
