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
  ShieldAlert
} from 'lucide-react'
import { layDanhSachNguoiThue, themNguoiThue, suaNguoiThue } from '../api'
import './Tenants.css'

export default function Tenants() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
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
                        <button 
                          className="btn-card-edit" 
                          onClick={() => handleOpenEditModal(tenant)}
                          title="Sửa hồ sơ"
                        >
                          <Edit3 size={16} />
                        </button>
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
    </div>
  )
}
