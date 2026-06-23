import React, { useState, useEffect } from 'react'
import { Plus, ToggleLeft, ToggleRight, Building, Phone, Mail, MapPin, User, Search, RefreshCw } from 'lucide-react'
import { layDanhSachToChuc, taoToChuc, toggleToChuc } from '../api'
import { useNotification } from '../context/NotificationContext'

export default function Organizations() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const { toast, confirm } = useNotification()

  // Form states
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  const fetchOrgs = async () => {
    setLoading(true)
    try {
      const data = await layDanhSachToChuc()
      setOrgs(data)
    } catch (err) {
      toast.error('Không thể tải danh sách tổ chức: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrgs()
  }, [])

  const handleToggleActive = async (org) => {
    const action = org.isActive ? 'Khóa' : 'Mở khóa'
    const ok = await confirm(`Bạn có chắc chắn muốn ${action.toLowerCase()} tổ chức "${org.name}"?`, `Xác nhận thay đổi trạng thái`)
    if (!ok) return

    try {
      await toggleToChuc(org.id, !org.isActive)
      toast.success(`${action} tổ chức thành công!`)
      fetchOrgs()
    } catch (err) {
      toast.error('Lỗi khi thay đổi trạng thái: ' + err.message)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name || !code) {
      toast.warning('Tên tổ chức và Mã tổ chức là bắt buộc')
      return
    }

    setSubmitLoading(true)
    try {
      await taoToChuc({ name, code, ownerName, phone, email, address })
      toast.success('Tạo tổ chức thành công!')
      setShowModal(false)
      // Reset form
      setName('')
      setCode('')
      setOwnerName('')
      setPhone('')
      setEmail('')
      setAddress('')
      fetchOrgs()
    } catch (err) {
      toast.error('Lỗi khi tạo tổ chức: ' + err.message)
    } finally {
      setSubmitLoading(false)
    }
  }

  const filteredOrgs = orgs.filter(o => 
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.ownerName && o.ownerName.toLowerCase().includes(searchTerm.toLowerCase()))
  )

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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Danh sách Tổ chức / Chủ trọ</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Quản lý hoạt động các tổ chức đối tác sử dụng phần mềm</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={fetchOrgs} 
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
            <span>Làm mới</span>
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Thêm tổ chức</span>
          </button>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary, #fff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <Search size={18} style={{ color: 'var(--text-secondary)' }} />
        <input 
          type="text" 
          placeholder="Tìm kiếm theo tên, mã hoặc tên chủ trọ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '0.9rem',
            background: 'transparent',
            color: 'var(--text-primary)'
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>Đang tải danh sách tổ chức...</div>
      ) : (
        <div style={{
          background: 'var(--bg-secondary, #fff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary, #f8fafc)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Mã / Tên</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Người đại diện</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Liên hệ</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Địa chỉ</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Trạng thái</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Không tìm thấy tổ chức nào</td>
                  </tr>
                ) : (
                  filteredOrgs.map((org) => (
                    <tr key={org.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '8px',
                            background: org.isActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                            color: org.isActive ? 'var(--primary-color, #3b82f6)' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Building size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{org.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Code: {org.code}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                          <User size={14} style={{ color: 'var(--text-secondary)' }} />
                          <span>{org.ownerName || 'N/A'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
                          {org.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                              <Phone size={12} style={{ color: 'var(--text-secondary)' }} />
                              <span>{org.phone}</span>
                            </div>
                          )}
                          {org.email && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                              <Mail size={12} style={{ color: 'var(--text-secondary)' }} />
                              <span>{org.email}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px', maxWidth: '250px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                          <MapPin size={12} style={{ color: 'var(--text-secondary)', marginTop: '2px', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {org.address || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: org.isActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: org.isActive ? 'var(--text-success, #22c55e)' : 'var(--text-danger, #ef4444)'
                        }}>
                          {org.isActive ? 'Hoạt động' : 'Đã khóa'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleToggleActive(org)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '6px',
                            color: org.isActive ? 'var(--text-danger, #ef4444)' : 'var(--text-success, #22c55e)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 500,
                            fontSize: '0.85rem'
                          }}
                        >
                          {org.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          <span>{org.isActive ? 'Khóa' : 'Mở'}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal create */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }} onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Thêm tổ chức mới</h3>
              <button className="btn-icon-only close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Tên tổ chức *</label>
                    <input 
                      type="text" 
                      required 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      placeholder="VD: Nhà trọ Hùng Nam"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Mã tổ chức *</label>
                    <input 
                      type="text" 
                      required 
                      value={code} 
                      onChange={(e) => setCode(e.target.value.toUpperCase())} 
                      placeholder="VD: HUNGNAM"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Người đại diện</label>
                  <input 
                    type="text" 
                    value={ownerName} 
                    onChange={(e) => setOwnerName(e.target.value)} 
                    placeholder="VD: Nguyễn Văn A"
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Số điện thoại</label>
                    <input 
                      type="text" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                      placeholder="Số điện thoại liên hệ"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Email</label>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="Email liên hệ"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Địa chỉ</label>
                  <textarea 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)} 
                    placeholder="Địa chỉ trụ sở / tòa nhà trọ chính"
                    rows="3"
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', resize: 'vertical' }}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '16px 24px', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                  {submitLoading ? 'Đang lưu...' : 'Thêm tổ chức'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
