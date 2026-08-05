import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api'
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { getAdminHomePath } from '../adminPermissions'
import '../Auth.css'

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="auth-page auth-login-page">
      <div className="auth-login-shell">
        <section className="auth-showcase" aria-hidden="true">
          <div className="auth-corner-art auth-corner-top-left">
            <span className="auth-corner-dots" />
            <span className="auth-corner-arch" />
            <span className="auth-corner-accent" />
          </div>

          <div className="auth-corner-art auth-corner-top-right">
            <span className="auth-corner-ring auth-corner-ring-large" />
            <span className="auth-corner-ring auth-corner-ring-small" />
            <span className="auth-corner-disc" />
          </div>

          <div className="auth-corner-art auth-corner-bottom-left">
            <span className="auth-corner-frame" />
            <span className="auth-corner-tile" />
            <span className="auth-corner-pill" />
          </div>

          <div className="auth-corner-art auth-corner-bottom-right">
            <span className="auth-corner-panel" />
            <span className="auth-corner-orbit" />
            <span className="auth-corner-dots auth-corner-dots-light" />
          </div>
        </section>

        <main className="auth-login-main">
          <div className="auth-login-card">
            <div className="auth-card-ornament" aria-hidden="true">
              <span />
              <i><KeyRound size={20} /></i>
              <span />
            </div>

            <div className="auth-login-heading">
              <h2>Chào mừng trở lại</h2>
              <p>Đăng nhập để tiếp tục quản lý dãy trọ của bạn.</p>
            </div>

            {error && (
              <div className="auth-error-alert" role="alert" aria-live="polite">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label" htmlFor="email-input">Email hoặc tên đăng nhập</label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon-box"><User size={19} /></span>
                  <input
                    id="email-input"
                    type="text"
                    className="auth-input-control"
                    placeholder="Nhập email hoặc tên đăng nhập"
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password-input">Mật khẩu</label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon-box"><Lock size={19} /></span>
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input-control auth-password-input"
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={isLoading}>
                <span>{isLoading ? 'Đang xác thực...' : 'Đăng nhập hệ thống'}</span>
                {isLoading
                  ? <span className="auth-spinner" />
                  : <span className="auth-submit-arrow"><ArrowRight size={18} /></span>}
              </button>
            </form>

            <div className="auth-security-note">
              <ShieldCheck size={17} />
              <span>Phiên đăng nhập của bạn được bảo mật an toàn.</span>
            </div>

            <div className="auth-owner-footer">
              <div className="auth-support-heading">
                <strong>Liên hệ hỗ trợ/ hợp tác</strong>
                <span>Chúng tôi luôn sẵn sàng kết nối</span>
              </div>
              <div className="auth-support-links">
                <div className="auth-contact-static">
                  <Mail size={16} />
                  <span>hungltp206@gmail.com</span>
                </div>
              </div>
            </div>
          </div>

          <p className="auth-copyright">© 2026 LPH Home · Hệ thống quản lý phòng trọ</p>
        </main>
      </div>
    </div>
  )
}
