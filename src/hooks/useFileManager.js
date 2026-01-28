import { useState, useCallback, useRef, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { getFileUrl } from '../utils/apiUtils'

export const useFileManager = () => {
  // State
  const [currentPath, setCurrentPath] = useState('')
  const [files, setFiles] = useState([])
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  
  // Clipboard state
  const [clipboard, setClipboard] = useState({ files: [], operation: null }) // 'copy' or 'cut'

  // Load files for current path
  const loadFiles = useCallback(async (path = currentPath) => {
    setIsLoading(true)
    try {
      // Ensure path is a string (handle case where event object is passed)
      const pathString = typeof path === 'string' ? path : currentPath
      const response = await axios.get(`/api/files?path=${encodeURIComponent(pathString)}`)
      setFiles(response.data.items || [])
      setCurrentPath(response.data.path)
      setSelectedFiles(new Set())
    } catch (error) {
      console.error('Failed to load files:', error)
      toast.error('Failed to load files')
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [currentPath])

  // Navigate to path
  const navigateToPath = useCallback(async (path) => {
    // Normalize path: remove leading/trailing slashes, but keep empty string for root
    const normalizedPath = path ? path.replace(/^\/+|\/+$/g, '') : ''
    await loadFiles(normalizedPath)
    setSelectedFiles(new Set())
  }, [loadFiles])

  // File selection
  const selectFile = useCallback((filePath) => {
    setSelectedFiles(prev => {
      const newSelection = new Set(prev)
      if (newSelection.has(filePath)) {
        newSelection.delete(filePath)
      } else {
        newSelection.add(filePath)
      }
      return newSelection
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedFiles(new Set(files.map(file => file.path)))
  }, [files])

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set())
  }, [])

  // File operations
  const uploadFiles = useCallback(async (fileList, path = currentPath) => {
    const formData = new FormData()
    const files = Array.from(fileList)
    files.forEach(file => {
      formData.append('files', file)
    })

    try {
      const response = await axios.post(`/api/upload?path=${encodeURIComponent(path)}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: () => {
          // Upload progress tracking (can be used for progress indicators)
        },
      })

      toast.success(`${response.data.files.length} file(s) uploaded successfully`)
      return response.data
    } catch (error) {
      console.error('Upload failed:', error)
      const errorMessage = error.response?.data?.error || 'Upload failed'
      toast.error(errorMessage)
      throw error
    }
  }, [currentPath])

  const downloadFile = useCallback(async (filePath) => {
    try {
      // Use proper API URL construction - ensure it uses the API domain
      const downloadUrl = getFileUrl(filePath, false)
      
      console.log('Downloading file:', filePath)
      console.log('Download URL:', downloadUrl)
      
      // Show loading toast
      const loadingToast = toast.loading('Preparing download...')
      
      // Use fetch with credentials to ensure authentication cookies are sent
      const response = await fetch(downloadUrl, {
        method: 'GET',
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Accept': '*/*', // Accept any content type
        },
      })
      
      console.log('Download response status:', response.status, response.statusText)
      console.log('Download response headers:', {
        'content-type': response.headers.get('content-type'),
        'content-disposition': response.headers.get('content-disposition'),
        'content-length': response.headers.get('content-length'),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `Download failed: ${response.statusText}`
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error || errorMessage
        } catch {
          // If not JSON, use the text or status text
          if (errorText) errorMessage = errorText
        }
        toast.dismiss(loadingToast)
        throw new Error(errorMessage)
      }
      
      // Get the filename from Content-Disposition header or use the path
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = filePath.split('/').pop() || 'download'
      
      if (contentDisposition) {
        // Try to extract filename from Content-Disposition header
        // Handles both quoted and unquoted filenames, including filename*=UTF-8'' format
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '').trim()
          // Decode URI if needed
          try {
            filename = decodeURIComponent(filename)
          } catch {
            // If decoding fails, use as-is
          }
        }
        // Also check for filename*=UTF-8'' format
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/)
        if (utf8Match && utf8Match[1]) {
          try {
            filename = decodeURIComponent(utf8Match[1])
          } catch {
            // If decoding fails, keep previous filename
          }
        }
      }
      
      console.log('Downloading file as:', filename)
      
      // Create blob and download
      const blob = await response.blob()
      
      console.log('Blob created:', {
        size: blob.size,
        type: blob.type
      })
      
      // Check if blob is empty
      if (blob.size === 0) {
        toast.dismiss(loadingToast)
        throw new Error('Download failed: Empty file received')
      }
      
      // Check if the response is HTML (likely the frontend page was served instead)
      const blobType = blob.type || ''
      if (blobType.includes('text/html')) {
        // Try to read as text to see if it's an error page
        const text = await blob.text()
        if (text.includes('<!DOCTYPE html>') || text.includes('<html') || text.includes('React') || text.includes('root')) {
          toast.dismiss(loadingToast)
          throw new Error('Download failed: Received frontend page instead of file. The API endpoint may not be configured correctly.')
        }
      }
      
      // Check if it's a JSON error response
      if (blobType.includes('application/json')) {
        const text = await blob.text()
        try {
          const json = JSON.parse(text)
          if (json.error) {
            toast.dismiss(loadingToast)
            throw new Error(json.error)
          }
        } catch {
          // Not an error JSON, continue with download
        }
      }
      
      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      
      // Trigger download
      link.click()
      
      // Cleanup after a short delay
      setTimeout(() => {
        if (link.parentNode) {
          document.body.removeChild(link)
        }
        window.URL.revokeObjectURL(url)
      }, 200)
      
      toast.dismiss(loadingToast)
      toast.success(`Downloading ${filename}...`)
      
      console.log('Download triggered successfully')
    } catch (error) {
      console.error('Download failed:', error)
      const errorMessage = error.message || 'Download failed'
      toast.error(errorMessage)
      
      // Log detailed error for debugging
      console.error('Download error details:', {
        filePath,
        downloadUrl: getFileUrl(filePath, false),
        error: error.message,
        stack: error.stack
      })
    }
  }, [])

  const deleteFiles = useCallback(async (filePaths) => {
    try {
      await Promise.all(
        filePaths.map(path =>
          axios.delete('/api/delete', { data: { path } })
        )
      )
      toast.success('Files deleted successfully')
      return true
    } catch (error) {
      console.error('Delete failed:', error)
      const errorMessage = error.response?.data?.error || 'Delete failed'
      toast.error(errorMessage)
      throw error
    }
  }, [])

  const deleteSelectedFiles = useCallback(async (filePaths) => {
    await deleteFiles(filePaths)
    setSelectedFiles(new Set())
  }, [deleteFiles])

  const createFolder = useCallback(async (parentPath, folderName) => {
    try {
      await axios.post('/api/mkdir', {
        path: parentPath,
        name: folderName
      })
      toast.success('Folder created successfully')
      return true
    } catch (error) {
      console.error('Create folder failed:', error)
      const errorMessage = error.response?.data?.error || 'Failed to create folder'
      toast.error(errorMessage)
      throw error
    }
  }, [])

  const renameFile = useCallback(async (oldPath, newName) => {
    try {
      await axios.put('/api/rename', {
        oldPath,
        newName
      })
      toast.success('File renamed successfully')
      return true
    } catch (error) {
      console.error('Rename failed:', error)
      const errorMessage = error.response?.data?.error || 'Rename failed'
      toast.error(errorMessage)
      throw error
    }
  }, [])

  const previewFile = useCallback(async (filePath) => {
    try {
      const response = await axios.get(`/api/preview?path=${encodeURIComponent(filePath)}`)
      return { ...response.data, path: filePath }
    } catch (error) {
      console.error('Preview failed:', error)
      const errorMessage = error.response?.data?.error || 'Preview failed'
      toast.error(errorMessage)
      throw error
    }
  }, [])

  // Search functionality with debouncing
  const searchTimeoutRef = useRef(null)
  
  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setIsSearching(false)
  }, [])
  
  const searchFiles = useCallback(async (query) => {
    if (!query.trim()) {
      clearSearch()
      return
    }

    setSearchQuery(query)
    setIsSearching(true)

    try {
      const response = await axios.get(`/api/search?q=${encodeURIComponent(query)}&path=${encodeURIComponent(currentPath)}`)
      setSearchResults(response.data.results || [])
    } catch (error) {
      console.error('Search failed:', error)
      toast.error('Search failed')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [currentPath, clearSearch])

  // Live search with debouncing
  const handleLiveSearch = useCallback((query) => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // If query is empty, clear search immediately
    if (!query.trim()) {
      clearSearch()
      return
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      searchFiles(query)
    }, 300) // 300ms debounce delay
  }, [searchFiles, clearSearch])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  // Copy files to clipboard
  const copyFilesToClipboard = useCallback((filePaths) => {
    setClipboard({ files: filePaths, operation: 'copy' })
    toast.success(`${filePaths.length} item(s) copied to clipboard`)
  }, [])

  // Cut files to clipboard
  const cutFilesToClipboard = useCallback((filePaths) => {
    setClipboard({ files: filePaths, operation: 'cut' })
    toast.success(`${filePaths.length} item(s) cut to clipboard`)
  }, [])

  // Paste files from clipboard
  const pasteFilesFromClipboard = useCallback(async (destinationPath = currentPath) => {
    if (!clipboard.files.length) {
      toast.error('No items in clipboard')
      return false
    }

    try {
      if (clipboard.operation === 'copy') {
        await axios.post('/api/copy', {
          files: clipboard.files,
          destination: destinationPath
        })
        toast.success(`${clipboard.files.length} item(s) pasted successfully`)
      } else if (clipboard.operation === 'cut') {
        await axios.post('/api/move', {
          files: clipboard.files,
          destination: destinationPath
        })
        toast.success(`${clipboard.files.length} item(s) moved successfully`)
        // Clear clipboard after cut operation
        setClipboard({ files: [], operation: null })
      }
      return true
    } catch (error) {
      console.error('Paste failed:', error)
      const errorMessage = error.response?.data?.error || 'Paste failed'
      toast.error(errorMessage)
      throw error
    }
  }, [clipboard, currentPath])

  // Clear clipboard
  const clearClipboard = useCallback(() => {
    setClipboard({ files: [], operation: null })
  }, [])

  // Move files
  const moveFiles = useCallback(async (filePaths, destinationPath) => {
    try {
      await axios.post('/api/move', {
        files: filePaths,
        destination: destinationPath
      })
      toast.success(`${filePaths.length} item(s) moved successfully`)
      return true
    } catch (error) {
      console.error('Move failed:', error)
      const errorMessage = error.response?.data?.error || 'Move failed'
      toast.error(errorMessage)
      throw error
    }
  }, [])

  // Compress files to ZIP
  const compressFiles = useCallback(async (filePaths, zipName) => {
    try {
      const response = await axios.post('/api/compress', {
        files: filePaths,
        zipName: zipName || 'archive.zip',
        destination: currentPath
      })
      toast.success('Files compressed successfully')
      return response.data
    } catch (error) {
      console.error('Compress failed:', error)
      const errorMessage = error.response?.data?.error || 'Compress failed'
      toast.error(errorMessage)
      throw error
    }
  }, [currentPath])

  // Extract archive
  const extractArchive = useCallback(async (archivePath, destinationPath) => {
    try {
      
      if (!archivePath) {
        throw new Error('Archive path is required')
      }
      
      await axios.post('/api/extract', {
        archivePath,
        destination: destinationPath
      })
      toast.success('Archive extracted successfully')
      return true
    } catch (error) {
      console.error('Extract failed:', error)
      const errorMessage = error.response?.data?.error || 'Extract failed'
      toast.error(errorMessage)
      throw error
    }
  }, [])

  // Utility functions
  const getFileIcon = useCallback((file) => {
    if (file.type === 'directory') {
      return 'Folder'
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const mimeType = file.mimeType || ''

    if (mimeType.startsWith('image/')) return 'Image'
    if (mimeType.startsWith('video/')) return 'Video'
    if (mimeType.startsWith('audio/')) return 'Music'
    
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf']
    if (docExts.includes(ext)) return 'FileText'
    
    const codeExts = ['js', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php', 'json', 'xml']
    if (codeExts.includes(ext)) return 'Code'
    
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz']
    if (archiveExts.includes(ext)) return 'Archive'
    
    return 'File'
  }, [])

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  return {
    // State
    currentPath,
    files,
    selectedFiles,
    isLoading,
    viewMode,
    searchQuery,
    searchResults,
    isSearching,

    // Actions
    loadFiles,
    navigateToPath,
    setViewMode,
    selectFile,
    selectAll,
    clearSelection,
    uploadFiles,
    downloadFile,
    deleteFiles,
    deleteSelectedFiles,
    createFolder,
    renameFile,
    previewFile,
    searchFiles,
    handleLiveSearch,
    clearSearch,

    // Utilities
    getFileIcon,
    formatFileSize,

    // Additional operations
    copyFilesToClipboard,
    cutFilesToClipboard,
    pasteFilesFromClipboard,
    clearClipboard,
    clipboard,
    moveFiles,
    compressFiles,
    extractArchive
  }
}
