import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'

// Plugin to copy service worker and manifest to dist
const copyPWAFiles = () => {
  return {
    name: 'copy-pwa-files',
    writeBundle() {
      const files = ['sw.js', 'manifest.json', 'icon.png', 'logo.png', 'logo.svg', 'icon.svg', 'favicon.ico', 'config.js']
      files.forEach(file => {
        const src = join(__dirname, 'public', file)
        const dest = join(__dirname, 'dist', file)
        if (existsSync(src)) {
          copyFileSync(src, dest)
        }
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  // Dev server proxy configuration
  // VITE_API_PROXY_URL: API URL for Vite dev server proxy (development only)
  // Production: Frontend uses config.js (public/config.js → dist/config.js) for API URL
  // This allows runtime configuration without rebuilding
  const proxyApiUrl = process.env.VITE_API_PROXY_URL || 'http://localhost:3000'
  const devPort = parseInt(process.env.VITE_DEV_PORT || '5500', 10)

  return {
    plugins: [react(), copyPWAFiles()],
  server: {
      port: devPort,
    proxy: {
        '/api': {
          target: proxyApiUrl,
          changeOrigin: true,
          secure: false,
          ws: true, // Enable websocket proxying
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.error('[Vite] Proxy error:', err);
            });
          }
        }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          utils: ['axios', 'lucide-react']
        }
      }
    }
    },
    publicDir: 'public'
  }
})
