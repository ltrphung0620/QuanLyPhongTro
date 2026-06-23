import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Plus, 
  Search, 
  Edit3, 
  Phone, 
  CreditCard,
  Loader2,
  X,
  ShieldAlert,
  User,
  Key
} from 'lucide-react'
import { 
  layDanhSachNguoiThue, 
  themNguoiThue, 
  suaNguoiThue,
  layTaiKhoanTenant,
  taoTaiKhoanTenant,
  resetMatKhauTenant,
  toggleTaiKhoanTenant
} from '../api'
import { useNotification } from '../context/NotificationContext'
import './Tenants.css'

export default function Tenants() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { toast, confirm } = useNotification()
  
  // Search
  const [searchQuery, setSearchQuery] = useState('')
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editTenantId, setEditTenantId] = useState(null)
  const [formValues, setFormValues] = useState({
    fullName: '',
    phone: '',
    cccd: ''
  })
  const [formError, setFormError] = useState(null)
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Tenant Login Account Modal States
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [tenantAccount, setTenantAccount] = useState(null)
  const [loadingAccount, setLoadingAccount] = useState(false)
  
  // Account Form States
  const [accUsername, setAccUsername] = useState('')
  const [accEmail, setAccEmail] = useState('')
  const [accPassword, setAccPassword] = useState('')
  const [accDisplayName, setAccDisplayName] = useState('')
  const [createAccLoading, setCreateAccLoading] = useState(false)
  
  // Reset Password Form States
  const [accNewPassword, setAccNewPassword] = useState('')
  const [resetAccLoading, setResetAccLoading] = useState(false)

  const handleOpenAccountModal = async (tenant) => {
    setSelectedTenant(tenant)
    setTenantAccount(null)
    setAccNewPassword('')
    setFormError(null)
    
    setAccDisplayName(tenant.fullName)
    setAccUsername('')
    setAccEmail('')
    setAccPassword('')
    
    setAccountModalOpen(true)
    setLoadingAccount(true)
    try {
      const data = await layTaiKhoanTenant(tenant.tenantId)
      setTenantAccount(data)
    } catch (err) {
      console.error('Lỗi khi tải tài khoản khách thuê:', err)
    } finally {
      setLoadingAccount(false)
    }
  }

  const handleCreateTenantAccount = async (e) => {
    e.preventDefault()
    if (!accUsername || !accEmail || !accPassword || !accDisplayName) {
      toast.warning('Vui lòng nhập đầy đủ thông tin')
      return
    }
    setCreateAccLoading(true)
    setFormError(null)
    try {
      const account = await taoTaiKhoanTenant(selectedTenant.tenantId, accUsername, accEmail, accPassword, accDisplayName)
      setTenantAccount(account)
      toast.success('Tạo tài khoản đăng nhập cho khách thuê thành công!')
    } catch (err) {
      setFormError(err.message || 'Lỗi khi tạo tài khoản')
    } finally {
      setCreateAccLoading(false)
    }
  }

  const handleResetTenantPassword = async (e) => {
    e.preventDefault()
    if (!accNewPassword || accNewPassword.length < 6) {
      toast.warning('Mật khẩu mới phải tối thiểu 6 ký tự')
      return
    }
    setResetAccLoading(true)
    setFormError(null)
    try {
      await resetMatKhauTenant(tenantAccount.id, accNewPassword)
      toast.success('Đặt lại mật khẩu khách thuê thành công!')
      setAccNewPassword('')
    } catch (err) {
      setFormError(err.message || 'Lỗi đặt lại mật khẩu')
    } finally {
      setResetAccLoading(false)
    }
  }

  const handleToggleTenantAccount = async () => {
    const action = tenantAccount.isActive ? 'Khóa' : 'Mở khóa'
    const ok = await confirm(`Bạn có chắc chắn muốn ${action.toLowerCase()} tài khoản này?`)
    if (!ok) return
    
    try {
      await toggleTaiKhoanTenant(tenantAccount.id, !tenantAccount.isActive)
      toast.success(`${action} tài khoản thành công!`)
      // Refresh account info
      const data = await layTaiKhoanTenant(selectedTenant.tenantId)
      setTenantAccount(data)
    } catch (err) {
      toast.error('Lỗi khi cập nhật trạng thái tài khoản: ' + err.message)
    }
  }

  const taiDanhSachKhach = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await layDanhSachNguoiThue()
      setTenants(data)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Không thể tải danh sách khách thuê')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    taiDanhSachKhach()
  }, [])

  // Open Modal to Add Tenant
  const handleOpenAddModal = () => {
    setIsEditMode(false)
    setFormValues({
      fullName: '',
      phone: '',
      cccd: ''
    })
    setFormError(null)
    setModalOpen(true)
  }

  // Open Modal to Edit Tenant
  const handleOpenEditModal = (tenant) => {
    setIsEditMode(true)
    setEditTenantId(tenant.tenantId)
    setFormValues({
      fullName: tenant.fullName,
      phone: tenant.phone || '',
      cccd: tenant.cccd || ''
    })
    setFormError(null)
    setModalOpen(true)
  }

  // Handle Form Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setFormSubmitting(true)
    setFormError(null)

    if (!formValues.fullName.trim()) {
      setFormError('Họ và tên không được để trống')
      setFormSubmitting(false)
      return
    }

    try {
      if (isEditMode) {
        await suaNguoiThue(editTenantId, {
          fullName: formValues.fullName.trim(),
          phone: formValues.phone.trim() || null,
          cccd: formValues.cccd.trim() || null
        })
      } else {
        await themNguoiThue({
          fullName: formValues.fullName.trim(),
          phone: formValues.phone.trim() || null,
          cccd: formValues.cccd.trim() || null
        })
      }
      setModalOpen(false)
      taiDanhSachKhach()
    } catch (err) {
      console.error(err)
      setFormError(err.message || 'Lỗi khi lưu thông tin khách thuê')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Filter tenants
  const filteredTenants = tenants.filter(tenant => {
    const query = searchQuery.toLowerCase()
    return (
      (tenant.fullName || '').toLowerCase().includes(query) ||
      (tenant.phone && tenant.phone.includes(query)) ||
      (tenant.cccd && tenant.cccd.includes(query))
    )
  })

  // Helper to get name initials for avatar
  const getInitials = (name) => {
    if (!name) return '?'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <div className="page-body">
      <div className="tenants-header">
        <div>
          <h1>Khách Thuê</h1>
          <p className="subtitle">Quản lý hồ sơ, thông tin liên lạc và giấy tờ tùy thân của khách thuê</p>
        </div>
        
        <button className="btn btn-primary" onClick={handleOpenAddModal}>
          <Plus size={18} />
          <span>Thêm khách thuê</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="tenants-toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Tìm theo tên, SĐT, CCCD..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="total-indicator">
          Tổng số khách: <strong>{tenants.length}</strong>
        </div>
      </div>

      {error && (
        <div className="error-alert">
          <ShieldAlert size={20} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <Loader2 className="spinner" size={36} />
          <span>Đang tải danh sách khách thuê...</span>
        </div>
      ) : (
        <>
          {filteredTenants.length === 0 ? (
            <div className="tenants-empty-state">
              <Users size={64} className="empty-icon" />
              <h3>Không tìm thấy khách thuê</h3>
              <p>Thử đổi từ khóa tìm kiếm hoặc thêm hồ sơ khách thuê mới.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Khách thuê</th>
                    <th>Số điện thoại</th>
                    <th>Số CCCD/CMND</th>
                    <th>Ngày tạo hồ sơ</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((tenant) => (
                    <tr key={tenant.tenantId}>
                      <td>
                        <div className="tenant-profile-cell">
                          <div className="tenant-avatar">
                            {getInitials(tenant.fullName)}
                          </div>
                          <div className="tenant-info">
                            <span className="tenant-name">{tenant.fullName}</span>
                            <span className="tenant-id-badge">ID: #{tenant.tenantId}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {tenant.phone ? (
                          <div className="contact-cell">
                            <Phone size={14} className="cell-icon" />
                            <span>{tenant.phone}</span>
                          </div>
                        ) : (
                          <span className="text-muted">Chưa cập nhật</span>
                        )}
                      </td>
                      <td>
                        {tenant.cccd ? (
                          <div className="contact-cell">
                            <CreditCard size={14} className="cell-icon" />
                            <span>{tenant.cccd}</span>
                          </div>
                        ) : (
                          <span className="text-muted">Chưa cập nhật</span>
                        )}
                      </td>
                      <td>
                        <span className="date-cell">
                          {new Date(tenant.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn-card-edit" 
                            onClick={() => handleOpenEditModal(tenant)}
                            title="Sửa hồ sơ"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            className="btn-card-edit" 
                            onClick={() => handleOpenAccountModal(tenant)}
                            title="Tài khoản đăng nhập"
                            style={{ color: 'var(--primary-color, #3b82f6)' }}
                          >
                            <User size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">
                {isEditMode ? 'Cập nhật hồ sơ khách thuê' : 'Thêm hồ sơ khách thuê mới'}
              </span>
              <button className="btn-close-modal" onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="error-alert">
                    <ShieldAlert size={18} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="fullName">Họ và tên khách thuê *</label>
                  <input 
                    type="text" 
                    id="fullName" 
                    className="form-control"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    required
                    value={formValues.fullName}
                    onChange={(e) => setFormValues({...formValues, fullName: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="phone">Số điện thoại</label>
                  <input 
                    type="tel" 
                    id="phone" 
                    className="form-control"
                    placeholder="Ví dụ: 0912345678"
                    value={formValues.phone}
                    onChange={(e) => setFormValues({...formValues, phone: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="cccd">Số CCCD / CMND</label>
                  <input 
                    type="text" 
                    id="cccd" 
                    className="form-control"
                    placeholder="Ví dụ: 037123456789"
                    value={formValues.cccd}
                    onChange={(e) => setFormValues({...formValues, cccd: e.target.value})}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu hồ sơ</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Management Modal */}
      {accountModalOpen && selectedTenant && (
        <div className="modal-overlay" style={{ zIndex: 100 }} onClick={() => setAccountModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={18} style={{ color: 'var(--primary-color)' }} />
                <span>Tài khoản khách thuê: {selectedTenant.fullName}</span>
              </span>
              <button className="btn-close-modal" onClick={() => setAccountModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body" style={{ padding: '20px 24px' }}>
              {formError && (
                <div className="error-alert" style={{ marginBottom: '16px' }}>
                  <ShieldAlert size={18} />
                  <span>{formError}</span>
                </div>
              )}

              {loadingAccount ? (
                <div style={{ textAlign: 'center', padding: '30px' }}>
                  <Loader2 className="spinner" size={24} />
                  <div style={{ marginTop: '8px', fontSize: '0.88rem' }}>Đang tải thông tin tài khoản...</div>
                </div>
              ) : tenantAccount ? (
                /* Account Exists UI */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Account Information Panel */}
                  <div style={{
                    background: 'var(--bg-primary, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '14px'
                  }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 700 }}>Thông tin tài khoản</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Tên đăng nhập:</span>
                        <span style={{ fontWeight: 600 }}>{tenantAccount.username}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Email đăng ký:</span>
                        <span style={{ fontWeight: 500 }}>{tenantAccount.email}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Trạng thái:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '10px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: tenantAccount.isActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: tenantAccount.isActive ? 'var(--text-success)' : 'var(--text-danger)'
                          }}>{tenantAccount.isActive ? 'Hoạt động' : 'Bị khóa'}</span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleToggleTenantAccount}
                            style={{ padding: '2px 8px', fontSize: '0.72rem', minHeight: 'unset', height: '24px' }}
                          >
                            {tenantAccount.isActive ? 'Khóa' : 'Mở khóa'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reset Password Panel */}
                  <form onSubmit={handleResetTenantPassword} style={{
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '14px'
                  }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Key size={14} style={{ color: 'var(--primary-color)' }} />
                      <span>Đặt lại mật khẩu</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="password"
                        placeholder="Nhập mật khẩu tạm thời mới"
                        className="form-control"
                        required
                        value={accNewPassword}
                        onChange={(e) => setAccNewPassword(e.target.value)}
                        style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={resetAccLoading}
                        style={{ alignSelf: 'flex-start', padding: '6px 12px', fontSize: '0.8rem', minHeight: 'unset', height: '32px' }}
                      >
                        {resetAccLoading ? 'Đang thực hiện...' : 'Cập nhật mật khẩu'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Create Account UI */
                <form onSubmit={handleCreateTenantAccount} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.05)',
                    border: '1px solid rgba(59, 130, 246, 0.1)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)'
                  }}>
                    * Khách thuê chưa có tài khoản đăng nhập. Hãy tạo tài khoản mới để họ có thể tự tra cứu hóa đơn và chỉ số điện.
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tên hiển thị</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={accDisplayName}
                      onChange={(e) => setAccDisplayName(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tên đăng nhập (Username) *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="VD: nguyenvanthue"
                      required
                      value={accUsername}
                      onChange={(e) => setAccUsername(e.target.value.toLowerCase())}
                      style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email đăng ký *</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="VD: emailkhach@gmail.com"
                      required
                      value={accEmail}
                      onChange={(e) => setAccEmail(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Mật khẩu tạm thời *</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Tối thiểu 6 ký tự"
                      required
                      value={accPassword}
                      onChange={(e) => setAccPassword(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                      * Người dùng sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createAccLoading}
                    style={{ marginTop: '8px', padding: '10px' }}
                  >
                    {createAccLoading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản đăng nhập'}
                  </button>
                </form>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setAccountModalOpen(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
