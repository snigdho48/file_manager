import React, { useState, useEffect, useRef } from 'react'
import { Download, X } from 'lucide-react'
import BrandLogo from './BrandLogo'

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => {
    // Check if app is already installed
    const isInstalled = () => {
      return window.matchMedia('(display-mode: standalone)').matches || 
             (window.navigator.standalone === true)
    }

    // Check if user has dismissed the prompt
    const wasDismissed = () => {
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10)
        const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)
        return daysSinceDismissed < 7
      }
      return false
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      
      // Clear any pending timeout since we got the event
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      
      // Show prompt if not dismissed
      if (!wasDismissed() && !isInstalled()) {
        setShowPrompt(true)
      }
    }

    // Don't show if already installed or dismissed
    if (isInstalled() || wasDismissed()) {
      return
    }

    // Add event listener
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Check if service worker is active and show prompt after delay if beforeinstallprompt doesn't fire
    const checkAndShowPrompt = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration && registration.active) {
            // Wait 3 seconds for beforeinstallprompt to fire
            timeoutRef.current = setTimeout(() => {
              if (!isInstalled() && !wasDismissed()) {
                setShowPrompt(true)
              }
            }, 3000)
          }
        } catch (error) {
          console.error('[PWA] Error checking service worker:', error)
        }
      }
    }

    checkAndShowPrompt()

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Use the browser's install prompt
      try {
        deferredPrompt.prompt()
        await deferredPrompt.userChoice
        setDeferredPrompt(null)
        setShowPrompt(false)
      } catch (error) {
        console.error('[PWA] Error showing install prompt:', error)
        // Fallback to manual instructions
        showManualInstallInstructions()
      }
    } else {
      // Show manual install instructions
      showManualInstallInstructions()
    }
  }

  const showManualInstallInstructions = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isAndroid = /Android/.test(navigator.userAgent)
    
    let message = 'To install this app:\n\n'
    if (isIOS) {
      message += '1. Tap the Share button\n2. Select "Add to Home Screen"'
    } else if (isAndroid) {
      message += '1. Tap the menu (3 dots)\n2. Select "Install app" or "Add to Home screen"'
    } else {
      message += '1. Click the install icon in your browser\'s address bar\n2. Or use the browser menu to install'
    }
    
    alert(message)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Remember dismissal for 7 days
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  if (!showPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-slide-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <BrandLogo className="w-10 h-10 rounded-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Install Reachableads
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              Install for quick access
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleInstallClick}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 transition-colors duration-200 touch-manipulation"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors duration-200 touch-manipulation"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default InstallPrompt

