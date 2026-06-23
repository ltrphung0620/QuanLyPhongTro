import React from 'react'
import { NavLink } from 'react-router-dom'
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
  Bot,
  Key,
  Settings
} from 'lucide-react'
import './Sidebar.css'
import { useAuth } from '../context/AuthContext'

export default function Sidebar({ isOpen }) {
  const { user } = useAuth()

  // Dynamic menu items based on roles
  let menuItems = []
  if (user?.role === 'SuperAdmin') {
    menuItems = [
      { path: '/organizations', label: 'Quản lý Tổ chức', icon: Home },
      { path: '/admins', label: 'Tài khoản Admin', icon: Users },
    ]
  } else if (user?.role === 'Tenant') {
    menuItems = [
      { path: '/invoices', label: 'Hóa đơn của tôi', icon: Receipt },
      { path: '/meter-readings', label: 'Chỉ số điện nước', icon: Zap },
    ]
  } else {
    // Default Admin
    menuItems = [
      { path: '/', label: 'Tổng Quan', icon: LayoutDashboard },
      { path: '/rooms', label: 'Quản Lý Phòng', icon: Home },
      { path: '/tenants', label: 'Khách Thuê', icon: Users },
      { path: '/contracts', label: 'Hợp Đồng', icon: FileText },
      { path: '/meter-readings', label: 'Chỉ Số Điện Nước', icon: Zap },
      { path: '/invoices', label: 'Hóa Đơn', icon: Receipt },
      { path: '/payments', label: 'Thu Chi Tháng', icon: History },
      { path: '/reports', label: 'Báo Cáo Sổ Quỹ', icon: FileSpreadsheet },
      { path: '/pricing-settings', label: 'Bảng Giá', icon: Settings },
      { path: '/assistant', label: 'Trợ Lý AI', icon: Bot },
    ]
  }

  const getRoleLabel = () => {
    if (user?.role === 'SuperAdmin') return 'Super Admin'
    if (user?.role === 'Tenant') return 'Khách thuê'
    return 'Chủ trọ / Admin'
  }

  const getSubLabel = () => {
    if (user?.role === 'SuperAdmin') return 'Nhà cung cấp'
    if (user?.role === 'Tenant') return 'Người thuê phòng'
    return user?.organization?.name || 'Chủ phòng trọ'
  }

  const getAvatarInitials = () => {
    const name = user?.displayName || user?.username || user?.email || 'US'
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
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
          <div className="user-avatar-mini">{getAvatarInitials()}</div>
          <div className="user-info-mini">
            <h4>{user?.displayName || user?.username || 'User'}</h4>
            <span title={getSubLabel()}>{getRoleLabel()}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
