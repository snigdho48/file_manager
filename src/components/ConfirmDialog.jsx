import React, { useRef, useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

const ConfirmDialog = ({ title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", variant = "danger", showInput = false, inputPlaceholder = "" }) => {
  const modalRef = useRef(null)
  const [inputValue, setInputValue] = useState("")

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onCancel()
      }
    }

    const handleEnter = (e) => {
      if (e.key === 'Enter' && showInput && inputValue.trim()) {
        onConfirm(inputValue)
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('keydown', handleEnter)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleEnter)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onCancel, onConfirm, showInput, inputValue])

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: 'text-red-600 dark:text-red-400',
          confirmBtn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
          title: 'text-red-900 dark:text-red-400'
        }
      case 'warning':
        return {
          icon: 'text-yellow-600 dark:text-yellow-400',
          confirmBtn: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
          title: 'text-yellow-900 dark:text-yellow-400'
        }
      default:
        return {
          icon: 'text-primary-600 dark:text-primary-400',
          confirmBtn: 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500',
          title: 'text-primary-900 dark:text-primary-400'
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full bg-red-100 dark:bg-red-900/20 ${styles.icon}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${styles.title}`}>
                {title}
              </h3>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 overflow-y-auto flex-1">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {message}
          </p>
          
          {showInput && (
            <div>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 p-4 sm:p-6 pt-0 border-t border-gray-200 dark:border-gray-700 sm:border-0">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 active:bg-gray-100 dark:active:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 transition-colors duration-200 touch-manipulation"
          >
            {cancelText}
          </button>
          <button
            onClick={() => onConfirm(showInput ? inputValue : undefined)}
            disabled={showInput && !inputValue.trim()}
            className={`w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-transparent rounded-lg text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80 touch-manipulation ${styles.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
