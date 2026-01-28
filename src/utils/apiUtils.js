// Utility functions for API URL management

// Get API base URL (same logic as AuthContext)
export const getApiBaseURL = () => {
  if (typeof window !== 'undefined' && window.APP_CONFIG?.API_URL) {
    const apiUrl = window.APP_CONFIG.API_URL.trim()
    if (apiUrl) {
      return apiUrl
    }
  }
  // Development: use localhost, Production: empty (relative)
  return import.meta.env.DEV ? 'http://localhost:3000' : ''
}

// Get thumbnail URL for a file
export const getThumbnailUrl = (filePath, size = 200) => {
  const apiBaseURL = getApiBaseURL()
  return `${apiBaseURL}/api/download?path=${encodeURIComponent(filePath)}&thumbnail=true&size=${size}`
}

// Get preview/download URL for a file
export const getFileUrl = (filePath, preview = false) => {
  const apiBaseURL = getApiBaseURL()
  
  // Use new cleaner /download/file endpoint for downloads (not previews/thumbnails)
  // Note: This endpoint is on the frontend domain, not the API domain
  if (!preview) {
    // Check if we're using a separate API domain
    const isSeparateApiDomain = apiBaseURL && apiBaseURL.includes('api.')
    
    if (isSeparateApiDomain) {
      // If using separate API domain, use frontend domain for /download/file endpoint
      // The /download/file endpoint is configured on frontend nginx
      const frontendDomain = window.location.origin
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')
      return `${frontendDomain}/download/file/${encodedPath}`
    } else {
      // Same domain - use relative URL
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')
      return `/download/file/${encodedPath}`
    }
  }
  
  // For previews/thumbnails, use the original API endpoint
  const params = new URLSearchParams({ path: filePath })
  params.append('preview', 'true')
  return `${apiBaseURL}/api/download?${params.toString()}`
}

