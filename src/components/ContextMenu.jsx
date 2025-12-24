import React, { useState, useEffect, useRef } from 'react'
import { 
  FolderOpen, Download, Eye, Edit3, Trash2, Archive, 
  File, Folder, Image, Video, Music, FileText, Code 
} from 'lucide-react'

const ContextMenu = ({ x, y, file, onOpen, onDownload, onPreview, onRename, onDelete, onExtract }) => {
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const menuRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (renaming && inputRef.current) {
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
      setNewName(nameWithoutExt)
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [renaming, file.name])

  useEffect(() => {
    // Position the menu to stay within viewport
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = x
      let adjustedY = y

      // Adjust horizontal position - prioritize showing menu on the right, but flip to left if needed
      if (x + rect.width > viewportWidth) {
        adjustedX = Math.max(8, viewportWidth - rect.width - 8) // 8px padding from edge
      } else if (x < 8) {
        adjustedX = 8
      }

      // Adjust vertical position - prioritize showing menu below, but flip to above if needed
      if (y + rect.height > viewportHeight) {
        adjustedY = Math.max(8, viewportHeight - rect.height - 8) // 8px padding from edge
      } else if (y < 8) {
        adjustedY = 8
      }

      menuRef.current.style.left = `${adjustedX}px`
      menuRef.current.style.top = `${adjustedY}px`
    }
  }, [x, y])

  const getFileIcon = () => {
    if (file.type === 'directory') {
      return <Folder className="w-4 h-4 text-primary-500" />
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const mimeType = file.mimeType || ''

    if (mimeType.startsWith('image/')) return <Image className="w-4 h-4 text-green-500" />
    if (mimeType.startsWith('video/')) return <Video className="w-4 h-4 text-purple-500" />
    if (mimeType.startsWith('audio/')) return <Music className="w-4 h-4 text-pink-500" />
    
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf']
    if (docExts.includes(ext)) return <FileText className="w-4 h-4 text-blue-500" />
    
    const codeExts = ['js', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php', 'json', 'xml']
    if (codeExts.includes(ext)) return <Code className="w-4 h-4 text-orange-500" />
    
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz']
    if (archiveExts.includes(ext)) return <Archive className="w-4 h-4 text-yellow-500" />
    
    return <File className="w-4 h-4 text-gray-500" />
  }

  const handleRename = () => {
    if (newName.trim() && newName.trim() !== file.name) {
      // Add extension back for files
      const finalName = file.type === 'directory' 
        ? newName.trim() 
        : `${newName.trim()}.${file.name.split('.').pop()}`
      onRename(finalName)
    }
    setRenaming(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setRenaming(false)
    }
  }

  const isArchive = () => {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    return ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
  }

  const menuItems = [
    {
      icon: file.type === 'directory' ? FolderOpen : Eye,
      label: file.type === 'directory' ? 'Open' : 'Preview',
      action: onOpen,
      show: true
    },
    {
      icon: Download,
      label: 'Download',
      action: onDownload,
      show: file.type === 'file'
    },
    {
      icon: Eye,
      label: 'Preview',
      action: onPreview,
      show: file.type === 'file'
    },
    {
      icon: Archive,
      label: 'Extract',
      action: onExtract,
      show: file.type === 'file' && isArchive()
    },
    {
      icon: Edit3,
      label: 'Rename',
      action: () => setRenaming(true),
      show: true
    },
    {
      icon: Trash2,
      label: 'Delete',
      action: onDelete,
      show: true,
      variant: 'danger'
    }
  ]

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 min-w-48 max-w-[90vw] z-50 context-menu touch-manipulation"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* File info header */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          {getFileIcon()}
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {file.name}
          </span>
        </div>
      </div>

      {/* Rename input */}
      {renaming ? (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleRename}
            className="w-full px-2 py-1 text-sm border border-primary-300 dark:border-primary-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="New name..."
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Press Enter to save, Escape to cancel
          </div>
        </div>
      ) : null}

      {/* Menu items */}
      <div className="py-1">
        {menuItems.filter(item => item.show).map((item, index) => {
          const IconComponent = item.icon
          return (
            <button
              key={index}
              onClick={item.action}
              className={`w-full flex items-center space-x-3 px-4 py-3 sm:py-2 text-sm transition-colors duration-200 active:opacity-70 ${
                item.variant === 'danger'
                  ? 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 dark:active:bg-red-900/30'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'
              }`}
            >
              <IconComponent className="w-5 h-5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ContextMenu
