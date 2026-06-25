import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import * as signalR from '@microsoft/signalr'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import Rooms from './pages/Rooms'
import Tenants from './pages/Tenants'
import Contracts from './pages/Contracts'
import MeterReadings from './pages/MeterReadings'
import Invoices from './pages/Invoices'
import Payments from './pages/Payments'
import Reports from './pages/Reports'
import Assistant from './pages/Assistant'
import PricingSettings from './pages/PricingSettings'
import ChangePassword from './pages/ChangePassword'
import Organizations from './pages/Organizations'
import Admins from './pages/Admins'
import TenantInvoices from './pages/TenantInvoices'
import TenantMeterReadings from './pages/TenantMeterReadings'
import { useAuth } from './context/AuthContext'
import { canAccessAdminPage, getAdminHomePath } from './adminPermissions'
import OrganizationSelector from './components/OrganizationSelector'
import './App.css'
import { useNotification } from './context/NotificationContext'

function AdminPageRoute({ permission, children }) {
  const { user } = useAuth()
  return canAccessAdminPage(user, permission)
    ? children
    : <Navigate to={getAdminHomePath(user)} replace />
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { toast: notify } = useNotification()
  const { user, changeActiveOrg, logoutUser } = useAuth()
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
    const hubBase = apiBase.replace(/\/api$/, '')
    const hubUrl = `${hubBase}/hubs/realtime`
    let connection

    try {
      connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => localStorage.getItem('token') || ''
        })
        .withAutomaticReconnect()
        .build()

      connection.on('RealtimeEvent', (payload) => {
        try {
          console.log('SignalR realtime event:', payload)

          // Dispatch event globally
          window.dispatchEvent(new CustomEvent('realtime-event', { detail: payload }))

          if (payload.eventName === 'tenant.invoice.created') {
            notify.success(payload.data?.message || 'Ban co hoa don moi can thanh toan.')
            return
          }

          // Show Toast notifications based on event names
          if (payload.eventName === 'invoice.marked-paid') {
            if (user?.role !== 'Tenant') {
              const payloadOrgId = payload.data?.organizationId
              const userOrgId = user?.organizationId || user?.OrganizationId
              if (!payloadOrgId || !userOrgId || payloadOrgId === userOrgId) {
                notify.success(payload.data?.message || 'Một hóa đơn đã được thanh toán thành công!')
              }
            }
          } else if (payload.eventName === 'payment.webhook-received') {
            notify.info('Phát hiện giao dịch chuyển khoản mới qua SePay! Đang đối soát tự động...')
          } else if (payload.eventName === 'payment.reconciled') {
            notify.success('Đã đối soát thành công giao dịch ngân hàng với hóa đơn phòng!')
          } else if (payload.eventName === 'invoice.created') {
            notify.success('Hóa đơn phòng mới vừa được tạo lập thành công.')
          } else if (payload.eventName === 'transaction.created') {
            notify.info('Sổ chi tiêu ghi nhận thêm giao dịch phát sinh mới.')
          }
        } catch (e) {
          console.error('Error handling SignalR event:', e)
        }
      })

      connection
        .start()
        .catch((err) => console.error('SignalR connection error:', err))
    } catch (err) {
      console.error('Failed to init SignalR:', err)
    }

    return () => {
      if (connection) {
        connection.stop()
      }
    }
  }, [user?.role])

  if (user?.role === 'Admin' && !user?.activeOrganization) {
    return (
      <OrganizationSelector 
        organizations={user.organizations || []}
        onSelect={changeActiveOrg}
        onLogout={logoutUser}
      />
    )
  }

  return (
    <div className="app-container">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="drawer-overlay" style={{ zIndex: 95 }} onClick={closeSidebar}></div>
      )}

      <Sidebar isOpen={sidebarOpen} />

      <div className="main-content">
        <Header toggleSidebar={toggleSidebar} theme={theme} toggleTheme={toggleTheme} />
        
        {/* Main page content area partitioned by user role */}
        {user?.role === 'SuperAdmin' ? (
          <Routes>
            <Route path="/organizations" element={<Organizations />} />
            <Route path="/admins" element={<Admins />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="*" element={<Navigate to="/organizations" replace />} />
          </Routes>
        ) : user?.role === 'Tenant' ? (
          <Routes>
            <Route path="/invoices" element={<TenantInvoices />} />
            <Route path="/meter-readings" element={<TenantMeterReadings />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="*" element={<Navigate to="/invoices" replace />} />
          </Routes>
        ) : (
          /* Default Admin */
          <Routes>
            <Route path="/" element={<AdminPageRoute permission="dashboard"><Dashboard /></AdminPageRoute>} />
            <Route path="/rooms" element={<AdminPageRoute permission="rooms"><Rooms /></AdminPageRoute>} />
            <Route path="/tenants" element={<AdminPageRoute permission="tenants"><Tenants /></AdminPageRoute>} />
            <Route path="/contracts" element={<AdminPageRoute permission="contracts"><Contracts /></AdminPageRoute>} />
            <Route path="/meter-readings" element={<AdminPageRoute permission="meter-readings"><MeterReadings /></AdminPageRoute>} />
            <Route path="/invoices" element={<AdminPageRoute permission="invoices"><Invoices /></AdminPageRoute>} />
            <Route path="/payments" element={<AdminPageRoute permission="payments"><Payments /></AdminPageRoute>} />
            <Route path="/reports" element={<AdminPageRoute permission="reports"><Reports /></AdminPageRoute>} />
            <Route path="/pricing-settings" element={<AdminPageRoute permission="pricing-settings"><PricingSettings /></AdminPageRoute>} />
            <Route path="/assistant" element={<AdminPageRoute permission="assistant"><Assistant /></AdminPageRoute>} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="*" element={<Navigate to={getAdminHomePath(user)} replace />} />
          </Routes>
        )}
      </div>
    </div>
  )
}
