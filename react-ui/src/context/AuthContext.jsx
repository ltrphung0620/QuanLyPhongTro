import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { layMe } from '../api'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setUser(null)
      setLoading(false)
      return null
    }

    try {
      const u = await layMe()
      setUser(u)
      return u
    } catch (err) {
      console.error('Failed to load user info:', err)
      localStorage.removeItem('token')
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const loginUser = useCallback(async (token) => {
    localStorage.setItem('token', token)
    setLoading(true)
    return await fetchUser()
  }, [fetchUser])

  const logoutUser = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
    setLoading(false)
    window.location.href = '/login'
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logoutUser, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}
