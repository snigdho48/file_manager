import React from 'react'
import { 
  Folder, File, Image, Video, Music, FileText, Code, 
  Archive, ChevronRight, MoreHorizontal, PackageOpen 
} from 'lucide-react'

const FileList = ({ files, selectedFiles, isLoading, onFileClick, onFileDoubleClick, onFileContextMenu, onUnzip }) => {
  const getFileIcon = (file) => {
    if (file.type === 'directory') {
      return <Folder className="w-5 h-5 text-primary-500" />
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const mimeType = file.mimeType || ''

    if (mimeType.startsWith('image/')) {
      return <Image className="w-5 h-5 text-green-500" />
    }
    
    if (mimeType.startsWith('video/')) {
      return <Video className="w-5 h-5 text-purple-500" />
    }
    
    if (mimeType.startsWith('audio/')) {
      return <Music className="w-5 h-5 text-pink-500" />
    }
    
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf']
    if (docExts.includes(ext)) {
      return <FileText className="w-5 h-5 text-blue-500" />
    }
    
    const codeExts = ['js', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php', 'json', 'xml']
    if (codeExts.includes(ext)) {
      return <Code className="w-5 h-5 text-orange-500" />
    }
    
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz']
    if (archiveExts.includes(ext)) {
      return <Archive className="w-5 h-5 text-yellow-500" />
    }
    
    return <File className="w-5 h-5 text-gray-500" />
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-700 px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-200 dark:border-gray-600 hidden sm:block">
        <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <div className="col-span-6">Name</div>
          <div className="col-span-2 text-right">Size</div>
          <div className="col-span-3">Modified</div>
          <div className="col-span-1"></div>
        </div>
      </div>

      {/* File list */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {files.map((file) => {
          const isSelected = selectedFiles.has(file.path)
          
          return (
            <div
              key={file.path}
              className={`group grid grid-cols-12 gap-2 sm:gap-4 items-center px-3 sm:px-6 py-3 sm:py-3 cursor-pointer transition-colors duration-200 touch-manipulation ${
                isSelected
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700'
              }`}
              onClick={(e) => onFileClick(file, e)}
              onDoubleClick={() => onFileDoubleClick(file)}
              onContextMenu={(e) => onFileContextMenu(file, e)}
            >
              {/* Name column */}
              <div className="col-span-12 sm:col-span-6 flex items-center space-x-2 sm:space-x-3 min-w-0">
                {/* Selection indicator */}
                {isSelected && (
                  <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0"></div>
                )}
                
                {/* File icon */}
                <div className="flex-shrink-0">
                  {getFileIcon(file)}
                </div>
                
                {/* File name */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {file.name}
                  </p>
                  {file.type === 'directory' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Folder
                    </p>
                  )}
                </div>

                {/* Directory indicator */}
                {file.type === 'directory' && (
                  <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                )}
              </div>

              {/* Size column */}
              <div className="col-span-6 sm:col-span-2 text-left sm:text-right">
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {file.type === 'directory' ? 'Folder' : file.size}
                </span>
              </div>

              {/* Modified column */}
              <div className="col-span-6 sm:col-span-3 hidden sm:block">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(file.modified)}
                </span>
              </div>

              {/* Actions column */}
              <div className="col-span-12 sm:col-span-1 flex justify-end gap-1 sm:justify-end mt-2 sm:mt-0">
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
                        className="p-1 text-green-500 hover:text-green-600 rounded transition-all duration-200"
                        title="Extract archive"
                      >
                        <PackageOpen className="w-4 h-4" />
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
                  className="p-2 sm:p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 active:text-gray-700 dark:active:text-gray-200 rounded transition-all duration-200 touch-manipulation"
                  title="More options"
                >
                  <MoreHorizontal className="w-5 h-5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default FileList
