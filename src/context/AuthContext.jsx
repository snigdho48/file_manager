import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Configure axios defaults
  axios.defaults.withCredentials = true
  
  // API base URL: runtime config.js > VITE_API_URL > localhost (dev) / same-origin (prod)
  // Prefer empty API_URL in production so nginx /api proxy keeps cookies same-site.
  const getApiBaseURL = () => {
    if (typeof window !== 'undefined' && window.APP_CONFIG?.API_URL) {
      const apiUrl = window.APP_CONFIG.API_URL.trim()
      if (apiUrl) {
        return apiUrl
      }
    }
    
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL.trim()
    }
    
    return import.meta.env.DEV ? 'http://localhost:3000' : ''
  }
  
  const apiBaseURL = getApiBaseURL()
  axios.defaults.baseURL = apiBaseURL
  
  // Ensure credentials are sent with all requests (required for cross-domain cookies)
  axios.interceptors.request.use((config) => {
    config.withCredentials = true
    return config
  })

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get('/api/auth-status')
      if (response.data.authenticated) {
        setIsAuthenticated(true)
        setUser({ username: response.data.username })
      } else {
        setIsAuthenticated(false)
        setUser(null)
      }
    } catch (error) {
      setIsAuthenticated(false)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (username, password) => {
    try {
      const response = await axios.post('/api/login', {
        username,
        password
      })
      
      if (response.data.success) {
        setIsAuthenticated(true)
        setUser({ username })
        return { success: true }
      } else {
        return { success: false, error: response.data.error }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed'
      return { success: false, error: errorMessage }
    }
  }

  const logout = async () => {
    try {
      await axios.post('/api/logout')
      setIsAuthenticated(false)
      setUser(null)
      return { success: true }
    } catch (error) {
      console.error('Logout error:', error)
      // Force logout even if request fails
      setIsAuthenticated(false)
      setUser(null)
      return { success: false, error: 'Logout failed' }
    }
  }

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const value = {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout,
    checkAuthStatus
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
