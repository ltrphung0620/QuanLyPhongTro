import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Login from './pages/Login.jsx'
import { useEffect } from 'react'
import { NotificationProvider } from './context/NotificationContext.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'

// Token verification check middleware utilizing global Auth state
const PrivateRoute = ({ children }) => {
  const { user, loading, logoutUser } = useAuth()
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) return

    const interval = setInterval(() => {
      const currentToken = localStorage.getItem('token')
      if (!currentToken) {
        logoutUser()
      }
    }, 30_000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [token, logoutUser])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-primary, #f8fafc)',
        color: 'var(--text-primary, #0f172a)',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border-color, #e2e8f0)',
          borderTopColor: 'var(--primary-color, #3b82f6)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }}></div>
        <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Đang tải thông tin...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  // Force first-time password change if flag is set, unless already on change-password page
  if (user.mustChangePassword && window.location.pathname !== '/change-password') {
    return <Navigate to="/change-password" />
  }

  return children
}

// Prevent mouse wheel from changing values in input[type=number]
document.addEventListener('wheel', function (e) {
  if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'number') {
    document.activeElement.blur()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NotificationProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route path="/*" element={
              <PrivateRoute>
                <App />
              </PrivateRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </NotificationProvider>
  </StrictMode>,
)
