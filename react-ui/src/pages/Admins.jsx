import { useEffect, useMemo, useState } from 'react'
import { Building, Edit3, Key, Shield, ShieldCheck, UserPlus } from 'lucide-react'
import {
  layDanhSachToChuc,
  resetMatKhauAdmin,
  suaThongTinAdmin,
  layDanhSachAdminsAll,
  taoTaiKhoanAdminAll
} from '../api'
import { useNotification } from '../context/NotificationContext'
import { ADMIN_PAGE_PERMISSION_KEYS, ADMIN_PAGE_PERMISSIONS } from '../adminPermissions'

function OrgMembershipConfigSection({ org, config, onChange }) {
  const toggleChecked = () => {
    onChange({ ...config, checked: !config.checked })
  }
  const toggleFullAccess = (val) => {
    onChange({ ...config, hasFullAccess: val })
  }
  const togglePagePermission = (key) => {
    const newPerms = config.pagePermissions.includes(key)
      ? config.pagePermissions.filter(p => p !== key)
      : [...config.pagePermissions, key]
    onChange({ ...config, pagePermissions: newPerms })
  }

  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      background: config.checked ? 'var(--accent-glow)' : 'var(--bg-secondary)',
      transition: 'all 0.2s ease',
      textAlign: 'left'
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>
        <input type="checkbox" checked={config.checked} onChange={toggleChecked} />
        <span>{org.name}</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>Mã: {org.code}</span>
      </label>

      {config.checked && (
        <div style={{ marginTop: 12, paddingLeft: 24, borderLeft: '2px solid var(--accent)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 12, fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.hasFullAccess}
              onChange={(e) => toggleFullAccess(e.target.checked)}
            />
            <span>Cho phép truy cập tất cả trang</span>
          </label>

          {!config.hasFullAccess && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 8,
              marginTop: 8
            }}>
              {ADMIN_PAGE_PERMISSIONS.map(item => {
                const Icon = item.icon
                const isSelected = config.pagePermissions.includes(item.key)
                return (
                  <label
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      background: isSelected ? 'var(--success-light)' : 'var(--bg-card)',
                      color: isSelected ? 'var(--success)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePagePermission(item.key)}
                    />
                    <Icon size={14} />
                    <span>{item.label}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Admins() {
  const [orgs, setOrgs] = useState([])
  const [admins, setAdmins] = useState([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [loadingAdmins, setLoadingAdmins] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const { toast } = useNotification()

  const [selectedAdminUser, setSelectedAdminUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  // Organization memberships and permissions configuration state
  const [selectedOrgsConfig, setSelectedOrgsConfig] = useState({})

  const [createLoading, setCreateLoading] = useState(false)

  const [editDisplayName, setEditDisplayName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [editLoading, setEditLoading] = useState(false)

  const buildMembershipsPayload = () => {
    const payload = []
    Object.keys(selectedOrgsConfig).forEach(orgId => {
      const cfg = selectedOrgsConfig[orgId]
      if (cfg.checked) {
        payload.push({
          organizationId: Number(orgId),
          hasFullAccess: cfg.hasFullAccess,
          pagePermissions: cfg.hasFullAccess ? [] : cfg.pagePermissions
        })
      }
    })
    return payload
  }

  const resetCreateForm = () => {
    setUsername('')
    setEmail('')
    setPassword('')
    setDisplayName('')

    // Default config: all organizations unchecked
    const initialConfig = {}
    orgs.forEach(org => {
      initialConfig[org.id] = {
        checked: false,
        hasFullAccess: true,
        pagePermissions: []
      }
    })
    setSelectedOrgsConfig(initialConfig)
  }

  const openAddModal = () => {
    resetCreateForm()
    setShowAddModal(true)
  }

  const refreshAdmins = async () => {
    setLoadingAdmins(true)
    try {
      const data = await layDanhSachAdminsAll()
      setAdmins(data)
    } catch (err) {
      toast.error('Không thể tải danh sách admin: ' + err.message)
    } finally {
      setLoadingAdmins(false)
    }
  }

  useEffect(() => {
    const initData = async () => {
      setLoadingOrgs(true)
      try {
        const data = await layDanhSachToChuc()
        const activeOrgs = data.filter(org => org.isActive)
        setOrgs(activeOrgs)
      } catch (err) {
        toast.error('Không thể tải danh sách tổ chức: ' + err.message)
      } finally {
        setLoadingOrgs(false)
      }

      await refreshAdmins()
    }
    initData()
  }, [])

  const handleCreateAdmin = async (e) => {
    e.preventDefault()
    if (!username || !email || !password || !displayName) {
      toast.warning('Vui lòng nhập đầy đủ thông tin')
      return
    }

    const memberships = buildMembershipsPayload()
    if (memberships.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một tổ chức để Admin quản lý')
      return
    }

    // Validate page permissions if not full access
    for (const m of memberships) {
      if (!m.hasFullAccess && m.pagePermissions.length === 0) {
        const orgName = orgs.find(o => o.id === m.organizationId)?.name || 'Tổ chức'
        toast.warning(`Vui lòng chọn ít nhất một trang được phép truy cập cho tổ chức: ${orgName}`)
        return
      }
    }

    setCreateLoading(true)
    try {
      await taoTaiKhoanAdminAll({
        username,
        email,
        password,
        displayName,
        memberships
      })
      toast.success('Tạo tài khoản Admin thành công!')
      setShowAddModal(false)
      resetCreateForm()
      await refreshAdmins()
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

  const openEditModal = (admin) => {
    setSelectedAdminUser(admin)
    setEditDisplayName(admin.displayName || '')
    setEditUsername(admin.username || '')
    setEditEmail(admin.email || '')
    setEditIsActive(admin.isActive === true)

    // Initialize memberships configuration from admin.organizations
    const initialConfig = {}
    orgs.forEach(org => {
      const matched = admin.organizations?.find(o => o.id === org.id)
      if (matched) {
        initialConfig[org.id] = {
          checked: true,
          hasFullAccess: matched.hasFullAccess,
          pagePermissions: matched.pagePermissions || []
        }
      } else {
        initialConfig[org.id] = {
          checked: false,
          hasFullAccess: true,
          pagePermissions: []
        }
      }
    })
    setSelectedOrgsConfig(initialConfig)

    setShowEditModal(true)
  }

  const handleEditAdmin = async (e) => {
    e.preventDefault()
    if (!editDisplayName || !editUsername || !editEmail) {
      toast.warning('Vui lòng nhập đầy đủ thông tin')
      return
    }

    const memberships = buildMembershipsPayload()
    if (memberships.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một tổ chức để Admin quản lý')
      return
    }

    // Validate page permissions if not full access
    for (const m of memberships) {
      if (!m.hasFullAccess && m.pagePermissions.length === 0) {
        const orgName = orgs.find(o => o.id === m.organizationId)?.name || 'Tổ chức'
        toast.warning(`Vui lòng chọn ít nhất một trang được phép truy cập cho tổ chức: ${orgName}`)
        return
      }
    }

    setEditLoading(true)
    try {
      await suaThongTinAdmin(selectedAdminUser.id, {
        displayName: editDisplayName,
        username: editUsername.toLowerCase(),
        email: editEmail,
        isActive: editIsActive,
        memberships
      })
      toast.success('Cập nhật thông tin Admin thành công!')
      setShowEditModal(false)
      setSelectedAdminUser(null)
      await refreshAdmins()
    } catch (err) {
      toast.error('Lỗi cập nhật thông tin: ' + err.message)
    } finally {
      setEditLoading(false)
    }
  }

  const renderPermissionSummary = (admin) => {
    if (admin.hasFullAccess) return 'Tất cả trang'
    const keys = Array.isArray(admin.pagePermissions) ? admin.pagePermissions : []
    if (keys.length === 0) return 'Chưa cấp quyền'
    if (keys.length <= 2) {
      return keys
        .map(key => ADMIN_PAGE_PERMISSIONS.find(item => item.key === key)?.label || key)
        .join(', ')
    }
    return `${keys.length} trang`
  }

  return (
    <div className="page-container" style={{ padding: 24, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Quản lý Tài khoản Admin</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Tạo tài khoản chủ trọ và gán tổ chức quản lý kèm phân quyền chi tiết.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={openAddModal}
          disabled={orgs.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <UserPlus size={16} />
          <span>Thêm tài khoản Admin</span>
        </button>
      </div>

      <div style={{ background: 'var(--bg-secondary, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Danh sách tài khoản Admin
          </h3>
        </div>

        {loadingAdmins ? (
          <div style={{ padding: 40, textAlign: 'center' }}>Đang tải danh sách Admin...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '10px 8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Họ tên / Username & Tổ chức quản lý</th>
                  <th style={{ padding: '10px 8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Email</th>
                  <th style={{ padding: '10px 8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Trạng thái</th>
                  <th style={{ padding: '10px 8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Chưa có tài khoản Admin nào được tạo
                    </td>
                  </tr>
                ) : admins.map(admin => (
                  <tr key={admin.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: 'var(--accent-glow)',
                          color: 'var(--accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          marginTop: 2,
                          flexShrink: 0
                        }}>
                          {(admin.displayName || admin.username || 'AD').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{admin.displayName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>@{admin.username}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            {admin.organizations?.length === 0 ? (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa gán tổ chức</span>
                            ) : (
                              admin.organizations?.map(org => (
                                <span key={org.id} style={{
                                  fontSize: '0.68rem',
                                  background: org.hasFullAccess ? 'var(--success-light, rgba(62, 107, 92, 0.08))' : 'var(--accent-glow)',
                                  color: org.hasFullAccess ? 'var(--success)' : 'var(--accent)',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontWeight: 600,
                                  border: '1px solid var(--border-color)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}>
                                  {org.hasFullAccess ? <ShieldCheck size={11} /> : <Shield size={11} />}
                                  <span>{org.name} {org.hasFullAccess ? '(Toàn quyền)' : `(${org.pagePermissions?.length || 0} trang)`}</span>
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '0.88rem', color: 'var(--text-primary)' }}>{admin.email}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{
                          alignSelf: 'flex-start',
                          padding: '2px 6px',
                          borderRadius: 10,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          background: admin.isActive ? 'var(--success-light)' : 'var(--danger-light)',
                          color: admin.isActive ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {admin.isActive ? 'Hoạt động' : 'Đã khóa'}
                        </span>
                        {admin.mustChangePassword && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--warning)', fontWeight: 500 }}>
                            * Yêu cầu đổi mật khẩu
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditModal(admin)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: '0.8rem' }}
                        >
                          <Edit3 size={12} />
                          <span>Sửa / Quyền</span>
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedAdminUser(admin)
                            setShowResetModal(true)
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: '0.8rem' }}
                        >
                          <Key size={12} />
                          <span>Reset Pass</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }} onClick={() => setShowAddModal(false)}>
          <div className="modal-content" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Tạo Admin</h3>
              <button className="btn-icon-only close-btn" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateAdmin}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', fontWeight: 600 }}>
                    Tên hiển thị *
                    <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="VD: Nguyễn Hùng Nam" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', fontWeight: 600 }}>
                    Tên đăng nhập *
                    <input type="text" required value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="VD: hungnamhcm" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', fontWeight: 600 }}>
                    Email liên hệ *
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="VD: hungnamhcm@gmail.com" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', fontWeight: 600 }}>
                    Mật khẩu tạm thời *
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)' }} />
                  </label>
                </div>

                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 850, marginBottom: 12 }}>Tổ chức & Quyền truy cập</div>
                  <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: 4 }}>
                    {orgs.map(org => (
                      <OrgMembershipConfigSection
                        key={org.id}
                        org={org}
                        config={selectedOrgsConfig[org.id] || { checked: false, hasFullAccess: true, pagePermissions: [] }}
                        onChange={(newCfg) => {
                          setSelectedOrgsConfig(prev => ({
                            ...prev,
                            [org.id]: newCfg
                          }))
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '16px 24px', gap: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={createLoading}>
                  {createLoading ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }} onClick={() => {
          setShowResetModal(false)
          setSelectedAdminUser(null)
        }}>
          <div className="modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Đặt lại mật khẩu</h3>
              <button className="btn-icon-only close-btn" onClick={() => {
                setShowResetModal(false)
                setSelectedAdminUser(null)
              }}>×</button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  Bạn đang đặt lại mật khẩu cho tài khoản admin: <strong>{selectedAdminUser?.displayName} ({selectedAdminUser?.username})</strong>
                </p>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', fontWeight: 600 }}>
                  Mật khẩu mới *
                  <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mật khẩu mới tối thiểu 6 ký tự" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)' }} />
                </label>
              </div>
              <div className="modal-footer" style={{ padding: '16px 24px', gap: 12 }}>
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

      {showEditModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }} onClick={() => {
          setShowEditModal(false)
          setSelectedAdminUser(null)
        }}>
          <div className="modal-content" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Sửa thông tin Admin</h3>
              <button className="btn-icon-only close-btn" onClick={() => {
                setShowEditModal(false)
                setSelectedAdminUser(null)
              }}>×</button>
            </div>
            <form onSubmit={handleEditAdmin}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', fontWeight: 600 }}>
                    Tên hiển thị *
                    <input type="text" required value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} placeholder="VD: Nguyễn Hùng Nam" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', fontWeight: 600 }}>
                    Tên đăng nhập *
                    <input type="text" required value={editUsername} onChange={(e) => setEditUsername(e.target.value.toLowerCase())} placeholder="VD: hungnamhcm" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', fontWeight: 600 }}>
                    Email liên hệ *
                    <input type="email" required value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="VD: hungnamhcm@gmail.com" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)' }} />
                  </label>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', fontWeight: 600, marginTop: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} />
                  <span>Kích hoạt tài khoản (Cho phép hoạt động)</span>
                </label>

                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 850, marginBottom: 12 }}>Tổ chức & Quyền truy cập</div>
                  <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: 4 }}>
                    {orgs.map(org => (
                      <OrgMembershipConfigSection
                        key={org.id}
                        org={org}
                        config={selectedOrgsConfig[org.id] || { checked: false, hasFullAccess: true, pagePermissions: [] }}
                        onChange={(newCfg) => {
                          setSelectedOrgsConfig(prev => ({
                            ...prev,
                            [org.id]: newCfg
                          }))
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '16px 24px', gap: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowEditModal(false)
                  setSelectedAdminUser(null)
                }}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
