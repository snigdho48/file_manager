import React, { useState, useEffect, useRef } from 'react'
import { getApiBaseURL } from '../utils/apiUtils'
import axios from 'axios'

const FileThumbnail = ({ file, size = 160, className = '', fallback }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState(null)
  const [error, setError] = useState(false)
  const [imageError, setImageError] = useState(false)
  const objectUrlRef = useRef(null)

  useEffect(() => {
    if (!file) return

    // Reset error states when file changes
    setError(false)
    setImageError(false)
    setThumbnailUrl(null)

    const loadThumbnail = async () => {
      try {
        // Fetch thumbnail via axios (includes credentials/cookies)
        const apiBaseURL = getApiBaseURL()
        const url = `${apiBaseURL}/api/download?path=${encodeURIComponent(file.path)}&thumbnail=true&size=${size}`
        
        const response = await axios.get(url, {
          responseType: 'blob',
          withCredentials: true, // Required for cross-domain cookies
          timeout: 10000 // 10 second timeout
        })

        // Check if the response is actually an image/video or if it's an error (HTML/JSON)
        const blobType = response.data.type || ''
        
        // If we got HTML or JSON, it's likely an error page
        if (blobType.includes('text/html') || blobType.includes('application/json')) {
          const text = await response.data.text()
          if (text.includes('<!DOCTYPE html>') || text.includes('<html') || text.includes('error') || text.includes('Error')) {
            throw new Error('Thumbnail generation failed - received error page')
          }
        }

        // Create object URL from blob
        const objectUrl = URL.createObjectURL(response.data)
        objectUrlRef.current = objectUrl
        setThumbnailUrl(objectUrl)
        setError(false)
      } catch (err) {
        console.error('Thumbnail load error:', err)
        setError(true)
        setThumbnailUrl(null)
      }
    }

    loadThumbnail()

    // Cleanup object URL on unmount
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [file?.path, size])

  // Handle image load errors (e.g., corrupted image, invalid format)
  const handleImageError = () => {
    console.warn('Thumbnail image failed to load:', file?.name)
    setImageError(true)
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setThumbnailUrl(null)
  }

  // Show fallback if there's an error, no thumbnail URL, or image failed to load
  if (error || !thumbnailUrl || imageError) {
    return fallback || null
  }

  return (
    <img
      src={thumbnailUrl}
      alt={file?.name || ''}
      className={className}
      onError={handleImageError}
      loading="lazy"
    />
  )
}

export default FileThumbnail

