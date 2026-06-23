import React, { useEffect, useMemo, useState } from 'react'
import { Building, Edit3, Mail, Phone, Plus, RefreshCw, Search, ToggleLeft, ToggleRight, User } from 'lucide-react'
import { layDanhSachToChuc, suaToChuc, taoToChuc, toggleToChuc } from '../api'
import { useNotification } from '../context/NotificationContext'

const emptyForm = {
  name: '',
  code: '',
  ownerName: '',
  phone: '',
  email: ''
}

export default function Organizations() {
  const { toast, confirm } = useNotification()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [submitLoading, setSubmitLoading] = useState(false)

  const fetchOrgs = async () => {
    setLoading(true)
    try {
      setOrgs(await layDanhSachToChuc())
    } catch (err) {
      toast.error('Không thể tải danh sách tổ chức: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrgs()
  }, [])

  const filteredOrgs = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return orgs

    return orgs.filter((org) =>
      org.name?.toLowerCase().includes(keyword) ||
      org.code?.toLowerCase().includes(keyword) ||
      org.ownerName?.toLowerCase().includes(keyword)
    )
  }, [orgs, searchTerm])

  const activeOrgs = filteredOrgs.filter((org) => org.isActive)
  const lockedOrgs = filteredOrgs.filter((org) => !org.isActive)

  const openCreate = () => {
    setEditingOrg(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (org) => {
    setEditingOrg(org)
    setForm({
      name: org.name || '',
      code: org.code || '',
      ownerName: org.ownerName || '',
      phone: org.phone || '',
      email: org.email || ''
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingOrg(null)
    setForm(emptyForm)
  }

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.code.trim()) {
      toast.warning('Tên tổ chức và mã tổ chức là bắt buộc')
      return
    }

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      ownerName: form.ownerName.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: null
    }

    setSubmitLoading(true)
    try {
      if (editingOrg) {
        await suaToChuc(editingOrg.id, payload)
        toast.success('Cập nhật tổ chức thành công')
      } else {
        await taoToChuc(payload)
        toast.success('Tạo tổ chức thành công')
      }

      closeModal()
      fetchOrgs()
    } catch (err) {
      toast.error((editingOrg ? 'Lỗi khi cập nhật tổ chức: ' : 'Lỗi khi tạo tổ chức: ') + err.message)
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleToggleActive = async (org) => {
    const action = org.isActive ? 'khóa' : 'mở khóa'
    const ok = await confirm(
      `Bạn có chắc chắn muốn ${action} tổ chức "${org.name}"?`,
      'Xác nhận thay đổi trạng thái'
    )
    if (!ok) return

    try {
      await toggleToChuc(org.id, !org.isActive)
      toast.success(`${org.isActive ? 'Khóa' : 'Mở khóa'} tổ chức thành công`)
      fetchOrgs()
    } catch (err) {
      toast.error('Lỗi khi thay đổi trạng thái: ' + err.message)
    }
  }

  return (
    <div className="page-container" style={{ padding: 24, fontFamily: 'Inter, sans-serif' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Danh sách Tổ chức / Chủ trọ
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Quản lý thông tin và trạng thái các tổ chức đang sử dụng phần mềm
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={fetchOrgs} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
            <span>Làm mới</span>
          </button>
          <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} />
            <span>Thêm tổ chức</span>
          </button>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary, #fff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 10
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
        <div style={{ textAlign: 'center', padding: 60 }}>Đang tải danh sách tổ chức...</div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>
          <OrganizationSection
            title="Đang hoạt động"
            count={activeOrgs.length}
            orgs={activeOrgs}
            emptyText="Không có tổ chức đang hoạt động"
            onEdit={openEdit}
            onToggle={handleToggleActive}
          />
          <OrganizationSection
            title="Đã khóa"
            count={lockedOrgs.length}
            orgs={lockedOrgs}
            emptyText="Không có tổ chức đã khóa"
            onEdit={openEdit}
            onToggle={handleToggleActive}
          />
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" style={{ zIndex: 100 }} onClick={closeModal}>
          <div className="modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingOrg ? 'Sửa thông tin tổ chức' : 'Thêm tổ chức mới'}</h3>
              <button className="btn-icon-only close-btn" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Tên tổ chức *">
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => updateForm('name', e.target.value)}
                      placeholder="VD: Nhà trọ Hùng Nam"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Mã tổ chức *">
                    <input
                      type="text"
                      required
                      value={form.code}
                      onChange={(e) => updateForm('code', e.target.value.toUpperCase())}
                      placeholder="VD: HUNGNAM"
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <Field label="Người đại diện">
                  <input
                    type="text"
                    value={form.ownerName}
                    onChange={(e) => updateForm('ownerName', e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    style={inputStyle}
                  />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Số điện thoại">
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => updateForm('phone', e.target.value)}
                      placeholder="Số điện thoại liên hệ"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateForm('email', e.target.value)}
                      placeholder="Email liên hệ"
                      style={inputStyle}
                    />
                  </Field>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '16px 24px', gap: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                  {submitLoading ? 'Đang lưu...' : editingOrg ? 'Lưu thay đổi' : 'Thêm tổ chức'}
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

function OrganizationSection({ title, count, orgs, emptyText, onEdit, onToggle }) {
  return (
    <section style={{
      background: 'var(--bg-secondary, #fff)',
      border: '1px solid var(--border-color, #e2e8f0)',
      borderRadius: 12,
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-color, #e2e8f0)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-primary, #f8fafc)'
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{count} tổ chức</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={thStyle}>Mã / Tên</th>
              <th style={thStyle}>Người đại diện</th>
              <th style={thStyle}>Liên hệ</th>
              <th style={thStyle}>Trạng thái</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {orgs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              orgs.map((org) => (
                <tr key={org.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        background: org.isActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                        color: org.isActive ? 'var(--primary-color, #3b82f6)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Building size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{org.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>Code: {org.code}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                      <User size={14} style={{ color: 'var(--text-secondary)' }} />
                      <span>{org.ownerName || 'N/A'}</span>
                    </div>
                  </td>
                  <td style={{ padding: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem' }}>
                      {org.phone ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
                          <Phone size={12} style={{ color: 'var(--text-secondary)' }} />
                          <span>{org.phone}</span>
                        </div>
                      ) : null}
                      {org.email ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
                          <Mail size={12} style={{ color: 'var(--text-secondary)' }} />
                          <span>{org.email}</span>
                        </div>
                      ) : null}
                      {!org.phone && !org.email ? <span style={{ color: 'var(--text-secondary)' }}>N/A</span> : null}
                    </div>
                  </td>
                  <td style={{ padding: 16 }}>
                    <span style={{
                      display: 'inline-flex',
                      padding: '4px 8px',
                      borderRadius: 12,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: org.isActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: org.isActive ? 'var(--text-success, #22c55e)' : 'var(--text-danger, #ef4444)'
                    }}>
                      {org.isActive ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td style={{ padding: 16, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <button type="button" onClick={() => onEdit(org)} style={actionButtonStyle}>
                        <Edit3 size={16} />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggle(org)}
                        style={{
                          ...actionButtonStyle,
                          color: org.isActive ? 'var(--text-danger, #ef4444)' : 'var(--text-success, #22c55e)'
                        }}
                      >
                        {org.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                        <span>{org.isActive ? 'Khóa' : 'Mở'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--border-color)'
}

const thStyle = {
  padding: '14px 16px',
  fontSize: '0.8rem',
  fontWeight: 700,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase'
}

const actionButtonStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 6,
  color: 'var(--text-primary)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontWeight: 700,
  fontSize: '0.85rem'
}
