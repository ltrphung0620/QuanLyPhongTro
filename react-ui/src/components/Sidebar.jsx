import { NavLink } from 'react-router-dom'
import { Home, Receipt, Users, Zap } from 'lucide-react'
import './Sidebar.css'
import { useAuth } from '../context/AuthContext'
import { getVisibleAdminMenuItems } from '../adminPermissions'

export default function Sidebar({ isOpen }) {
  const { user } = useAuth()

  const menuItems = (() => {
    if (user?.role === 'SuperAdmin') {
      return [
      { path: '/organizations', label: 'Quản lý Tổ chức', icon: Home },
      { path: '/admins', label: 'Tài khoản Admin', icon: Users },
    ]
    }

    if (user?.role === 'Tenant') {
      return [
      { path: '/invoices', label: 'Hóa đơn của tôi', icon: Receipt },
      { path: '/meter-readings', label: 'Chỉ số điện nước', icon: Zap },
    ]
    }

    return getVisibleAdminMenuItems(user)
  })()

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
