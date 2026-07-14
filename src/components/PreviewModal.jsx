import React, { useRef, useEffect, useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import {
  X, Download, FileText, Image, File, Save, Loader2,
  Bold, Italic, Underline, Heading2, List, Archive, Film, Music, FileSpreadsheet
} from 'lucide-react'
import { getApiBaseURL } from '../utils/apiUtils'
import { useTheme } from '../context/ThemeContext'
import axios from 'axios'
import toast from 'react-hot-toast'

const PreviewModal = ({ file, onClose, onDownload, onSave }) => {
  const modalRef = useRef(null)
  const wordEditorRef = useRef(null)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const savingRef = useRef(false)

  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewError, setPreviewError] = useState(false)
  const [loadingMedia, setLoadingMedia] = useState(false)
  const objectUrlRef = useRef(null)

  const [textContent, setTextContent] = useState(file?.content || '')
  const [sheets, setSheets] = useState(() =>
    file?.sheets ? JSON.parse(JSON.stringify(file.sheets)) : []
  )
  const [activeSheet, setActiveSheet] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirtyRef = useRef(false)
  const textRef = useRef(textContent)
  const sheetsRef = useRef(sheets)

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])
  useEffect(() => {
    textRef.current = textContent
  }, [textContent])
  useEffect(() => {
    sheetsRef.current = sheets
  }, [sheets])

  useEffect(() => {
    setTextContent(file?.content || '')
    setSheets(file?.sheets ? JSON.parse(JSON.stringify(file.sheets)) : [])
    setActiveSheet(0)
    setDirty(false)
  }, [file?.path])

  // Word editor HTML seed when opening a docx
  useEffect(() => {
    if ((file?.kind === 'docx' || file?.editType === 'docx') && wordEditorRef.current) {
      wordEditorRef.current.innerHTML = file.html || ''
    }
  }, [file?.path, file?.kind, file?.editType, file?.html])

  useEffect(() => {
    if (!file) return
    const kind = file.kind || ''
    const needsBlob = ['image', 'video', 'audio', 'pdf'].includes(kind)

    if (!needsBlob) {
      return () => {
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current)
          objectUrlRef.current = null
        }
      }
    }

    let cancelled = false
    const load = async () => {
      setLoadingMedia(true)
      setPreviewError(false)
      try {
        const apiBaseURL = getApiBaseURL()
        const url = `${apiBaseURL}/api/download?path=${encodeURIComponent(file.path)}&preview=true`
        const response = await axios.get(url, {
          responseType: 'blob',
          withCredentials: true
        })
        if (cancelled) return
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        const objectUrl = URL.createObjectURL(response.data)
        objectUrlRef.current = objectUrl
        setPreviewUrl(objectUrl)
      } catch (err) {
        console.error('Preview load error:', err)
        if (!cancelled) {
          setPreviewError(true)
          setPreviewUrl(null)
        }
      } finally {
        if (!cancelled) setLoadingMedia(false)
      }
    }
    load()

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      setPreviewUrl(null)
    }
  }, [file?.path, file?.kind])

  const handleSave = useCallback(async () => {
    if (!file?.editable || !onSave || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      const editType = file.editType || 'text'
      const payload = { path: file.path, editType }

      if (editType === 'text') {
        payload.content = textRef.current
      } else if (editType === 'docx') {
        payload.html = wordEditorRef.current?.innerHTML || ''
      } else if (editType === 'xlsx') {
        payload.sheets = sheetsRef.current
      }

      await onSave(payload)
      setDirty(false)
      toast.success('Saved')
    } catch {
      // hook shows error toast
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [file, onSave])

  const requestClose = useCallback(() => {
    if (dirtyRef.current) {
      if (!window.confirm('You have unsaved changes. Close without saving?')) return
    }
    onClose()
  }, [onClose])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') requestClose()
    }
    const handleShortcut = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirtyRef.current && file?.editable) handleSave()
      }
    }
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('keydown', handleShortcut)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleShortcut)
    }
  }, [requestClose, handleSave, file?.editable])

  const applyWordCommand = (command, value = null) => {
    document.execCommand(command, false, value)
    setDirty(true)
  }

  const updateCell = (rowIndex, colIndex, value) => {
    setSheets((prev) => {
      const next = prev.map((s, i) => {
        if (i !== activeSheet) return s
        const data = s.data.map((row) => [...row])
        while (data.length <= rowIndex) data.push([])
        const row = [...data[rowIndex]]
        while (row.length <= colIndex) row.push('')
        row[colIndex] = value
        data[rowIndex] = row
        return { ...s, data }
      })
      return next
    })
    setDirty(true)
  }

  const addExcelRow = () => {
    setSheets((prev) => {
      const next = [...prev]
      const sheet = { ...next[activeSheet] }
      const cols = Math.max(1, ...sheet.data.map((r) => r.length), 1)
      sheet.data = [...sheet.data, Array(cols).fill('')]
      next[activeSheet] = sheet
      return next
    })
    setDirty(true)
  }

  const addExcelCol = () => {
    setSheets((prev) => {
      const next = [...prev]
      const sheet = { ...next[activeSheet] }
      sheet.data = (sheet.data.length ? sheet.data : [['']]).map((row) => [...row, ''])
      next[activeSheet] = sheet
      return next
    })
    setDirty(true)
  }

  const renderMediaLoading = (label) => (
    <div className="text-center py-16 text-gray-500 dark:text-gray-400">
      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
      Loading {label}…
    </div>
  )

  const renderPreviewContent = () => {
    const kind = file.kind || (file.isText ? 'text' : 'binary')
    const mimeType = file.mimeType || ''

    if (file.error) {
      return (
        <div className="text-center py-12">
          <File className="w-14 h-14 text-red-400 mx-auto mb-3" />
          <p className="text-red-600 dark:text-red-400">{file.error}</p>
        </div>
      )
    }

    if (file.tooLarge) {
      return (
        <div className="text-center py-12">
          <File className="w-14 h-14 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-300 mb-4">{file.message || 'File too large to preview'}</p>
          <button onClick={onDownload} className="inline-flex items-center px-4 py-2 rounded-lg text-white bg-primary-600 hover:bg-primary-700">
            <Download className="w-4 h-4 mr-2" /> Download
          </button>
        </div>
      )
    }

    if (kind === 'text' || file.editType === 'text') {
      return (
        <div className="h-[min(70vh,640px)] border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <Editor
            height="100%"
            language={file.language || 'plaintext'}
            theme={isDark ? 'vs-dark' : 'light'}
            value={textContent}
            onChange={(value) => {
              setTextContent(value ?? '')
              setDirty(true)
            }}
            options={{
              fontSize: 14,
              fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace",
              fontLigatures: true,
              minimap: { enabled: true },
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              tabSize: 2,
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              padding: { top: 12 }
            }}
          />
        </div>
      )
    }

    if (kind === 'docx' || file.editType === 'docx') {
      return (
        <div className="flex flex-col h-[min(70vh,640px)] border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
            <button type="button" title="Bold" onClick={() => applyWordCommand('bold')} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"><Bold className="w-4 h-4" /></button>
            <button type="button" title="Italic" onClick={() => applyWordCommand('italic')} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"><Italic className="w-4 h-4" /></button>
            <button type="button" title="Underline" onClick={() => applyWordCommand('underline')} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"><Underline className="w-4 h-4" /></button>
            <button type="button" title="Heading" onClick={() => applyWordCommand('formatBlock', 'h2')} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"><Heading2 className="w-4 h-4" /></button>
            <button type="button" title="List" onClick={() => applyWordCommand('insertUnorderedList')} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"><List className="w-4 h-4" /></button>
            <span className="ml-2 text-xs text-gray-500">Word (.docx) — edit then Save</span>
          </div>
          <div
            ref={wordEditorRef}
            contentEditable
            suppressContentEditableWarning
            className="flex-1 overflow-auto p-6 prose dark:prose-invert max-w-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none"
            onInput={() => setDirty(true)}
          />
        </div>
      )
    }

    if (kind === 'xlsx' || file.editType === 'xlsx') {
      const sheet = sheets[activeSheet] || { name: 'Sheet1', data: [['']] }
      const data = sheet.data?.length ? sheet.data : [['']]
      const colCount = Math.max(1, ...data.map((r) => r.length || 0), 1)

      return (
        <div className="flex flex-col h-[min(70vh,640px)] border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 overflow-x-auto">
            {sheets.map((s, i) => (
              <button
                key={s.name + i}
                type="button"
                onClick={() => setActiveSheet(i)}
                className={`px-3 py-1 text-sm rounded ${i === activeSheet ? 'bg-white dark:bg-gray-800 font-medium border border-gray-200 dark:border-gray-600' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
              >
                {s.name}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={addExcelRow} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">+ Row</button>
              <button type="button" onClick={addExcelCol} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">+ Col</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="border-collapse min-w-full text-sm font-mono">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-20 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 w-10 p-1" />
                  {Array.from({ length: colCount }, (_, c) => (
                    <th key={c} className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 text-xs text-gray-500 font-normal min-w-[100px]">
                      {c < 26 ? String.fromCharCode(65 + c) : `C${c + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, r) => (
                  <tr key={r}>
                    <td className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 text-xs text-gray-500 text-center">{r + 1}</td>
                    {Array.from({ length: colCount }, (_, c) => (
                      <td key={c} className="border border-gray-200 dark:border-gray-600 p-0">
                        <input
                          className="w-full min-w-[100px] px-2 py-1 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:bg-primary-50 dark:focus:bg-primary-900/30"
                          value={row[c] ?? ''}
                          onChange={(e) => updateCell(r, c, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (kind === 'image' || mimeType.startsWith('image/')) {
      if (loadingMedia) return renderMediaLoading('image')
      if (previewError || !previewUrl) {
        return (
          <div className="text-center py-8">
            <Image className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Failed to load image preview</p>
          </div>
        )
      }
      return (
        <div className="flex justify-center bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
          <img src={previewUrl} alt={file.name} className="max-w-full max-h-[70vh] rounded-lg shadow-lg object-contain" onError={() => setPreviewError(true)} />
        </div>
      )
    }

    if (kind === 'video' || mimeType.startsWith('video/')) {
      if (loadingMedia) return renderMediaLoading('video')
      if (previewError || !previewUrl) {
        return (
          <div className="text-center py-8">
            <Film className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Failed to load video preview</p>
          </div>
        )
      }
      return (
        <div className="flex justify-center">
          <video controls className="max-w-full max-h-[70vh] rounded-lg shadow-lg" onError={() => setPreviewError(true)}>
            <source src={previewUrl} type={mimeType} />
          </video>
        </div>
      )
    }

    if (kind === 'audio' || mimeType.startsWith('audio/')) {
      if (loadingMedia) return renderMediaLoading('audio')
      if (previewError || !previewUrl) {
        return (
          <div className="text-center py-8">
            <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Failed to load audio preview</p>
          </div>
        )
      }
      return (
        <div className="flex flex-col items-center py-12 gap-4">
          <Music className="w-16 h-16 text-primary-500" />
          <audio controls className="w-full max-w-md" onError={() => setPreviewError(true)}>
            <source src={previewUrl} type={mimeType} />
          </audio>
        </div>
      )
    }

    if (kind === 'pdf') {
      if (loadingMedia) return renderMediaLoading('PDF')
      if (previewError || !previewUrl) {
        return (
          <div className="text-center py-8">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Failed to load PDF preview</p>
            <button onClick={onDownload} className="inline-flex items-center px-4 py-2 rounded-lg text-white bg-primary-600 hover:bg-primary-700">
              <Download className="w-4 h-4 mr-2" /> Download
            </button>
          </div>
        )
      }
      return (
        <iframe title={file.name} src={previewUrl} className="w-full h-[min(70vh,640px)] rounded-lg border border-gray-200 dark:border-gray-600 bg-white" />
      )
    }

    const Icon = kind === 'archive' ? Archive : File
    return (
      <div className="text-center py-8">
        <Icon className="w-14 h-14 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {kind === 'archive' ? 'Archive file' : kind === 'unsupported-office' ? 'Legacy Office format' : 'Binary file'}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-2 max-w-md mx-auto text-sm">
          {kind === 'archive'
            ? 'Archives cannot be previewed inline. Download or extract from the file manager.'
            : kind === 'unsupported-office'
              ? 'Old .doc files are not supported. Convert to .docx, or download the file.'
              : 'Binary format — hex dump below when available, or download the file.'}
        </p>
        <p className="text-xs text-gray-400 mb-4 font-mono">{file.name} · {file.size} · {mimeType}</p>
        {file.hexPreview && (
          <pre className="text-left text-xs font-mono bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-80 mb-4 mx-auto max-w-3xl">
            {file.hexPreview}
          </pre>
        )}
        <button
          onClick={onDownload}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200"
        >
          <Download className="w-4 h-4 mr-2" />
          Download File
        </button>
      </div>
    )
  }

  const getFileIcon = () => {
    const kind = file.kind || ''
    if (kind === 'text' || file.isText) return <FileText className="w-6 h-6 text-blue-500" />
    if (kind === 'image') return <Image className="w-6 h-6 text-green-500" />
    if (kind === 'xlsx' || kind === 'docx') return <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
    if (kind === 'pdf') return <FileText className="w-6 h-6 text-red-500" />
    return <File className="w-6 h-6 text-gray-500" />
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose() }}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] sm:max-h-[92vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 gap-2">
          <div className="flex items-center space-x-3 min-w-0">
            {getFileIcon()}
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate flex items-center gap-2">
                {file.name}
                {dirty && <span className="text-xs font-normal text-amber-600 dark:text-amber-400">● Unsaved</span>}
              </h2>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-0.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">{file.size}</span>
                {file.language && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-mono">
                    {file.language}
                  </span>
                )}
                {file.editable && (
                  <span className="text-xs text-green-600 dark:text-green-400">Editable · Ctrl+S to save</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {file.editable && (
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Save (Ctrl+S)"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                Save
              </button>
            )}
            <button
              onClick={onDownload}
              className="inline-flex items-center p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </button>
            <button onClick={requestClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-4">
          {renderPreviewContent()}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-3 sm:px-4 py-2 bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 flex justify-between gap-2">
          <span className="truncate font-mono">{file.path || file.name}</span>
          <span className="flex-shrink-0">{file.mimeType}</span>
        </div>
      </div>
    </div>
  )
}

export default PreviewModal
