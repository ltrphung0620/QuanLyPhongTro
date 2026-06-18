import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Home, 
  Users, 
  FileText, 
  Zap, 
  Receipt, 
  History,
  LogOut 
} from 'lucide-react'
import './Sidebar.css'

export default function Sidebar({ isOpen }) {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  const menuItems = [
    { path: '/', label: 'Tổng Quan', icon: LayoutDashboard },
    { path: '/rooms', label: 'Quản Lý Phòng', icon: Home },
    { path: '/tenants', label: 'Khách Thuê', icon: Users },
    { path: '/contracts', label: 'Hợp Đồng', icon: FileText },
    { path: '/meter-readings', label: 'Chỉ Số Điện Nước', icon: Zap },
    { path: '/invoices', label: 'Hóa Đơn', icon: Receipt },
    { path: '/payments', label: 'Lịch Sử Giao Dịch', icon: History },
  ]

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-logo">
          <Home size={20} className="brand-logo-icon" />
        </div>
        <div className="brand-info">
          <h2>NhaTro Premium</h2>
          <span>Quản lý phòng trọ</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item) => {
            const IconComponent = item.icon
            return (
              <li key={item.path}>
                <NavLink 
                  to={item.path} 
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  end={item.path === '/'}
                >
                  <IconComponent size={19} className="link-icon" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-card">
          <div className="user-avatar-mini">QT</div>
          <div className="user-info-mini">
            <h4>Quản trị viên</h4>
            <span>Chủ nhà trọ</span>
          </div>
        </div>
        <button className="btn-logout" onClick={handleLogout}>
          <LogOut size={18} className="link-icon" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  )
}
