import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import { useEffect } from 'react'
import { NotificationProvider } from './context/NotificationContext.jsx'

// Decode JWT payload without external library
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

// Check if token is expired based on `exp` claim
function isTokenExpired(token) {
  const payload = decodeJwtPayload(token)
  if (!payload || !payload.exp) return true
  // exp is in seconds, Date.now() is in milliseconds
  return Date.now() >= payload.exp * 1000
}

function handleLogout() {
  localStorage.removeItem('token')
  window.location.href = '/login'
}

// Token verification check middleware
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token')
  const isValid = token && token !== 'undefined' && token !== 'null' && !isTokenExpired(token)

  // Auto-logout timer: check every 30 seconds if token is still valid
  useEffect(() => {
    if (!isValid) return

    const interval = setInterval(() => {
      const currentToken = localStorage.getItem('token')
      if (!currentToken || isTokenExpired(currentToken)) {
        handleLogout()
      }
    }, 30_000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [isValid])

  return isValid ? children : <Navigate to="/login" />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NotificationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={
            <PrivateRoute>
              <App />
            </PrivateRoute>
          } />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  </StrictMode>,
)
