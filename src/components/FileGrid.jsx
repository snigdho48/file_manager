import React, { useState } from 'react'
import { 
  Folder, File, Image, Video, Music, FileText, Code, 
  Archive, Download, Eye, MoreHorizontal, PackageOpen 
} from 'lucide-react'
import FileThumbnail from './FileThumbnail'

const FileGrid = ({ files, selectedFiles, isLoading, onFileClick, onFileDoubleClick, onFileContextMenu, onUnzip }) => {
  const shouldShowThumbnail = (file) => {
    if (file.type === 'directory') return false
    const mimeType = file.mimeType || ''
    return mimeType.startsWith('image/') || mimeType.startsWith('video/')
  }

  const getFileIcon = (file) => {
    if (file.type === 'directory') {
      return <Folder className="w-10 h-10 sm:w-12 sm:h-12 text-primary-500" />
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const mimeType = file.mimeType || ''

    if (mimeType.startsWith('image/')) {
      return <Image className="w-10 h-10 sm:w-12 sm:h-12 text-green-500" />
    }
    
    if (mimeType.startsWith('video/')) {
      return <Video className="w-10 h-10 sm:w-12 sm:h-12 text-purple-500" />
    }
    
    if (mimeType.startsWith('audio/')) {
      return <Music className="w-10 h-10 sm:w-12 sm:h-12 text-pink-500" />
    }
    
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf']
    if (docExts.includes(ext)) {
      return <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-blue-500" />
    }
    
    const codeExts = ['js', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php', 'json', 'xml']
    if (codeExts.includes(ext)) {
      return <Code className="w-10 h-10 sm:w-12 sm:h-12 text-orange-500" />
    }
    
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz']
    if (archiveExts.includes(ext)) {
      return <Archive className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500" />
    }
    
    return <File className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500" />
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const truncateFileName = (name, maxLength = 20) => {
    if (!name) return ''
    if (name.length <= maxLength) return name
    const lastDotIndex = name.lastIndexOf('.')
    if (lastDotIndex === -1) return name.substring(0, maxLength - 3) + '...'
    const ext = name.substring(lastDotIndex + 1)
    const nameWithoutExt = name.substring(0, lastDotIndex)
    const truncated = nameWithoutExt.substring(0, Math.max(1, maxLength - ext.length - 4)) + '...'
    return `${truncated}.${ext}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="spinner w-8 h-8 border-4 border-gray-200 border-t-primary-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading files...</p>
        </div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Folder className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
            This folder is empty
          </h3>
          <p className="text-gray-400 dark:text-gray-500">
            Drop files here or click "Upload" to add content
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4 p-2 sm:p-4">
      {files.map((file) => {
        const isSelected = selectedFiles.has(file.path)
        
        return (
          <div
            key={file.path}
            className={`group relative bg-white dark:bg-gray-800 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:shadow-md file-item touch-manipulation ${
              isSelected
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600'
            }`}
            onClick={(e) => onFileClick(file, e)}
            onDoubleClick={() => onFileDoubleClick(file)}
            onContextMenu={(e) => onFileContextMenu(file, e)}
          >
            {/* File content */}
            <div className="p-3 sm:p-4 text-center">
              {/* File icon or thumbnail */}
              <div className="flex justify-center mb-2 sm:mb-3">
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
                  {shouldShowThumbnail(file) ? (
                    <FileThumbnail
                      file={file}
                      size={160}
                      className="w-full h-full object-cover"
                      fallback={
                        <div className="w-full h-full flex items-center justify-center">
                          {getFileIcon(file)}
                        </div>
                      }
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {getFileIcon(file)}
                    </div>
                  )}
                </div>
              </div>
              
              {/* File name */}
              <div className="space-y-1">
                <h3 
                  className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate px-1" 
                  title={file.name}
                >
                  {truncateFileName(file.name, 15)}
                </h3>
                
                {/* File metadata */}
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 hidden sm:block">
                  {file.type === 'directory' ? (
                    <div>Folder</div>
                  ) : (
                    <>
                      <div>{file.size}</div>
                      <div>{formatDate(file.modified)}</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Selection indicator */}
            {isSelected && (
              <div className="absolute top-2 left-2 w-4 h-4 bg-primary-600 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            )}

            {/* Hover actions */}
            <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100">
              {/* Unzip button for archive files */}
              {file.type === 'file' && onUnzip && (() => {
                const ext = file.name.split('.').pop()?.toLowerCase() || ''
                const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz']
                if (archiveExts.includes(ext)) {
                  return (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onUnzip(file.path)
                      }}
                      className="p-1.5 sm:p-1 bg-green-500 text-white rounded-full shadow-md hover:bg-green-600 active:bg-green-700 transition-colors duration-200 touch-manipulation"
                      title="Extract archive"
                    >
                      <PackageOpen className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                    </button>
                  )
                }
                return null
              })()}
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onFileContextMenu(file, e)
                }}
                className="p-1.5 sm:p-1 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-50 dark:hover:bg-gray-600 active:bg-gray-100 dark:active:bg-gray-500 transition-colors duration-200 touch-manipulation"
                title="More options"
              >
                <MoreHorizontal className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default FileGrid
