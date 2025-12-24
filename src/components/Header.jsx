import React, { useState } from 'react'
import { Upload, Search, X, User, LogOut, Sun, Moon, Monitor } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import toast from 'react-hot-toast'

const Header = ({ searchQuery, onSearch, onLiveSearch, onClearSearch, onUpload }) => {
  const { user, logout } = useAuth()
  const { theme, toggleTheme, setLightTheme, setDarkTheme, setSystemTheme, isDark } = useTheme()
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [searchInput, setSearchInput] = useState(searchQuery || '')
  const [showSearch, setShowSearch] = useState(false)

  const handleLogout = async () => {
    const result = await logout()
    if (result.success) {
      toast.success('Logged out successfully')
    } else {
      toast.error('Logout failed')
    }
  }

  const handleSearchInputChange = (e) => {
    const value = e.target.value
    setSearchInput(value)
    onLiveSearch(value)
  }

  const handleSearchClear = () => {
    setSearchInput('')
    onClearSearch()
  }

  const getThemeIcon = () => {
    if (theme === 'dark') return <Moon className="w-4 h-4" />
    if (theme === 'light') return <Sun className="w-4 h-4" />
    return <Monitor className="w-4 h-4" />
  }

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 sm:py-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        {/* Left side - Logo and title */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-shrink-0">
          <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex-shrink-0">
            <img src="/icon.png" alt="Reachable File Manager" className="w-7 h-7 sm:w-8 sm:h-8 rounded-md" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              Reachable File Manager
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              Creative Edition
            </p>
          </div>
        </div>

        {/* Center - Search (hidden on mobile, shown when toggle is clicked) */}
        <div className={`${showSearch ? 'flex' : 'hidden'} sm:flex flex-1 max-w-md mx-0 sm:mx-8 w-full sm:w-auto order-3 sm:order-2`}>
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchInputChange}
              placeholder="Search files and folders..."
              className="block w-full pl-9 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-sm transition-colors duration-200"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              </button>
            )}
          </div>
        </div>

        {/* Right side - Actions and user menu */}
        <div className="flex items-center space-x-2 sm:space-x-4 order-2 sm:order-3 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end">
          {/* Search toggle for mobile */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="sm:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200 focus-ring"
            title="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Upload button */}
          <button
            onClick={onUpload}
            className="inline-flex items-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
          >
            <Upload className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Upload</span>
          </button>

          {/* Theme switcher */}
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200 focus-ring"
              title="Switch theme"
            >
              {getThemeIcon()}
            </button>

            {showThemeMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                <button
                  onClick={() => {
                    setLightTheme()
                    setShowThemeMenu(false)
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <Sun className="w-4 h-4 mr-3" />
                  Light
                  {theme === 'light' && <div className="ml-auto w-2 h-2 bg-primary-600 rounded-full"></div>}
                </button>
                <button
                  onClick={() => {
                    setDarkTheme()
                    setShowThemeMenu(false)
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <Moon className="w-4 h-4 mr-3" />
                  Dark
                  {theme === 'dark' && <div className="ml-auto w-2 h-2 bg-primary-600 rounded-full"></div>}
                </button>
                <button
                  onClick={() => {
                    setSystemTheme()
                    setShowThemeMenu(false)
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <Monitor className="w-4 h-4 mr-3" />
                  System
                  {!localStorage.getItem('theme') && <div className="ml-auto w-2 h-2 bg-primary-600 rounded-full"></div>}
                </button>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="flex items-center space-x-2 sm:space-x-3 pl-2 sm:pl-4 border-l border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <div className="flex items-center justify-center w-6 h-6 bg-primary-100 dark:bg-primary-900 rounded-full">
                <User className="w-3 h-3 text-primary-600 dark:text-primary-400" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">
                {user?.username}
              </span>
            </div>
            
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200 focus-ring"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Click outside to close theme menu */}
      {showThemeMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowThemeMenu(false)}
        ></div>
      )}
    </header>
  )
}

export default Header
