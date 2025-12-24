import React, { useState, useRef, useEffect } from 'react'
import { Home, ChevronRight, FolderPlus, RefreshCw, Grid3X3, List, X, Copy, Scissors, Clipboard, Archive, Trash2, PackageOpen, Link, Menu } from 'lucide-react'

const NavigationBar = ({ currentPath, onNavigate, onCreateFolder, onRefresh, viewMode, onViewModeChange, selectedFiles, onCopy, onCut, onPaste, onCompress, onDelete, onSelectAll, clipboard, onUnzip, files }) => {
  const pathParts = currentPath ? currentPath.split('/').filter(part => part) : []
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [showMobileMenu, setShowMobileMenu] = useState(true)
  const inputRef = useRef(null)

  const handleCreateFolder = () => {
    setShowNewFolderDialog(true)
  }

  const handleSubmitFolder = () => {
    if (folderName.trim()) {
      onCreateFolder(folderName.trim())
      setFolderName('')
      setShowNewFolderDialog(false)
    }
  }

  const handleCancelFolder = () => {
    setFolderName('')
    setShowNewFolderDialog(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmitFolder()
    } else if (e.key === 'Escape') {
      handleCancelFolder()
    }
  }

  useEffect(() => {
    if (showNewFolderDialog && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showNewFolderDialog])

  const handleCopyPath = async () => {
    try {
      // Use the actual server domain from window.location
      // This will automatically work with nginx proxy and different domains
      const serverOrigin = window.location.origin
      const pathSegment = currentPath ? `/${currentPath}` : ''
      const fullPath = `${serverOrigin}${pathSegment}`
      
      await navigator.clipboard.writeText(fullPath)
      
      // Optional: Show a brief success message
      // You can uncomment this if you have a toast notification system
      // toast.success('Path copied to clipboard!')
      
    } catch (error) {
      console.error('Failed to copy path:', error)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = `${window.location.origin}${currentPath ? `/${currentPath}` : ''}`
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
  }

  const renderBreadcrumbs = () => {
    const breadcrumbs = []

    // Home button
    breadcrumbs.push(
      <button
        key="home"
        onClick={() => onNavigate('')}
        className="flex items-center px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-200 focus-ring"
      >
        <Home className="w-4 h-4 mr-2" />
        Home
      </button>
    )

    // Path parts
    let currentBreadcrumbPath = ''
    pathParts.forEach((part, index) => {
      currentBreadcrumbPath += (index > 0 ? '/' : '') + part
      const isLast = index === pathParts.length - 1

      breadcrumbs.push(
        <ChevronRight key={`separator-${index}`} className="w-4 h-4 text-gray-400 mx-1" />
      )

      breadcrumbs.push(
        <button
          key={`part-${index}`}
          onClick={() => onNavigate(currentBreadcrumbPath)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors duration-200 focus-ring ${
            isLast
              ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {part}
        </button>
      )
    })

    return breadcrumbs
  }

  return (
    <>
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-2 sm:py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          {/* Breadcrumb navigation */}
              <div className="flex items-center space-x-1 flex-1 min-w-0 w-full sm:w-auto order-2 sm:order-1">
            <div className="flex items-center space-x-1 overflow-x-auto scrollbar-hide w-full sm:w-auto py-1">
              {renderBreadcrumbs()}
            </div>
          </div>

          {/* Mobile menu button */}
          {/* <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="sm:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200 order-1 sm:order-2"
            title="Menu"
          >
            <Menu className="w-5 h-5" />
          </button> */}

          {/* Action buttons */}
          <div className={`${showMobileMenu ? 'flex' : 'hidden'} sm:flex flex-wrap items-center gap-2 sm:gap-3 ml-0 sm:ml-6 w-full sm:w-auto order-3 sm:order-2`}>
            {/* Batch operation buttons - only show when files are selected */}
            {selectedFiles && selectedFiles.size > 0 && (
              <>
                <div className="flex items-center space-x-2 border-r border-gray-300 dark:border-gray-600 pr-2 sm:pr-3 w-full sm:w-auto justify-between sm:justify-start">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedFiles.size} selected
                  </span>
                  <button
                    onClick={onSelectAll}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 focus-ring"
                  >
                    Select All
                  </button>
                </div>
                
                <button
                  onClick={() => onCopy(Array.from(selectedFiles))}
                  className="inline-flex items-center justify-center px-3 py-2 border border-blue-300 dark:border-blue-600 text-sm font-medium rounded-lg text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
                  title="Copy selected files to clipboard"
                >
                  <Copy className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Copy</span>
                </button>

                <button
                  onClick={() => onCut(Array.from(selectedFiles))}
                  className="inline-flex items-center justify-center px-3 py-2 border border-orange-300 dark:border-orange-600 text-sm font-medium rounded-lg text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
                  title="Cut selected files to clipboard"
                >
                  <Scissors className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Cut</span>
                </button>

                <button
                  onClick={() => onCompress(Array.from(selectedFiles))}
                  className="inline-flex items-center justify-center px-3 py-2 border border-purple-300 dark:border-purple-600 text-sm font-medium rounded-lg text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
                  title="Compress selected files to ZIP"
                >
                  <Archive className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Compress</span>
                </button>

                {/* Unzip button - show when ZIP files are selected */}
                {(() => {
                  const selectedFilesArray = Array.from(selectedFiles)
                  const zipFiles = selectedFilesArray.filter(filePath => {
                    const fileName = filePath.split('/').pop() || filePath.split('\\').pop()
                    const ext = fileName.split('.').pop()?.toLowerCase() || ''
                    return ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
                  })
                  
                  if (zipFiles.length > 0) {
                    return (
                      <button
                        onClick={() => {
                          // Extract the first ZIP file (or all if multiple)
                          zipFiles.forEach(zipFilePath => {
                            onUnzip(zipFilePath)
                          })
                        }}
                        className="inline-flex items-center justify-center px-3 py-2 border border-green-300 dark:border-green-600 text-sm font-medium rounded-lg text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
                        title={`Extract ${zipFiles.length} archive(s)`}
                      >
                        <PackageOpen className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Extract</span>
                        <span className="sm:hidden">({zipFiles.length})</span>
                      </button>
                    )
                  }
                  return null
                })()}

                <button
                  onClick={() => onDelete(Array.from(selectedFiles))}
                  className="inline-flex items-center justify-center px-3 py-2 border border-red-300 dark:border-red-600 text-sm font-medium rounded-lg text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
                  title="Delete selected files"
                >
                  <Trash2 className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </>
            )}

            {/* Paste button - show when clipboard has items */}
            {clipboard && clipboard.files.length > 0 && (
              <button
                onClick={onPaste}
                className="inline-flex items-center justify-center px-3 py-2 border border-green-300 dark:border-green-600 text-sm font-medium rounded-lg text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
                title={`Paste ${clipboard.files.length} item(s) from clipboard (${clipboard.operation})`}
              >
                <Clipboard className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Paste</span>
                <span className="sm:hidden">({clipboard.files.length})</span>
              </button>
            )}

            {/* New Folder button */}
            <button
              onClick={handleCreateFolder}
              className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
              title="Create new folder"
            >
              <FolderPlus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Folder</span>
            </button>

            {/* Copy Path button */}
            <button
              onClick={handleCopyPath}
              className="inline-flex items-center justify-center px-3 py-2 border border-blue-300 dark:border-blue-600 text-sm font-medium rounded-lg text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
              title="Copy current path with domain"
            >
              <Link className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Copy Path</span>
            </button>

            {/* Refresh button */}
            <button
              onClick={onRefresh}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200 focus-ring"
              title="Refresh (F5)"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* View mode toggle */}
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden ml-auto sm:ml-0">
              <button
                onClick={() => onViewModeChange('grid')}
                className={`p-2 transition-colors duration-200 ${
                  viewMode === 'grid'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={`p-2 transition-colors duration-200 ${
                  viewMode === 'list'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-lg">
                  <FolderPlus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Create New Folder
                </h2>
              </div>
              <button
                onClick={handleCancelFolder}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Folder Name
                </label>
                <input
                  ref={inputRef}
                  id="folderName"
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter folder name..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors duration-200"
                  autoComplete="off"
                />
              </div>
              
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Folder will be created in: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                  {currentPath || '/'}
                </code>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 p-4 sm:p-6 pt-0 border-t border-gray-200 dark:border-gray-700 sm:border-0">
              <button
                onClick={handleCancelFolder}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 active:bg-gray-100 dark:active:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 transition-colors duration-200 touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFolder}
                disabled={!folderName.trim()}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 touch-manipulation"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default NavigationBar
