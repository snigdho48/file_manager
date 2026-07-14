import React, { useState, useEffect } from 'react'
import Header from './Header'
import NavigationBar from './NavigationBar'
import FileGrid from './FileGrid'
import FileList from './FileList'
import UploadModal from './UploadModal'
import PreviewModal from './PreviewModal'
import ConfirmDialog from './ConfirmDialog'
import ContextMenu from './ContextMenu'
import SearchResults from './SearchResults'
import { useFileManager } from '../hooks/useFileManager'
import { useTheme } from '../context/ThemeContext'

const FileManager = () => {
  const { isDark } = useTheme()
  const {
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
    deleteSelectedFiles,
    createFolder,
    renameFile,
    searchFiles,
    handleLiveSearch,
    clearSearch,
    uploadFiles,
    downloadFile,
    previewFile,
    saveFile,
    copyFilesToClipboard,
    cutFilesToClipboard,
    pasteFilesFromClipboard,
    clearClipboard,
    clipboard,
    moveFiles,
    compressFiles,
    extractArchive
  } = useFileManager()

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showCompressDialog, setShowCompressDialog] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, file: null })
  
  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    loadFiles()
  }, [])

  const handleFileClick = (file, event) => {
    
    // If we're in search mode and clicking a folder, navigate to it
    if (searchQuery && file.type === 'directory' && !event.ctrlKey && !event.metaKey) {
      clearSearch()
      navigateToPath(file.path)
      return
    }
    
    if (event.ctrlKey || event.metaKey) {
      selectFile(file.path)
    } else {
      clearSelection()
      selectFile(file.path)
    }
  }

  const handleFileDoubleClick = (file) => {
    if (file.type === 'directory') {
      // Clear search when navigating to a folder
      if (searchQuery) {
        clearSearch()
      }
      navigateToPath(file.path)
    } else {
      handlePreviewFile(file)
    }
  }

  const handleFileContextMenu = (file, event) => {
    event.preventDefault()
    setContextMenu({
      show: true,
      x: event.pageX,
      y: event.pageY,
      file
    })
  }

  const handlePreviewFile = async (file) => {
    try {
      const data = await previewFile(file.path)
      setPreviewData(data)
      setShowPreviewModal(true)
    } catch (error) {
      console.error('Preview failed:', error)
    }
  }

  const handleUpload = async (files, path = currentPath) => {
    try {
      await uploadFiles(files, path)
      setShowUploadModal(false)
      loadFiles()
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }

  const handleDelete = (filePaths) => {
    setConfirmAction({
      title: 'Delete Items',
      message: `Are you sure you want to delete ${filePaths.length} item(s)? This action cannot be undone.`,
      onConfirm: async () => {
        await deleteSelectedFiles(filePaths)
        setShowConfirmDialog(false)
        loadFiles()
      }
    })
    setShowConfirmDialog(true)
  }

  const handleCopy = (filePaths) => {
    copyFilesToClipboard(filePaths)
  }

  const handleCut = (filePaths) => {
    cutFilesToClipboard(filePaths)
  }

  const handlePaste = async () => {
    try {
      await pasteFilesFromClipboard()
      loadFiles()
      // Clear clipboard after successful paste
      clearClipboard()
    } catch (error) {
      console.error('Paste failed:', error)
    }
  }

  const handleMove = (filePaths) => {
    cutFilesToClipboard(filePaths)
  }

  const handleCompress = (filePaths) => {
    // Auto-generate ZIP name based on current directory or first file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
    const zipName = filePaths.length === 1 
      ? `${filePaths[0].split('/').pop().split('.')[0]}_${timestamp}.zip`
      : `archive_${timestamp}.zip`
    
    compressFiles(filePaths, zipName)
      .then(() => {
        loadFiles()
      })
      .catch(error => {
        console.error('Compress failed:', error)
      })
  }

  const handleExtract = async (archivePath) => {
    try {
      
      // Auto-extract directly to current directory (no folder creation)
      const destination = currentPath || ''
      
      if (!archivePath) {
        console.error('Archive path is undefined or empty')
        return
      }
      
      await extractArchive(archivePath, destination)
      loadFiles()
    } catch (error) {
      console.error('Extract failed:', error)
    }
  }

  const handleRename = async (oldPath, newName) => {
    try {
      await renameFile(oldPath, newName)
      loadFiles()
    } catch (error) {
      console.error('Rename failed:', error)
    }
  }

  const handleCreateFolder = async (name) => {
    try {
      await createFolder(currentPath, name)
      loadFiles()
    } catch (error) {
      console.error('Create folder failed:', error)
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    try {
      const files = Array.from(e.dataTransfer.files)
      
      if (files.length > 0) {
        await uploadFiles(files, currentPath)
        loadFiles()
      }
    } catch (error) {
      console.error('Drag & drop upload failed:', error)
    }
  }


  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ show: false, x: 0, y: 0, file: null })
    }

    if (contextMenu.show) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu.show])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e) => {
      // Delete key
      if (e.key === 'Delete' && selectedFiles.length > 0) {
        e.preventDefault()
        handleDelete(Array.from(selectedFiles))
      }
      
      // Ctrl+A - Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        selectAll()
      }
      
      // F5 - Refresh
      if (e.key === 'F5') {
        e.preventDefault()
        loadFiles()
      }
      
      // Escape - Clear selection and close modals
      if (e.key === 'Escape') {
        clearSelection()
        setContextMenu({ show: false, x: 0, y: 0, file: null })
        setShowUploadModal(false)
        setShowPreviewModal(false)
        setShowConfirmDialog(false)
        clearSearch()
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [selectedFiles])

  return (
    <div 
      className={`h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200 ${
        isDragOver ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Header
        searchQuery={searchQuery}
        onSearch={searchFiles}
        onLiveSearch={handleLiveSearch}
        onClearSearch={clearSearch}
        onUpload={() => setShowUploadModal(true)}
      />
      
      <NavigationBar
        currentPath={currentPath}
        onNavigate={navigateToPath}
        onCreateFolder={handleCreateFolder}
        onRefresh={loadFiles}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedFiles={selectedFiles}
        onCopy={handleCopy}
        onCut={handleCut}
        onPaste={handlePaste}
        onCompress={handleCompress}
        onDelete={handleDelete}
        onSelectAll={selectAll}
        clipboard={clipboard}
        onUnzip={handleExtract}
        files={files}
      />

      <main className="flex-1 overflow-hidden relative">
        {/* Drag & Drop Overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-blue-500/20 border-4 border-dashed border-blue-500 rounded-lg m-2 sm:m-4 flex items-center justify-center z-50">
            <div className="text-center text-blue-600 dark:text-blue-400 px-4">
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-4">📁</div>
              <div className="text-lg sm:text-xl font-semibold">Drop files here</div>
              <div className="text-xs sm:text-sm mt-1 sm:mt-2">Files will be uploaded to: {currentPath || '/'}</div>
            </div>
          </div>
        )}
        
        <div className="h-full p-2 sm:p-4 md:p-6 overflow-auto">
          {searchQuery ? (
            <SearchResults
              query={searchQuery}
              results={searchResults}
              isSearching={isSearching}
              onClearSearch={clearSearch}
              onFileClick={handleFileClick}
              onFileDoubleClick={handleFileDoubleClick}
              onFileContextMenu={handleFileContextMenu}
            />
          ) : (
            <>
              {viewMode === 'grid' ? (
                <FileGrid
                  files={files}
                  selectedFiles={selectedFiles}
                  isLoading={isLoading}
                  onFileClick={handleFileClick}
                  onFileDoubleClick={handleFileDoubleClick}
                  onFileContextMenu={handleFileContextMenu}
                  onUnzip={handleExtract}
                />
              ) : (
                <FileList
                  files={files}
                  selectedFiles={selectedFiles}
                  isLoading={isLoading}
                  onFileClick={handleFileClick}
                  onFileDoubleClick={handleFileDoubleClick}
                  onFileContextMenu={handleFileContextMenu}
                  onUnzip={handleExtract}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer with file count */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-2 sm:py-3">
        <div className="flex justify-between items-center">
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {files.length} item{files.length !== 1 ? 's' : ''}
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showUploadModal && (
        <UploadModal
          currentPath={currentPath}
          onUpload={handleUpload}
          onClose={() => setShowUploadModal(false)}
        />
      )}

      {showPreviewModal && previewData && (
        <PreviewModal
          file={previewData}
          onClose={() => setShowPreviewModal(false)}
          onDownload={() => downloadFile(previewData.path)}
          onSave={async (payload) => {
            const result = await saveFile(payload)
            // Refresh metadata size in modal header after save
            if (result?.size) {
              setPreviewData((prev) => prev ? { ...prev, size: result.size } : prev)
            }
          }}
        />
      )}

      {showConfirmDialog && confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setShowConfirmDialog(false)}
          showInput={confirmAction.showInput}
          inputPlaceholder={confirmAction.inputPlaceholder}
        />
      )}

      {/* Context Menu */}
      {contextMenu.show && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onOpen={() => {
            if (contextMenu.file.type === 'directory') {
              navigateToPath(contextMenu.file.path)
            } else {
              handlePreviewFile(contextMenu.file)
            }
            setContextMenu({ show: false, x: 0, y: 0, file: null })
          }}
          onDownload={() => {
            downloadFile(contextMenu.file.path)
            setContextMenu({ show: false, x: 0, y: 0, file: null })
          }}
          onPreview={() => {
            handlePreviewFile(contextMenu.file)
            setContextMenu({ show: false, x: 0, y: 0, file: null })
          }}
          onRename={(newName) => {
            handleRename(contextMenu.file.path, newName)
            setContextMenu({ show: false, x: 0, y: 0, file: null })
          }}
          onDelete={() => {
            handleDelete([contextMenu.file.path])
            setContextMenu({ show: false, x: 0, y: 0, file: null })
          }}
          onExtract={() => {
            handleExtract(contextMenu.file.path)
            setContextMenu({ show: false, x: 0, y: 0, file: null })
          }}
        />
      )}
    </div>
  )
}

export default FileManager
