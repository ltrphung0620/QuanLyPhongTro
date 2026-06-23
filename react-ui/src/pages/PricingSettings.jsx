import React, { useEffect, useState } from 'react'
import { Plus, Save, Trash2, Zap, Droplet, Coins, AlertCircle } from 'lucide-react'
import { capNhatCauHinhGia, layCauHinhGia } from '../api'
import { useNotification } from '../context/NotificationContext'
import './PricingSettings.css'

export default function PricingSettings() {
  const { toast } = useNotification()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    electricityUnitPrice: 3500,
    waterFeePerPerson: 50000,
    trashFee: 30000,
    customServices: []
  })

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await layCauHinhGia()
      setForm({
        electricityUnitPrice: data.electricityUnitPrice ?? 3500,
        waterFeePerPerson: data.waterFeePerPerson ?? 50000,
        trashFee: data.trashFee ?? 30000,
        customServices: data.customServices ?? []
      })
    } catch (err) {
      toast.error('Không thể tải cấu hình giá: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const updateNumber = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateCustomService = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      customServices: prev.customServices.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }))
  }

  const addCustomService = () => {
    setForm((prev) => ({
      ...prev,
      customServices: [
        ...prev.customServices,
        { name: '', amount: 0, chargeUnit: 'month' }
      ]
    }))
  }

  const removeCustomService = (index) => {
    setForm((prev) => ({
      ...prev,
      customServices: prev.customServices.filter((_, itemIndex) => itemIndex !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        electricityUnitPrice: Number(form.electricityUnitPrice) || 0,
        waterFeePerPerson: Number(form.waterFeePerPerson) || 0,
        trashFee: Number(form.trashFee) || 0,
        customServices: form.customServices
          .filter((item) => item.name.trim())
          .map((item) => ({
            name: item.name.trim(),
            amount: Number(item.amount) || 0,
            chargeUnit: item.chargeUnit || 'month'
          }))
      }
      const saved = await capNhatCauHinhGia(payload)
      setForm(saved)
      toast.success('Đã cập nhật bảng giá dịch vụ.')
    } catch (err) {
      toast.error('Không thể lưu bảng giá: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-body">
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
          Đang tải bảng giá dịch vụ...
        </div>
      </div>
    )
  }

  return (
    <div className="page-body pricing-settings-body">
      {/* Title Header */}
      <div className="invoices-header">
        <div>
          <h1>Quản Lý Giá Dịch Vụ</h1>
          <p className="subtitle">Cập nhật đơn giá điện, nước, rác và các phụ phí sinh hoạt của toàn bộ hệ thống</p>
        </div>
      </div>

      {/* Info Alert Banner */}
      <div className="pricing-alert-info">
        <AlertCircle size={20} className="alert-icon" />
        <div className="alert-text">
          <h4>Nguyên tắc áp dụng giá</h4>
          <p>
            Đơn giá thay đổi tại đây **chỉ ảnh hưởng đến các hóa đơn và chỉ số điện nước tạo mới** sau thời điểm đổi giá. 
            Tất cả hóa đơn đã lập trước đó đều được bảo lưu lịch sử đơn giá gốc, đảm bảo tính minh bạch tài chính.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Core Utility pricing card */}
        <div className="pricing-card">
          <div className="pricing-card-header">
            <div>
              <h3>Đơn giá tiện ích cơ bản</h3>
              <p>Đơn giá áp dụng mặc định cho điện, nước sinh hoạt và vệ sinh</p>
            </div>
          </div>
          <div className="pricing-card-body">
            <div className="pricing-row-grid">
              {/* Electricity */}
              <div className="form-group">
                <div className="rate-badge rate-badge--zap">
                  <Zap size={18} />
                </div>
                <label className="form-label">Đơn giá điện</label>
                <div className="price-input-wrapper">
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={form.electricityUnitPrice}
                    onChange={(e) => updateNumber('electricityUnitPrice', e.target.value)}
                    required
                  />
                  <span className="price-input-suffix">đ / kWh</span>
                </div>
              </div>

              {/* Water */}
              <div className="form-group">
                <div className="rate-badge rate-badge--droplet">
                  <Droplet size={18} />
                </div>
                <label className="form-label">Đơn giá nước</label>
                <div className="price-input-wrapper">
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={form.waterFeePerPerson}
                    onChange={(e) => updateNumber('waterFeePerPerson', e.target.value)}
                    required
                  />
                  <span className="price-input-suffix">đ / người</span>
                </div>
              </div>

              {/* Trash */}
              <div className="form-group">
                <div className="rate-badge rate-badge--trash">
                  <Trash2 size={18} />
                </div>
                <label className="form-label">Phí vệ sinh & rác</label>
                <div className="price-input-wrapper">
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={form.trashFee}
                    onChange={(e) => updateNumber('trashFee', e.target.value)}
                    required
                  />
                  <span className="price-input-suffix">đ / phòng</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Custom services pricing card */}
        <div className="pricing-card">
          <div className="pricing-card-header">
            <div>
              <h3>Danh mục dịch vụ & phí phát sinh khác</h3>
              <p>Danh sách các dịch vụ gia tăng tùy chọn khi lập hóa đơn cho từng phòng</p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={addCustomService} style={{ height: '38px' }}>
              <Plus size={16} />
              <span>Thêm loại phí</span>
            </button>
          </div>
          <div className="pricing-card-body">
            <div style={{ display: 'grid', gap: '8px' }}>
              {form.customServices.length === 0 ? (
                <div className="custom-services-empty">
                  <Coins size={36} className="text-muted" />
                  <span>Chưa cấu hình dịch vụ phụ nào. Nhấn nút "Thêm loại phí" để bắt đầu.</span>
                </div>
              ) : (
                form.customServices.map((item, index) => (
                  <div key={index} className="custom-service-row">
                    <div>
                      <input
                        type="text"
                        placeholder="Tên dịch vụ (VD: Mạng Internet, Xe máy...)"
                        className="form-control"
                        value={item.name}
                        onChange={(e) => updateCustomService(index, 'name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="price-input-wrapper">
                      <input
                        type="number"
                        min="0"
                        placeholder="Đơn giá"
                        className="form-control"
                        value={item.amount}
                        onChange={(e) => updateCustomService(index, 'amount', e.target.value)}
                        required
                      />
                      <span className="price-input-suffix">đ</span>
                    </div>
                    <div>
                      <select
                        className="form-control"
                        value={item.chargeUnit || 'month'}
                        onChange={(e) => updateCustomService(index, 'chargeUnit', e.target.value)}
                      >
                        <option value="month">Theo tháng</option>
                        <option value="person">Theo người</option>
                        <option value="room">Theo phòng</option>
                        <option value="usage">Theo phát sinh</option>
                      </select>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="btn-icon-only btn-danger-icon"
                        onClick={() => removeCustomService(index)}
                        title="Xóa loại phí"
                        style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="pricing-actions-bar">
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ height: '42px', padding: '0 24px' }}>
            <Save size={16} />
            <span>{saving ? 'Đang lưu bảng giá...' : 'Lưu thay đổi bảng giá'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
