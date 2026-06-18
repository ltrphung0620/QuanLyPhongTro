import { useState } from 'react'
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
import AssistantWidget from './components/AssistantWidget'
import './App.css'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
  }

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
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <AssistantWidget />
    </div>
  )
}
