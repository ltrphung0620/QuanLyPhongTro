import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Home, 
  Zap, 
  Receipt, 
  FileText, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ArrowRight
} from 'lucide-react'
import { layBaoCaoThang, layDanhSachPhong } from '../api'
import './Dashboard.css'
import { getPreviousMonthValue } from '../utils/month'
import { sortByRoomCode } from '../utils/roomSort'

export default function Dashboard() {
  const [thang, setThang] = useState(getPreviousMonthValue)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [stats, setStats] = useState({
    doanhThu: 0,
    paidInvoicesRevenue: 0,
    extraIncome: 0,
    chiPhi: 0,
    loiNhuan: 0,
    tongPhong: 0,
    phongDaThue: 0,
    tileLapDay: 0,
    hoaDonDaThanhToan: 0,
    hoaDonChuaThanhToan: 0,
    tongSoHoaDon: 0,
    tongTienDaThu: 0,
    tongTienChuaThu: 0,
    danhSachChuaThu: []
  })
  
  const [danhSachPhong, setDanhSachPhong] = useState([])

  const taiDuLieu = async () => {
    setLoading(true)
    setError(null)
    try {
      const [baoCao, DSPhong] = await Promise.all([
        layBaoCaoThang(thang),
        layDanhSachPhong()
      ])
      
      setDanhSachPhong(sortByRoomCode(DSPhong))
      
      // Calculate room occupancy
      const tongPhong = DSPhong.length
      const phongDaThue = DSPhong.filter(p => (p.status || '').toLowerCase() === 'occupied' || p.isOccupied === true).length
      const tileLapDay = tongPhong > 0 ? Math.round((phongDaThue / tongPhong) * 100) : 0
      
      // Process payment status items
      const dsHoaDon = baoCao.trangThaiThanhToan || []
      const resolveRoomCode = (roomId) => DSPhong.find(p => p.roomId === roomId)?.roomCode || `Phòng #${roomId}`
      const tongSoHoaDon = dsHoaDon.length
      const hoaDonDaThanhToan = dsHoaDon.filter(h => (h.status || '').toLowerCase() === 'paid').length
      const hoaDonChuaThanhToan = tongSoHoaDon - hoaDonDaThanhToan
      
      const tongTienDaThu = dsHoaDon
        .filter(h => (h.status || '').toLowerCase() === 'paid')
        .reduce((sum, h) => sum + h.totalAmount, 0)
        
      const tongTienChuaThu = dsHoaDon
        .filter(h => (h.status || '').toLowerCase() !== 'paid')
        .reduce((sum, h) => sum + h.totalAmount, 0)
        
      const danhSachChuaThu = sortByRoomCode(
        dsHoaDon.filter(h => (h.status || '').toLowerCase() !== 'paid'),
        h => h.roomCode || resolveRoomCode(h.roomId)
      )

      setStats({
        doanhThu: baoCao.doanhThu?.totalRevenue || 0,
        paidInvoicesRevenue: baoCao.doanhThu?.paidInvoicesRevenue || 0,
        extraIncome: baoCao.doanhThu?.extraIncome || 0,
        chiPhi: baoCao.chiPhi?.totalExpense || 0,
        loiNhuan: baoCao.loiNhuan?.profitLoss || 0,
        tongPhong,
        phongDaThue,
        tileLapDay,
        hoaDonDaThanhToan,
        hoaDonChuaThanhToan,
        tongSoHoaDon,
        tongTienDaThu,
        tongTienChuaThu,
        danhSachChuaThu
      })
    } catch (err) {
      console.error(err)
      setError(err.message || 'Không thể tải báo cáo cho tháng này')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    taiDuLieu()
  }, [thang])

  useEffect(() => {
    const handleRealtimeEvent = (event) => {
      // Auto refresh dashboard on system updates
      taiDuLieu()
    }
    window.addEventListener('realtime-event', handleRealtimeEvent)
    return () => {
      window.removeEventListener('realtime-event', handleRealtimeEvent)
    }
  }, [thang])

  const dinhDangTien = (so) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(so)
  }

  const timTenPhong = (roomId) => {
    const phong = danhSachPhong.find(p => p.roomId === roomId)
    return phong ? phong.roomCode : `Phòng #${roomId}`
  }

  // Calculate percentage of money collected
  const totalInvoiceAmount = stats.tongTienDaThu + stats.tongTienChuaThu
  const tileThuTien = totalInvoiceAmount > 0 ? Math.round((stats.tongTienDaThu / totalInvoiceAmount) * 100) : 0

  return (
    <div className="page-body">
      <div className="dashboard-header-bar">
        <div className="header-title-section">
          <h1>Tổng Quan</h1>
          <p className="subtitle">Báo cáo hoạt động kinh doanh nhà trọ</p>
        </div>
        
        <div className="month-picker-container">
          <label htmlFor="month-select" className="month-label">Chọn kỳ báo cáo:</label>
          <input 
            type="month" 
            id="month-select" 
            className="month-input"
            value={thang} 
            onChange={(e) => setThang(e.target.value)} 
          />
        </div>
      </div>

      {error && (
        <div className="error-alert">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <span>Đang tải báo cáo phân tích...</span>
        </div>
      ) : (
        <>
          {/* Quick Actions Grid */}
          <div className="quick-actions-bar">
            <h3>Phím tắt nghiệp vụ</h3>
            <div className="actions-grid">
              <Link to="/meter-readings" className="action-button-card">
                <div className="action-icon-wrapper">
                  <Zap size={20} />
                </div>
                <div className="action-text">
                  <h4>Ghi số điện nước</h4>
                  <span>Nhập chỉ số tháng mới</span>
                </div>
                <ArrowRight size={16} className="arrow-hover" />
              </Link>

              <Link to="/invoices" className="action-button-card">
                <div className="action-icon-wrapper">
                  <Receipt size={20} />
                </div>
                <div className="action-text">
                  <h4>Xuất hóa đơn</h4>
                  <span>Tính tiền và lập hóa đơn</span>
                </div>
                <ArrowRight size={16} className="arrow-hover" />
              </Link>

              <Link to="/contracts" className="action-button-card">
                <div className="action-icon-wrapper">
                  <FileText size={20} />
                </div>
                <div className="action-text">
                  <h4>Hợp đồng mới</h4>
                  <span>Soạn thảo hợp đồng thuê</span>
                </div>
                <ArrowRight size={16} className="arrow-hover" />
              </Link>

              <Link to="/tenants" className="action-button-card">
                <div className="action-icon-wrapper">
                  <Users size={20} />
                </div>
                <div className="action-text">
                  <h4>Khách thuê</h4>
                  <span>Quản lý danh sách khách</span>
                </div>
                <ArrowRight size={16} className="arrow-hover" />
              </Link>
            </div>
          </div>

          {/* Stats Summary Cards */}
          <div className="stat-grid">
            <div className="dashboard-card stat-card">
              <div className="stat-header">
                <span className="stat-title">Doanh Thu Thực Thu</span>
                <div className="stat-icon-bg revenue">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="stat-value">{dinhDangTien(stats.doanhThu)}</div>
              <div className="stat-breakdown">
                <span>Hóa đơn: {dinhDangTien(stats.paidInvoicesRevenue)}</span>
                <span>•</span>
                <span>Phát sinh: {dinhDangTien(stats.extraIncome)}</span>
              </div>
            </div>

            <div className="dashboard-card stat-card">
              <div className="stat-header">
                <span className="stat-title">Chi Phí Phát Sinh</span>
                <div className="stat-icon-bg expense">
                  <TrendingDown size={18} />
                </div>
              </div>
              <div className="stat-value">{dinhDangTien(stats.chiPhi)}</div>
              <div className="stat-breakdown">
                <span>Chi phí quản lý & vận hành</span>
              </div>
            </div>

            <div className="dashboard-card stat-card">
              <div className="stat-header">
                <span className="stat-title">Lợi Nhuận Thuần</span>
                <div className={`stat-icon-bg profit ${stats.loiNhuan >= 0 ? 'positive' : 'negative'}`}>
                  <DollarSign size={18} />
                </div>
              </div>
              <div className="stat-value">{dinhDangTien(stats.loiNhuan)}</div>
              <div className="stat-breakdown">
                <span className={stats.loiNhuan >= 0 ? 'text-success' : 'text-danger'}>
                  {stats.loiNhuan >= 0 ? 'Dòng tiền dương' : 'Dòng tiền âm'}
                </span>
              </div>
            </div>

            <div className="dashboard-card stat-card">
              <div className="stat-header">
                <span className="stat-title">Tỉ Lệ Lấp Đầy</span>
                <div className="stat-icon-bg occupancy">
                  <Home size={18} />
                </div>
              </div>
              <div className="stat-value">{stats.tileLapDay}%</div>
              <div className="stat-breakdown">
                <span>Đã thuê {stats.phongDaThue}/{stats.tongPhong} phòng</span>
              </div>
            </div>
          </div>

          {/* Detailed Row */}
          <div className="dashboard-detail-row">
            {/* Payment Collection Progress */}
            <div className="dashboard-card collection-card">
              <h3 className="section-title">Tiến Độ Thu Tiền Hóa Đơn</h3>
              <div className="collection-progress-container">
                <div className="progress-ring-section">
                  <div className="progress-bar-linear">
                    <div className="progress-bar-fill" style={{ width: `${tileThuTien}%` }}></div>
                  </div>
                  <div className="progress-percentage-label">
                    <span>Đã thu <strong>{tileThuTien}%</strong> tổng tiền</span>
                  </div>
                </div>

                <div className="collection-breakdown-grid">
                  <div className="breakdown-item">
                    <span className="breakdown-label">Tổng tiền đã thu:</span>
                    <span className="breakdown-value text-success">{dinhDangTien(stats.tongTienDaThu)}</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">Tổng tiền chưa thu:</span>
                    <span className="breakdown-value text-warning">{dinhDangTien(stats.tongTienChuaThu)}</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">Hóa đơn đã thanh toán:</span>
                    <span className="breakdown-value">{stats.hoaDonDaThanhToan} / {stats.tongSoHoaDon}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Unpaid Invoices List */}
            <div className="dashboard-card unpaid-list-card">
              <div className="card-header-flex">
                <h3 className="section-title">Hóa Đơn Chưa Thu Tiền ({stats.danhSachChuaThu.length})</h3>
                <Link to="/invoices" className="btn-link">Tất cả hóa đơn <ArrowRight size={14} /></Link>
              </div>

              {stats.danhSachChuaThu.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle2 className="text-success" size={48} />
                  <h4>Tuyệt vời!</h4>
                  <p>Không có hóa đơn nào chưa thanh toán trong tháng này.</p>
                </div>
              ) : (
                <div className="unpaid-items-list">
                  {stats.danhSachChuaThu.slice(0, 5).map((hd) => (
                    <div className="unpaid-item" key={hd.invoiceId}>
                      <div className="unpaid-item-left">
                        <div className="room-badge">{timTenPhong(hd.roomId)}</div>
                        <div className="unpaid-item-info">
                          <h4>Mã thanh toán: {hd.paymentCode || `HD #${hd.invoiceId}`}</h4>
                          <span>Kỳ hóa đơn: {hd.billingMonth ? hd.billingMonth.substring(0, 7) : thang}</span>
                        </div>
                      </div>
                      <div className="unpaid-item-right">
                        <span className="unpaid-amount">{dinhDangTien(hd.totalAmount)}</span>
                        <span className="status-indicator-mini warning">
                          <Clock size={12} />
                          Chưa thu
                        </span>
                      </div>
                    </div>
                  ))}
                  {stats.danhSachChuaThu.length > 5 && (
                    <div className="more-items-indicator">
                      và {stats.danhSachChuaThu.length - 5} hóa đơn chưa thu tiền khác.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
