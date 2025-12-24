import React, { useState, useRef, useEffect } from 'react'
import { X, Upload, File, FolderOpen, CheckCircle, AlertCircle, Folder } from 'lucide-react'

const UploadModal = ({ currentPath, onUpload, onClose }) => {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResults, setUploadResults] = useState(null)
  const fileInputRef = useRef(null)
  const modalRef = useRef(null)

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

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files))
    }
  }

  const handleFiles = (files) => {
    // Skip folders and 0-byte files, only allow actual files
    const validFiles = files.filter(file => {
      // Skip folders (0-byte files without extensions)
      if (file.size === 0 && !file.name.includes('.')) {
        return false // Skip folders
      }
      
      // Skip 0-byte files
      if (file.size === 0) {
        return false // Skip 0-byte files
      }
      
      // Skip dangerous file extensions
      const dangerousExts = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs']
      const ext = '.' + file.name.split('.').pop().toLowerCase()
      return !dangerousExts.includes(ext)
    })

    setSelectedFiles(validFiles)
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setUploading(true)
    setUploadProgress(0)

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 100)

      const result = await onUpload(selectedFiles, currentPath)
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      setUploadResults(result)
      
      // Auto close after success
      setTimeout(() => {
        onClose()
      }, 2000)

    } catch (error) {
      console.error('Upload failed:', error)
      setUploadResults({ error: error.message || 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  const resetModal = () => {
    setSelectedFiles([])
    setUploading(false)
    setUploadProgress(0)
    setUploadResults(null)
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50'>
      <div
        ref={modalRef}
        className='bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden'
      >
        {/* Header */}
        <div className='flex items-center justify-between p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex items-center space-x-3'>
            <Upload className='w-6 h-6 text-primary-600' />
            <h2 className='text-xl font-semibold text-gray-900 dark:text-white'>
              Upload Files
            </h2>
          </div>
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200'
          >
            <X className='w-5 h-5 text-gray-500 dark:text-gray-400' />
          </button>
        </div>

        {/* Content */}
        <div className='p-3 sm:p-6 overflow-y-auto max-h-[calc(95vh-140px)] sm:max-h-[calc(90vh-140px)]'>
          {!uploadResults ? (
            <>
              {/* Current path */}
              <div className='mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'>
                <div className='flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400'>
                  <FolderOpen className='w-4 h-4' />
                  <span>Upload to:</span>
                  <code className='bg-white dark:bg-gray-800 px-2 py-1 rounded text-xs'>
                    {currentPath || "/"}
                  </code>
                </div>
              </div>

              {/* Drop zone */}
              {selectedFiles.length === 0 ? (
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
                    dragActive
                      ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20"
                      : "border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className='w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4' />
                  <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-2'>
                    Drop files here
                  </h3>
                  <p className='text-gray-500 dark:text-gray-400 mb-4'>
                    or click to browse files
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 transition-colors duration-200'
                  >
                    <FolderOpen className='w-4 h-4 mr-2' />
                    Choose Files
                  </button>
                                      <input
                      ref={fileInputRef}
                      type='file'
                      multiple
                      onChange={handleFileInput}
                      className='hidden'
                    />
                </div>
              ) : (
                <>
                  {/* Selected files list */}
                  <div className='space-y-3 mb-6'>
                    <h3 className='font-medium text-gray-900 dark:text-white'>
                      Selected Files ({selectedFiles.length})
                    </h3>
                    <div className='max-h-48 overflow-y-auto space-y-2'>
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'
                        >
                          <div className='flex items-center space-x-3 min-w-0'>
                            <File className='w-5 h-5 text-gray-400 flex-shrink-0' />
                            <div className='min-w-0'>
                              <p className='text-sm font-medium text-gray-900 dark:text-white truncate'>
                                {file.name}
                              </p>
                              <p className='text-xs text-gray-500 dark:text-gray-400'>
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className='p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors duration-200'
                          >
                            <X className='w-4 h-4 text-gray-500 dark:text-gray-400' />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Upload progress */}
                  {uploading && (
                    <div className='mb-6'>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                          Uploading...
                        </span>
                        <span className='text-sm text-gray-500 dark:text-gray-400'>
                          {uploadProgress}%
                        </span>
                      </div>
                      <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
                        <div
                          className='progress-bar h-2 rounded-full transition-all duration-300'
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className='flex space-x-3'>
                    <button
                      onClick={handleUpload}
                      disabled={uploading || selectedFiles.length === 0}
                      className='flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200'
                    >
                      {uploading ? (
                        <>
                          <div className='spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2'></div>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className='w-4 h-4 mr-2' />
                          Upload {selectedFiles.length} file
                          {selectedFiles.length !== 1 ? "s" : ""}
                        </>
                      )}
                    </button>
                    <button
                      onClick={resetModal}
                      disabled={uploading}
                      className='px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200'
                    >
                      Clear
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            /* Upload results */
            <div className='text-center'>
              {uploadResults.error ? (
                <div className='mb-6'>
                  <AlertCircle className='w-16 h-16 text-red-500 mx-auto mb-4' />
                  <h3 className='text-lg font-medium text-red-900 dark:text-red-400 mb-2'>
                    Upload Failed
                  </h3>
                  <p className='text-red-700 dark:text-red-300'>
                    {uploadResults.error}
                  </p>
                </div>
              ) : (
                <div className='mb-6'>
                  <CheckCircle className='w-16 h-16 text-green-500 mx-auto mb-4' />
                  <h3 className='text-lg font-medium text-green-900 dark:text-green-400 mb-2'>
                    Upload Complete!
                  </h3>
                  <p className='text-green-700 dark:text-green-300'>
                    {uploadResults.files?.length || selectedFiles.length}{" "}
                    file(s) uploaded successfully
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UploadModal
