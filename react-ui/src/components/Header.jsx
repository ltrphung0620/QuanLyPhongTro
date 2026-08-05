import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate, NavLink } from 'react-router-dom'
import { Bell, Calendar, Menu, User, Sun, Moon, Key, LogOut } from 'lucide-react'
import './Header.css'
import { useAuth } from '../context/AuthContext'
import { layHoaDonTenant } from '../api'

export default function Header({ toggleSidebar, theme, toggleTheme }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logoutUser, changeActiveOrg } = useAuth()

  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const profileMenuRef = useRef(null)

  const [showOrgDropdown, setShowOrgDropdown] = useState(false)
  const orgDropdownRef = useRef(null)

  const formatMonth = (monthStr) => {
    if (!monthStr) return 'N/A'
    const parts = monthStr.split('-')
    if (parts.length >= 2) {
      return `${parts[1]}/${parts[0]}`
    }
    return monthStr
  }

  const formatVnd = (amount) => {
    if (amount === undefined || amount === null) return '0'
    return amount.toLocaleString('vi-VN')
  }

  const fetchNotifications = async () => {
    if (!user) return
    if (user.role === 'Tenant') {
      try {
        const invoicesList = await layHoaDonTenant()
        const unpaidInvoices = invoicesList.filter(inv => inv.status === 'unpaid')
        
        const readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]')
        
        const mapped = unpaidInvoices.map(inv => {
          const id = `invoice-${inv.invoiceId}`
          return {
            id,
            invoiceId: inv.invoiceId,
            billingMonth: inv.billingMonth,
            totalAmount: inv.totalAmount,
            message: `Đã có hóa đơn tháng ${formatMonth(inv.billingMonth)} cần thanh toán với số tiền ${formatVnd(inv.totalAmount)} đồng`,
            isRead: readIds.includes(id)
          }
        })
        
        setNotifications(mapped)
        setUnreadCount(mapped.filter(n => !n.isRead).length)
      } catch (err) {
        console.error('Failed to fetch notifications for tenant:', err)
      }
    } else {
      // Admin / SuperAdmin
      try {
        const key = `admin_notifications_${user.username || 'admin'}`
        const stored = JSON.parse(localStorage.getItem(key) || '[]')
        setNotifications(stored)
        setUnreadCount(stored.filter(n => !n.isRead).length)
      } catch (err) {
        console.error('Failed to fetch admin notifications:', err)
      }
    }
  }

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user])

  useEffect(() => {
    const handleRealtimeEvent = (event) => {
      const payload = event.detail
      if (!user) return

      if (user.role === 'Tenant') {
        if (payload?.eventName === 'tenant.invoice.created' || payload?.eventName === 'invoice.created') {
          fetchNotifications()
        }
      } else {
        // Admin or other roles
        if (payload?.eventName === 'invoice.marked-paid') {
          const payloadOrgId = payload.data?.organizationId
          const userOrgId = user.organizationId || user.OrganizationId
          if (payloadOrgId && userOrgId && payloadOrgId !== userOrgId) {
            return // Skip events from other organizations
          }

          const newNoti = {
            id: `paid-${payload.data?.invoiceId || Date.now()}-${Math.random()}`,
            invoiceId: payload.data?.invoiceId,
            message: payload.data?.message || 'Một hóa đơn đã được thanh toán thành công.',
            isRead: false,
            createdAt: new Date().toISOString()
          }

          const key = `admin_notifications_${user.username || 'admin'}`
          const stored = JSON.parse(localStorage.getItem(key) || '[]')

          if (!stored.some(n => n.invoiceId === newNoti.invoiceId && n.message === newNoti.message)) {
            const updated = [newNoti, ...stored].slice(0, 50)
            localStorage.setItem(key, JSON.stringify(updated))
            setNotifications(updated)
            setUnreadCount(updated.filter(n => !n.isRead).length)
          }
        }
      }
    }

    window.addEventListener('realtime-event', handleRealtimeEvent)
    return () => window.removeEventListener('realtime-event', handleRealtimeEvent)
  }, [user])

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target)) {
        setShowOrgDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleNotificationClick = (n) => {
    if (user?.role === 'Tenant') {
      if (!n.isRead) {
        const readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]')
        if (!readIds.includes(n.id)) {
          readIds.push(n.id)
          localStorage.setItem('read_notifications', JSON.stringify(readIds))
        }
        fetchNotifications()
      }
      setShowDropdown(false)
      navigate('/invoices')
    } else {
      // Admin notification click
      const key = `admin_notifications_${user?.username || 'admin'}`
      const stored = JSON.parse(localStorage.getItem(key) || '[]')
      const updated = stored.map(item => {
        if (item.id === n.id) {
          return { ...item, isRead: true }
        }
        return item
      })
      localStorage.setItem(key, JSON.stringify(updated))
      fetchNotifications()
      setShowDropdown(false)
      navigate('/invoices')
    }
  }

  const handleMarkAllAsRead = () => {
    if (user?.role === 'Tenant') {
      const readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]')
      notifications.forEach(n => {
        if (!readIds.includes(n.id)) {
          readIds.push(n.id)
        }
      })
      localStorage.setItem('read_notifications', JSON.stringify(readIds))
      fetchNotifications()
    } else {
      const key = `admin_notifications_${user?.username || 'admin'}`
      const stored = JSON.parse(localStorage.getItem(key) || '[]')
      const updated = stored.map(item => ({ ...item, isRead: true }))
      localStorage.setItem(key, JSON.stringify(updated))
      fetchNotifications()
    }
  }

  // Map path to title
  const getPageTitle = (path) => {
    switch (path) {
      case '/':
        return 'Tổng Quan Báo Cáo'
      case '/rooms':
        return 'Quản Lý Phòng Trọ'
      case '/tenants':
        return 'Danh Sách Khách Thuê'
      case '/contracts':
        return 'Hợp Đồng Thuê Nhà'
      case '/meter-readings':
        return 'Chỉ Số Điện Nước'
      case '/invoices':
        return 'Hóa Đơn Hàng Tháng'
      case '/payments':
        return 'Thu Chi Tháng'
      case '/reports':
        return 'Báo Cáo Sổ Quỹ'
      case '/assistant':
        return 'Trợ Lý AI'
      case '/organizations':
        return 'Quản Lý Tổ Chức'
      case '/admins':
        return 'Quản Lý Tài Khoản Admin'
      case '/support':
        return 'Trung Tâm Hỗ Trợ'
      case '/change-password':
        return 'Đổi Mật Khẩu'
      default:
        return 'Hệ Thống Quản Lý'
    }
  }

  const getTodayDateString = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    return new Date().toLocaleDateString('vi-VN', options)
  }

  const getRoleLabel = () => {
    if (user?.role === 'SuperAdmin') return 'Super Admin'
    if (user?.role === 'Tenant') return 'Khách thuê'
    return 'Chủ trọ / Admin'
  }

  const renderOrgSwitcher = () => {
    if (user?.role !== 'Admin') return null
    const orgs = user.organizations || []
    const activeOrg = user.activeOrganization

    if (orgs.length > 1) {
      return (
        <div className="header-org-switcher" ref={orgDropdownRef}>
          <button 
            className="org-switcher-btn"
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            title="Đổi tổ chức làm việc"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="org-icon">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <span className="org-name-text">{activeOrg?.name || 'Chọn tổ chức'}</span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="chevron">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showOrgDropdown && (
            <div className="org-switcher-dropdown">
              <div className="dropdown-header-title">Chọn tổ chức làm việc</div>
              <div className="org-list-scroll">
                {orgs.map((org) => {
                  const isActive = org.id === activeOrg?.id
                  return (
                    <button
                      key={org.id}
                      className={`org-dropdown-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        if (!isActive) {
                          changeActiveOrg(org.id)
                        }
                        setShowOrgDropdown(false)
                      }}
                    >
                      <span className="dot"></span>
                      <div className="org-item-info">
                        <span className="org-item-name">{org.name}</span>
                        <span className="org-item-code">Mã: {org.code || `ORG${org.id}`}</span>
                      </div>
                      {isActive && (
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="check-icon">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )
    } else if (activeOrg) {
      return (
        <div className="header-org-badge">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="badge-icon">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span>{activeOrg.name}</span>
        </div>
      )
    }
    return null
  }

  return (
    <header className="header">
      <div className="header-left">
        <button className="mobile-toggle" onClick={toggleSidebar}>
          <Menu size={20} />
        </button>
        <div className="header-title-group">
          <h1>{getPageTitle(location.pathname)}</h1>
          <div className="header-date">
            <Calendar size={14} className="date-icon" />
            <span>{getTodayDateString()}</span>
          </div>
        </div>
        {renderOrgSwitcher()}
      </div>

      <div className="header-right">
        <button className="header-action-btn" onClick={toggleTheme} aria-label="Chuyển chế độ sáng/tối">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="notification-container" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button 
            className="header-action-btn" 
            onClick={() => setShowDropdown(!showDropdown)}
            aria-label="Thông báo"
            style={{ position: 'relative' }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="notification-badge" style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                minWidth: '18px',
                height: '18px',
                padding: '0 4px',
                borderRadius: '9px',
                backgroundColor: 'var(--danger, #ef4444)',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid var(--bg-secondary, #ffffff)',
                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
                lineHeight: 1,
                zIndex: 10
              }}>{unreadCount}</span>
            )}
          </button>
          
          {showDropdown && (
            <div className="notification-dropdown" style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              right: 0,
              width: '320px',
              backgroundColor: 'var(--bg-secondary, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
              zIndex: 999,
              overflow: 'hidden',
              display: 'block',
              textAlign: 'left'
            }}>
              <div className="notification-dropdown-header" style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <h3 style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: 'var(--text-primary, #1e293b)',
                  margin: 0,
                }}>Thông báo</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllAsRead} 
                    className="mark-all-read-btn"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-color, #3b82f6)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Đọc tất cả
                  </button>
                )}
              </div>
              <div className="notification-dropdown-body" style={{
                maxHeight: '360px',
                overflowY: 'auto',
              }}>
                {notifications.length === 0 ? (
                  <div className="no-notifications" style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: 'var(--text-muted, #94a3b8)',
                    fontSize: '0.85rem'
                  }}>Không có thông báo mới</div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={`notification-item ${n.isRead ? 'read' : 'unread'}`}
                      onClick={() => handleNotificationClick(n)}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-color, #e2e8f0)',
                        cursor: 'pointer',
                        position: 'relative',
                        backgroundColor: n.isRead ? 'transparent' : 'rgba(59, 130, 246, 0.03)',
                      }}
                    >
                      <div className="notification-item-icon" style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: n.isRead ? 'var(--accent-light, rgba(59, 130, 246, 0.1))' : 'rgba(239, 68, 68, 0.1)',
                        color: n.isRead ? 'var(--primary-color, #3b82f6)' : 'var(--danger, #ef4444)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Bell size={16} />
                      </div>
                      <div className="notification-item-content" style={{ flex: 1 }}>
                        <p className="notification-message" style={{
                          fontSize: '0.85rem',
                          lineHeight: 1.4,
                          color: 'var(--text-primary, #1e293b)',
                          margin: '0 0 4px 0',
                          fontWeight: n.isRead ? 500 : 600,
                          textAlign: 'left'
                        }}>{n.message}</p>
                        <span className="notification-time" style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-muted, #94a3b8)',
                          display: 'block',
                          textAlign: 'left'
                        }}>{user?.role === 'Tenant' ? 'Hóa đơn chưa thanh toán' : 'Thanh toán thành công'}</span>
                      </div>
                      {!n.isRead && (
                        <span className="unread-dot" style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--danger, #ef4444)',
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                        }}></span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="header-divider"></div>

        <div 
          className={`header-profile ${showProfileMenu ? 'active' : ''}`}
          ref={profileMenuRef}
          onClick={() => setShowProfileMenu(!showProfileMenu)}
        >
          <div className="profile-avatar" style={{
            background: 'var(--primary-color, #3b82f6)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: '0.85rem'
          }}>
            {user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : <User size={18} />}
          </div>
          <div className="profile-info">
            <h4>{user?.displayName || user?.username || 'User'}</h4>
            <span>{getRoleLabel()}</span>
          </div>

          {showProfileMenu && (
            <div className="profile-dropdown" onClick={(e) => e.stopPropagation()}>
              <NavLink 
                to="/change-password" 
                className="profile-dropdown-item"
                onClick={() => setShowProfileMenu(false)}
              >
                <Key size={15} className="dropdown-icon" />
                <span>Đổi mật khẩu</span>
              </NavLink>
              <button 
                className="profile-dropdown-item btn-logout-item" 
                onClick={() => {
                  setShowProfileMenu(false)
                  logoutUser()
                }}
              >
                <LogOut size={15} className="dropdown-icon" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
