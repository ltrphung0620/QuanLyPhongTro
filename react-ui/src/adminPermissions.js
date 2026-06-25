import {
  Bot,
  FileSpreadsheet,
  FileText,
  History,
  Home,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  Zap
} from 'lucide-react'

export const ADMIN_PAGE_PERMISSIONS = [
  { key: 'dashboard', path: '/', label: 'Tổng Quan', icon: LayoutDashboard },
  { key: 'rooms', path: '/rooms', label: 'Quản Lý Phòng', icon: Home },
  { key: 'tenants', path: '/tenants', label: 'Khách Thuê', icon: Users },
  { key: 'contracts', path: '/contracts', label: 'Hợp Đồng', icon: FileText },
  { key: 'meter-readings', path: '/meter-readings', label: 'Chỉ Số Điện Nước', icon: Zap },
  { key: 'invoices', path: '/invoices', label: 'Hóa Đơn', icon: Receipt },
  { key: 'payments', path: '/payments', label: 'Thu Chi Tháng', icon: History },
  { key: 'reports', path: '/reports', label: 'Báo Cáo Sổ Quỹ', icon: FileSpreadsheet },
  { key: 'pricing-settings', path: '/pricing-settings', label: 'Bảng Giá', icon: Settings },
  { key: 'assistant', path: '/assistant', label: 'Trợ Lý AI', icon: Bot }
]

export const ADMIN_PAGE_PERMISSION_KEYS = ADMIN_PAGE_PERMISSIONS.map(item => item.key)

export function adminHasFullAccess(user) {
  if (!user || user.role !== 'Admin') return false
  return user.hasFullAccess === true || user.pagePermissions == null
}

export function getAdminAllowedPermissions(user) {
  if (!user || user.role !== 'Admin') return []
  if (adminHasFullAccess(user)) return ADMIN_PAGE_PERMISSION_KEYS
  return Array.isArray(user.pagePermissions)
    ? user.pagePermissions.filter(key => ADMIN_PAGE_PERMISSION_KEYS.includes(key))
    : []
}

export function canAccessAdminPage(user, permissionKey) {
  if (!user || user.role !== 'Admin') return false
  if (adminHasFullAccess(user)) return true
  return getAdminAllowedPermissions(user).includes(permissionKey)
}

export function getVisibleAdminMenuItems(user) {
  if (!user || user.role !== 'Admin') return ADMIN_PAGE_PERMISSIONS
  if (adminHasFullAccess(user)) return ADMIN_PAGE_PERMISSIONS
  const allowed = new Set(getAdminAllowedPermissions(user))
  return ADMIN_PAGE_PERMISSIONS.filter(item => allowed.has(item.key))
}

export function getAdminHomePath(user) {
  const visibleItems = getVisibleAdminMenuItems(user)
  return visibleItems[0]?.path || '/change-password'
}
