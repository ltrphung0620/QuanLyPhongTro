import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api'
import { Mail, Lock, ArrowRight, AlertCircle, Home, CheckCircle } from 'lucide-react'
import '../Auth.css'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.')
      return
    }

    setIsLoading(true)

    try {
      await register(email, password)
      setSuccess('Đăng ký tài khoản thành công! Đang chuyển hướng...')
      setTimeout(() => {
        navigate('/login')
      }, 1500)
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại. Vui lòng thử lại.')
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
          <p>Tạo tài khoản quản trị mới</p>
        </div>

        {error && (
          <div className="auth-error-alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-success-alert">
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email quản trị *</label>
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
            <label className="form-label">Mật khẩu *</label>
            <div className="auth-input-wrapper">
              <Lock className="auth-input-icon" size={16} />
              <input
                type="password"
                className="form-control auth-input-control"
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Xác nhận mật khẩu *</label>
            <div className="auth-input-wrapper">
              <Lock className="auth-input-icon" size={16} />
              <input
                type="password"
                className="form-control auth-input-control"
                placeholder="Nhập lại mật khẩu"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={isLoading}>
            {isLoading ? 'Đang tạo...' : 'Đăng ký'}
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="auth-footer-text">
          <p>
            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
