import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api'
import { Mail, Lock, ArrowRight, AlertCircle, Home } from 'lucide-react'
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
    <div className="auth-container">
      {/* Background patterns */}
      <div className="auth-bg-pattern-1"></div>
      <div className="auth-bg-pattern-2"></div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-wrapper">
            <Home size={24} />
          </div>
          <h2>NhaTro Premium</h2>
          <p>Đăng nhập tài khoản quản trị</p>
        </div>

        {error && (
          <div className="auth-error-alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email đăng nhập</label>
            <div className="auth-input-wrapper">
              <Mail className="auth-input-icon" size={16} />
              <input
                type="email"
                className="form-control auth-input-control"
                placeholder="ten@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <div className="auth-input-wrapper">
              <Lock className="auth-input-icon" size={16} />
              <input
                type="password"
                className="form-control auth-input-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={isLoading}>
            {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="auth-footer-text">
          <p>
            Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
