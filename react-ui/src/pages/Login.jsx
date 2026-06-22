import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api'
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import '../Auth.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await login(email, password)
      if (response && response.token) {
        localStorage.setItem('token', response.token)
        navigate('/')
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
            <h2>Quản lý phòng trọ</h2>
          </div>

          <h1 className="auth-title">Chào mừng trở lại</h1>
          <p className="auth-subtitle">Nhập thông tin quản trị viên để quản lý hệ thống trọ.</p>


          {error && (
            <div className="auth-error-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email-input">Email đăng nhập</label>
              <div className="auth-input-wrapper">
                <Mail className="auth-input-icon" size={16} />
                <input
                  id="email-input"
                  type="email"
                  className="auth-input-control"
                  placeholder="ten@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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

          <div className="auth-footer-link">
            Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
          </div>
        </div>
      </div>

      {/* Right Pane: Large Logo Showcase */}
      <div className="auth-right-pane">
        <div className="auth-logo-showcase">
          <img src="/logo-lph.jpg" alt="LPH Corporate Logo" />
        </div>
      </div>
    </div>
  )
}
