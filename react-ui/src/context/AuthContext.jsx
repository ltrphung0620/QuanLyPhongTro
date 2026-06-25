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
      
      if (u && u.role === 'Admin') {
        const storedActiveOrgId = localStorage.getItem('activeOrganizationId')
        
        if (u.organizations && u.organizations.length > 0) {
          if (u.organizations.length === 1) {
            const singleOrgId = u.organizations[0].id
            localStorage.setItem('activeOrganizationId', singleOrgId)
            u.activeOrganization = u.organizations[0]
            u.pagePermissions = u.organizations[0].pagePermissions
            u.hasFullAccess = u.organizations[0].hasFullAccess
          } else if (storedActiveOrgId) {
            const activeId = Number(storedActiveOrgId)
            const matchedOrg = u.organizations.find(org => org.id === activeId)
            if (matchedOrg) {
              u.activeOrganization = matchedOrg
              u.pagePermissions = matchedOrg.pagePermissions
              u.hasFullAccess = matchedOrg.hasFullAccess
            } else {
              localStorage.removeItem('activeOrganizationId')
              u.activeOrganization = null
              u.pagePermissions = []
              u.hasFullAccess = false
            }
          } else {
            u.activeOrganization = null
            u.pagePermissions = []
            u.hasFullAccess = false
          }
        } else {
          localStorage.removeItem('activeOrganizationId')
          u.activeOrganization = null
          u.pagePermissions = []
          u.hasFullAccess = false
        }
      }
      
      setUser(u)
      return u
    } catch (err) {
      console.error('Failed to load user info:', err)
      localStorage.removeItem('token')
      localStorage.removeItem('activeOrganizationId')
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
    localStorage.removeItem('activeOrganizationId')
    setUser(null)
    setLoading(false)
    window.location.href = '/login'
  }, [])

  const changeActiveOrg = useCallback(async (orgId) => {
    localStorage.setItem('activeOrganizationId', orgId)
    setLoading(true)
    const u = await fetchUser()
    if (u && u.activeOrganization) {
      window.location.reload()
    } else {
      setLoading(false)
    }
  }, [fetchUser])

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logoutUser, refreshUser: fetchUser, changeActiveOrg }}>
      {children}
    </AuthContext.Provider>
  )
}
