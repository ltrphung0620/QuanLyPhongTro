import React, { useState, useEffect } from 'react'
import { Plus, UserPlus, Key, Mail, User, Shield, Search, Building } from 'lucide-react'
import { layDanhSachToChuc, layAdminsToChuc, taoTaiKhoanAdmin, resetMatKhauAdmin } from '../api'
import { useNotification } from '../context/NotificationContext'

export default function Admins() {
  const [orgs, setOrgs] = useState([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [admins, setAdmins] = useState([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [loadingAdmins, setLoadingAdmins] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const { toast, confirm } = useNotification()

  // Reset password states
  const [selectedAdminUser, setSelectedAdminUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  // Create admin form states
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    const fetchOrgs = async () => {
      setLoadingOrgs(true)
      try {
        const data = await layDanhSachToChuc()
        const activeOrgs = data.filter(org => org.isActive)
        setOrgs(activeOrgs)
        if (activeOrgs.length > 0) {
          setSelectedOrgId(activeOrgs[0].id)
        } else {
          setSelectedOrgId('')
        }
      } catch (err) {
        toast.error('Không thể tải danh sách tổ chức: ' + err.message)
      } finally {
        setLoadingOrgs(false)
      }
    }
    fetchOrgs()
  }, [])

  useEffect(() => {
    if (!selectedOrgId) {
      setAdmins([])
      return
    }

    const fetchAdmins = async () => {
      setLoadingAdmins(true)
      try {
        const data = await layAdminsToChuc(selectedOrgId)
        setAdmins(data)
      } catch (err) {
        toast.error('Không thể tải danh sách admin: ' + err.message)
      } finally {
        setLoadingAdmins(false)
      }
    }
    fetchAdmins()
  }, [selectedOrgId])

  const handleCreateAdmin = async (e) => {
    e.preventDefault()
    if (!username || !email || !password || !displayName) {
      toast.warning('Vui lòng nhập đầy đủ thông tin')
      return
    }

    setCreateLoading(true)
    try {
      await taoTaiKhoanAdmin(selectedOrgId, { username, email, password, displayName })
      toast.success('Tạo tài khoản Admin thành công!')
      setShowAddModal(false)
      // Reset form
      setUsername('')
      setEmail('')
      setPassword('')
      setDisplayName('')
      // Refresh list
      const data = await layAdminsToChuc(selectedOrgId)
      setAdmins(data)
    } catch (err) {
      toast.error('Lỗi khi tạo tài khoản Admin: ' + err.message)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      toast.warning('Mật khẩu mới phải tối thiểu 6 ký tự')
      return
    }

    setResetLoading(true)
    try {
      await resetMatKhauAdmin(selectedAdminUser.id, newPassword)
      toast.success(`Đặt lại mật khẩu cho Admin "${selectedAdminUser.displayName}" thành công!`)
      setShowResetModal(false)
      setNewPassword('')
      setSelectedAdminUser(null)
    } catch (err) {
      toast.error('Lỗi đặt lại mật khẩu: ' + err.message)
    } finally {
      setResetLoading(false)
    }
  }

  const selectedOrgName = orgs.find(o => o.id === Number(selectedOrgId))?.name || 'Tổ chức'

  return (
    <div className="page-container" style={{ padding: '24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Quản lý Tài khoản Admin</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Provision và quản trị tài khoản quản lý/chủ trọ thuộc các tổ chức</p>
        </div>
        <div>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowAddModal(true)}
            disabled={!selectedOrgId}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UserPlus size={16} />
            <span>Thêm tài khoản Admin</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left: Organization selector */}
        <div style={{
          background: 'var(--bg-secondary, #fff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={16} style={{ color: 'var(--primary-color)' }} />
            <span>Chọn tổ chức</span>
          </h3>
          {loadingOrgs ? (
            <div>Đang tải...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {orgs.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  Không có tổ chức đang hoạt động.
                </div>
              ) : orgs.map(org => (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrgId(org.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: selectedOrgId === org.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    color: selectedOrgId === org.id ? 'var(--primary-color, #3b82f6)' : 'var(--text-primary)',
                    fontWeight: selectedOrgId === org.id ? 600 : 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Code: {org.code}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Admin List */}
        <div style={{
          background: 'var(--bg-secondary, #fff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
            Danh sách Admin - {selectedOrgName}
          </h3>

          {loadingAdmins ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>Đang tải danh sách Admin...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Họ tên / Username</th>
                    <th style={{ padding: '10px 8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Email</th>
                    <th style={{ padding: '10px 8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Trạng thái</th>
                    <th style={{ padding: '10px 8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>Chưa có tài khoản Admin nào được tạo</td>
                    </tr>
                  ) : (
                    admins.map(admin => (
                      <tr key={admin.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'rgba(59, 130, 246, 0.1)',
                              color: 'var(--primary-color)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 600,
                              fontSize: '0.8rem'
                            }}>
                              {admin.displayName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{admin.displayName}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{admin.username}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: '0.88rem', color: 'var(--text-primary)' }}>{admin.email}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{
                              alignSelf: 'flex-start',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              background: admin.isActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: admin.isActive ? 'var(--text-success)' : 'var(--text-danger)'
                            }}>
                              {admin.isActive ? 'Active' : 'Locked'}
                            </span>
                            {admin.mustChangePassword && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-warning, #f59e0b)', fontWeight: 500 }}>
                                * Yêu cầu đổi mật khẩu
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedAdminUser(admin)
                              setShowResetModal(true)
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '0.8rem' }}
                          >
                            <Key size={12} />
                            <span>Reset Pass</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Add Admin */}
      {showAddModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }} onClick={() => setShowAddModal(false)}>
          <div className="modal-content" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Tạo Admin cho {selectedOrgName}</h3>
              <button className="btn-icon-only close-btn" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateAdmin}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Tên hiển thị *</label>
                  <input 
                    type="text" 
                    required 
                    value={displayName} 
                    onChange={(e) => setDisplayName(e.target.value)} 
                    placeholder="VD: Nguyễn Hùng Nam"
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Tên đăng nhập (Username) *</label>
                  <input 
                    type="text" 
                    required 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value.toLowerCase())} 
                    placeholder="VD: hungnamhcm"
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Email liên hệ *</label>
                  <input 
                    type="email" 
                    required 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="VD: hungnamhcm@gmail.com"
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Mật khẩu tạm thời *</label>
                  <input 
                    type="password" 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Tối thiểu 6 ký tự"
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>* Admin sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.</span>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '16px 24px', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={createLoading}>
                  {createLoading ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {showResetModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }} onClick={() => {
          setShowResetModal(false)
          setSelectedAdminUser(null)
        }}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Đặt lại mật khẩu</h3>
              <button className="btn-icon-only close-btn" onClick={() => {
                setShowResetModal(false)
                setSelectedAdminUser(null)
              }}>×</button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  Bạn đang đặt lại mật khẩu cho tài khoản admin: <strong>{selectedAdminUser?.displayName} ({selectedAdminUser?.username})</strong>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Mật khẩu mới *</label>
                  <input 
                    type="password" 
                    required 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>* Admin sẽ được yêu cầu đổi lại mật khẩu này ở lần đăng nhập tiếp theo.</span>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '16px 24px', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowResetModal(false)
                  setSelectedAdminUser(null)
                }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={resetLoading}>
                  {resetLoading ? 'Đang thực hiện...' : 'Đặt lại mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
