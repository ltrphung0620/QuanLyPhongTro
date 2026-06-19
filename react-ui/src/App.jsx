import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
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
import { Zap } from 'lucide-react'
import './App.css'
import { useNotification } from './context/NotificationContext'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { toast: notify } = useNotification()

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const url = `/api/Realtime/stream?access_token=${encodeURIComponent(token)}`
    let eventSource

    try {
      eventSource = new EventSource(url)

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          console.log('Realtime event:', payload)

          // Dispatch event globally
          window.dispatchEvent(new CustomEvent('realtime-event', { detail: payload }))

          // Show Toast notifications based on event names
          if (payload.eventName === 'payment.webhook-received') {
            notify.info('Phát hiện giao dịch chuyển khoản mới qua SePay! Đang đối soát tự động...')
          } else if (payload.eventName === 'payment.reconciled') {
            notify.success('Đã đối soát thành công giao dịch ngân hàng với hóa đơn phòng!')
          } else if (payload.eventName === 'invoice.created') {
            notify.success('Hóa đơn phòng mới vừa được tạo lập thành công.')
          } else if (payload.eventName === 'transaction.created') {
            notify.info('Sổ chi tiêu ghi nhận thêm giao dịch phát sinh mới.')
          }
        } catch (e) {
          console.error('Error parsing SSE event:', e)
        }
      }

      eventSource.onerror = (err) => {
        console.error('SSE Connection error, reconnecting...', err)
        // Keep retrying in background
      }
    } catch (err) {
      console.error('Failed to init EventSource:', err)
    }

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [])

  return (
    <div className="app-container">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="drawer-overlay" style={{ zIndex: 95 }} onClick={closeSidebar}></div>
      )}

      <Sidebar isOpen={sidebarOpen} />

      <div className="main-content">
        <Header toggleSidebar={toggleSidebar} />
        
        {/* Main page content area */}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/meter-readings" element={<MeterReadings />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  )
}
