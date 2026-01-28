import React, { useRef, useEffect, useState } from 'react'
import { X, Download, FileText, Image, File } from 'lucide-react'
import { getFileUrl, getApiBaseURL } from '../utils/apiUtils'
import axios from 'axios'

const PreviewModal = ({ file, onClose, onDownload }) => {
  const modalRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewError, setPreviewError] = useState(false)
  const objectUrlRef = useRef(null)

  // Load preview URL for media files (images, videos, audio)
  useEffect(() => {
    if (!file) return

    const mimeType = file.mimeType || ''
    const isMediaFile = mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/')

    if (isMediaFile && !file.isText) {
      const loadPreview = async () => {
        try {
          const apiBaseURL = getApiBaseURL()
          const url = `${apiBaseURL}/api/download?path=${encodeURIComponent(file.path)}&preview=true`
          
          const response = await axios.get(url, {
            responseType: 'blob',
            withCredentials: true
          })

          const objectUrl = URL.createObjectURL(response.data)
          objectUrlRef.current = objectUrl
          setPreviewUrl(objectUrl)
          setPreviewError(false)
        } catch (err) {
          console.error('Preview load error:', err)
          setPreviewError(true)
          setPreviewUrl(null)
        }
      }

      loadPreview()
    }

    // Cleanup object URL on unmount
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      setPreviewUrl(null)
      setPreviewError(false)
    }
  }, [file?.path])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  const renderPreviewContent = () => {
    const mimeType = file.mimeType || ''

    // Text files
    if (file.isText && file.content) {
      return (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-96 overflow-auto">
          <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-mono">
            {file.content}
          </pre>
        </div>
      )
    }

    // Image files
    if (mimeType.startsWith('image/')) {
      if (previewError || !previewUrl) {
        return (
          <div className="text-center py-8">
            <Image className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Failed to load image preview</p>
          </div>
        )
      }
      return (
        <div className="flex justify-center">
          <img
            src={previewUrl}
            alt={file.name}
            className="max-w-full max-h-96 rounded-lg shadow-lg"
            onError={(e) => {
              setPreviewError(true)
              e.target.style.display = 'none'
            }}
          />
        </div>
      )
    }

    // Video files
    if (mimeType.startsWith('video/')) {
      if (previewError || !previewUrl) {
        return (
          <div className="text-center py-8">
            <File className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Failed to load video preview</p>
          </div>
        )
      }
      return (
        <div className="flex justify-center">
          <video
            controls
            className="max-w-full max-h-96 rounded-lg shadow-lg"
            onError={(e) => {
              setPreviewError(true)
              e.target.style.display = 'none'
            }}
          >
            <source src={previewUrl} type={mimeType} />
            Your browser does not support video playback.
          </video>
        </div>
      )
    }

    // Audio files
    if (mimeType.startsWith('audio/')) {
      if (previewError || !previewUrl) {
        return (
          <div className="text-center py-8">
            <File className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Failed to load audio preview</p>
          </div>
        )
      }
      return (
        <div className="flex justify-center">
          <audio
            controls
            className="w-full max-w-md"
            onError={() => {
              setPreviewError(true)
            }}
          >
            <source src={previewUrl} type={mimeType} />
            Your browser does not support audio playback.
          </audio>
        </div>
      )
    }

    // Default - file info
    return (
      <div className="text-center py-8">
        <File className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Preview not available
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          This file type cannot be previewed in the browser
        </p>
        <button
          onClick={onDownload}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
        >
          <Download className="w-4 h-4 mr-2" />
          Download File
        </button>
      </div>
    )
  }

  const getFileIcon = () => {
    const mimeType = file.mimeType || ''
    
    if (file.isText) return <FileText className="w-6 h-6 text-blue-500" />
    if (mimeType.startsWith('image/')) return <Image className="w-6 h-6 text-green-500" />
    return <File className="w-6 h-6 text-gray-500" />
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div 
        ref={modalRef} 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            {getFileIcon()}
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white truncate">
                {file.name}
              </h2>
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1">
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {file.size}
                </span>
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                  {file.mimeType}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={onDownload}
              className="inline-flex items-center p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-6">
          {renderPreviewContent()}
        </div>

        {/* Footer with file details */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-2 sm:py-4 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            <div className="truncate min-w-0 flex-1">
              File: <span className="font-mono truncate">{file.name}</span>
            </div>
            <div className="flex-shrink-0">
              Size: {file.size}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PreviewModal
