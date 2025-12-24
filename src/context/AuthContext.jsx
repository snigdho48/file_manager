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
  
  // API base URL configuration
  // Priority: window.APP_CONFIG.API_URL > VITE_API_URL env var > default
  // For separate deployment: Set window.APP_CONFIG.API_URL in public/config.js
  // Production: Uses https://api.creative.reachableads.com (from config.js)
  const getApiBaseURL = () => {
    // 1. Check for runtime config (from dist/config.js - can be changed after build)
    if (typeof window !== 'undefined' && window.APP_CONFIG?.API_URL) {
      const apiUrl = window.APP_CONFIG.API_URL.trim()
      if (apiUrl) {
        return apiUrl
      }
    }
    
    // 2. Check for build-time environment variable (embedded in code during build)
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL.trim()
    }
    
    // 3. Default behavior
    // Development: Use localhost (Vite proxy will handle /api/*)
    // Production: Empty string = relative URLs (same origin)
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
