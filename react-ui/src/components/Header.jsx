import React from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Calendar, Menu, User } from 'lucide-react'
import './Header.css'

export default function Header({ toggleSidebar }) {
  const location = useLocation()

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
        return 'Lịch Sử Giao Dịch'
      default:
        return 'Hệ Thống Quản Lý'
    }
  }

  const getTodayDateString = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    return new Date().toLocaleDateString('vi-VN', options)
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
      </div>

      <div className="header-right">
        <button className="header-action-btn">
          <Bell size={18} />
          <span className="badge-dot"></span>
        </button>
        
        <div className="header-profile">
          <div className="profile-avatar">
            <User size={18} />
          </div>
          <div className="profile-info">
            <h4>Quản trị viên</h4>
            <span>Chủ nhà trọ</span>
          </div>
        </div>
      </div>
    </header>
  )
}
