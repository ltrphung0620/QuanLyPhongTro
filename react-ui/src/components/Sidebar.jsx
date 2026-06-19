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
  LogOut,
  FileSpreadsheet,
  Bot
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
    { path: '/reports', label: 'Báo Cáo Sổ Quỹ', icon: FileSpreadsheet },
    { path: '/assistant', label: 'Trợ Lý AI', icon: Bot },
  ]

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Brand header area removed as requested */}

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
