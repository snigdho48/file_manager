// Load environment variables from .env file if it exists
const path = require('path');
const fs = require('fs-extra');
const dotenv = require('dotenv');

// Find and load .env file
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config(); // Try default .env location
}

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const archiver = require('archiver');
const unzipper = require('unzipper');
const mime = require('mime-types');
const compression = require('compression');
const helmet = require('helmet');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - REQUIRED when behind nginx reverse proxy
// This allows Express to correctly identify client IPs from X-Forwarded-For header
app.set('trust proxy', 1); // Trust first proxy (nginx)

// Default credentials (change these in production!)
const DEFAULT_USERNAME = process.env.FM_USERNAME || 'reachable';
const DEFAULT_PASSWORD = process.env.FM_PASSWORD || 'Reachable@2025#';
const SESSION_SECRET = process.env.SESSION_SECRET || 'I_AM_SNIGDHO';

// Rate limiting (trust proxy must be set before rate limiter)
const loginLimiter = rateLimit({
    // windowMs: 24 * 60 * 60 * 1000, // 24 hours
    // max: 5, // Limit each IP to 5 login requests per windowMs
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: true,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

// API rate limiter removed - no restrictions on file operations

// Security and optimization middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "blob:"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'", "blob:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:"],
        }
    }
}));

app.use(compression());

// CORS configuration for cross-domain deployment
// Frontend: creative.reachableads.com
// Backend: api.creative.reachableads.com
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://creative.reachableads.com';
app.use(cors({
    origin: FRONTEND_URL, // Allow requests from frontend domain
    credentials: true, // Allow cookies/credentials
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
    optionsSuccessStatus: 200 // Some legacy browsers
}));

// Session middleware
// Note: Using MemoryStore (default) is fine for single-server deployments.
// For multi-server or high-traffic scenarios, consider using Redis or a database-backed store.
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'filemanager.sid', // Custom session name
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'none', // Required for cross-domain cookies (frontend and backend on different domains)
        domain: '.reachableads.com' // Share cookie across subdomains (creative.reachableads.com and api.creative.reachableads.com)
    }
    // store: MemoryStore (default) - acceptable for single-server deployments
}));

// Body parsing middleware - but not for multipart/form-data (handled by multer)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Authentication middleware
const requireAuth = (req, res, next) => {

    
    if (req.session && req.session.authenticated) {
        return next();
    } else {
        return res.status(401).json({ error: 'Authentication required' });
    }
};

// Serve service worker with correct headers (MUST come before static middleware)
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  const swPath = path.join(__dirname, 'dist', 'sw.js');
  const devPath = path.join(__dirname, 'public', 'sw.js');
  const filePath = fs.existsSync(swPath) ? swPath : (fs.existsSync(devPath) ? devPath : null);
  
  if (filePath && fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    console.error('Service worker file not found at:', swPath, 'or', devPath);
    res.status(404).send('Service worker not found');
  }
});

// Serve manifest with correct headers (MUST come before static middleware)
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
  const manifestPath = path.join(__dirname, 'dist', 'manifest.json');
  const devPath = path.join(__dirname, 'public', 'manifest.json');
  const filePath = fs.existsSync(manifestPath) ? manifestPath : (fs.existsSync(devPath) ? devPath : null);
  
  if (filePath && fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    console.error('Manifest file not found at:', manifestPath, 'or', devPath);
    res.status(404).json({ error: 'Manifest not found' });
  }
});

// Serve static files from dist directory (production build - priority)
// This handles all assets including JS, CSS, images, etc.
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1y', // Cache static assets for 1 year
  etag: true,
  lastModified: true,
  index: false // Don't serve index.html for directory requests
}));

// Serve static files from public directory (for development - includes PWA files)
app.use(express.static('public'));

// File storage directory
const STORAGE_DIR = path.join(__dirname, '..', 'creative');
fs.ensureDirSync(STORAGE_DIR);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use query parameter or default to root
        const uploadPath = req.query.path || '';
        let fullPath = path.join(STORAGE_DIR, uploadPath);
        
        // If file has webkitRelativePath, preserve folder structure
        if (file.originalname && file.originalname.includes('/')) {
            const relativePath = path.dirname(file.originalname);
            fullPath = path.join(STORAGE_DIR, uploadPath, relativePath);
        }
        
        // Only create directory for actual files, not folders (0-byte files)
        if (file.size > 0) {
            fs.ensureDirSync(fullPath);
        }
        
        cb(null, fullPath);
    },
    filename: (req, file, cb) => {
        // Preserve original filename with proper encoding
        let filename = Buffer.from(file.originalname, 'latin1').toString('utf8');
        
        // If file has folder structure, only use the basename
        if (filename.includes('/')) {
            filename = path.basename(filename);
        }
        
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 1024 * 1024 * 1024 // 1GB limit
    },
    fileFilter: (req, file, cb) => {
        // Basic security check - reject executable files
        const dangerousExts = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (dangerousExts.includes(ext)) {
            return cb(new Error('File type not allowed for security reasons'));
        }
        cb(null, true);
    }
});

// Utility functions
const getFileStats = async (filePath) => {
    try {
        const stats = await fs.stat(filePath);
        return {
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile()
        };
    } catch (error) {
        return null;
    }
};

// Set proper permissions for files and directories (so nginx can read them)
const setFilePermissions = async (filePath) => {
    try {
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
            // Directories need 755 (rwxr-xr-x) - executable for traversal
            await fs.chmod(filePath, 0o755);
        } else {
            // Files need 644 (rw-r--r--) - readable by all
            await fs.chmod(filePath, 0o644);
        }
    } catch (err) {
        console.error(`Error setting permissions for ${filePath}:`, err.message);
    }
};

// Recursively set permissions for a directory and all its contents
const setDirectoryPermissions = async (dirPath) => {
    try {
        // Set permission for the directory itself
        await setFilePermissions(dirPath);
        
        // Recursively set permissions for all contents
        const entries = await fs.readdir(dirPath);
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            const stats = await getFileStats(fullPath);
            if (stats) {
                if (stats.isDirectory) {
                    await setDirectoryPermissions(fullPath);
                } else {
                    await setFilePermissions(fullPath);
                }
            }
        }
    } catch (err) {
        console.error(`Error setting directory permissions for ${dirPath}:`, err.message);
    }
};

const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Routes

// Home page - redirect to login if not authenticated
app.get('/', (req, res) => {
    if (req.session && req.session.authenticated) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

// Login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login endpoint
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        // Simple authentication (in production, use a proper user database)
        if (username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD) {
            req.session.authenticated = true;
            req.session.username = username;
            res.json({ success: true, message: 'Login successful' });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Check authentication status
app.get('/api/auth-status', (req, res) => {
    res.json({ 
        authenticated: !!(req.session && req.session.authenticated),
        username: req.session?.username || null
    });
});

// Authentication required for all API routes (no rate limiting for file operations)

// List files and directories
app.get('/api/files', requireAuth, async (req, res) => {
    try {
        const requestedPath = req.query.path || '';
        const fullPath = path.join(STORAGE_DIR, requestedPath);
        
        // Security check - prevent directory traversal
        if (!fullPath.startsWith(STORAGE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const items = [];
        const entries = await fs.readdir(fullPath);

        // Use Promise.all for parallel stat operations (faster)
        const statsPromises = entries.map(async (entry) => {
            const itemPath = path.join(fullPath, entry);
            const stats = await getFileStats(itemPath);
            
            if (stats) {
                return {
                    name: entry,
                    path: path.join(requestedPath, entry).replace(/\\/g, '/'),
                    size: stats.isDirectory ? null : formatFileSize(stats.size),
                    sizeBytes: stats.isDirectory ? 0 : stats.size,
                    modified: stats.modified,
                    type: stats.isDirectory ? 'directory' : 'file',
                    mimeType: stats.isFile ? mime.lookup(entry) || 'application/octet-stream' : null
                };
            }
            return null;
        });

        const itemsWithStats = await Promise.all(statsPromises);
        items.push(...itemsWithStats.filter(item => item !== null));

        // Sort: directories first, then files
        items.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });

        // Set cache headers (short cache for directory listings - they change frequently)
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.json({
            path: requestedPath,
            items: items,
            parentPath: requestedPath ? path.dirname(requestedPath).replace(/\\/g, '/') : null
        });
    } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({ error: 'Failed to read directory' });
    }
});

// Upload files
app.post('/api/upload', requireAuth, upload.array('files'), async (req, res) => {
    try {


        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No valid files to upload' });
        }

        // Process uploaded files and set permissions
        const uploadedFiles = [];
        for (const file of req.files) {
            if (file.size > 0) {
                // Set permissions for the uploaded file
                await setFilePermissions(file.path);
                
                // Ensure parent directories have correct permissions (755 for traversal)
                let currentDir = path.dirname(file.path);
                while (currentDir !== STORAGE_DIR && currentDir.length > STORAGE_DIR.length) {
                    try {
                        await setFilePermissions(currentDir);
                        currentDir = path.dirname(currentDir);
                    } catch (err) {
                        break; // Stop if we can't access parent directory
                    }
                }

                uploadedFiles.push({
                    name: file.filename,
                    size: formatFileSize(file.size),
                    path: path.relative(STORAGE_DIR, file.path).replace(/\\/g, '/')
                });
            }
        }

        if (uploadedFiles.length === 0) {
            return res.status(400).json({ error: 'No valid files to upload' });
        }

        res.json({
            message: 'Files uploaded successfully',
            files: uploadedFiles
        });
    } catch (error) {
        console.error('Upload error:', error);
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large' });
            }
            return res.status(400).json({ error: 'Upload error: ' + error.message });
        }
        res.status(500).json({ error: 'Upload failed: ' + error.message });
    }
});

// Download file
app.get('/api/download', requireAuth, async (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath) {
            return res.status(400).json({ error: 'File path required' });
        }

        const fullPath = path.join(STORAGE_DIR, filePath);
        
        // Security check
        if (!fullPath.startsWith(STORAGE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const stats = await getFileStats(fullPath);
        if (!stats || !stats.isFile) {
            return res.status(404).json({ error: 'File not found' });
        }

        const filename = path.basename(fullPath);
        const mimeType = mime.lookup(filename) || 'application/octet-stream';
        
        // Check if this is a preview request (inline display) or download request
        const isPreview = req.query.preview === 'true';
        const isThumbnail = req.query.thumbnail === 'true';
        
        // Set headers for optimized download or inline preview/thumbnail
        res.setHeader('Content-Disposition', (isPreview || isThumbnail)
            ? `inline; filename="${filename}"` 
            : `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', stats.size);
        
        // Cache headers for better performance
        if (isThumbnail) {
            // Longer cache for thumbnails (30 days)
            res.setHeader('Cache-Control', 'private, max-age=2592000');
        } else {
            // 24 hours for regular files
            res.setHeader('Cache-Control', 'private, max-age=86400');
        }
        res.setHeader('ETag', `"${stats.size}-${stats.modified.getTime()}"`);
        
        // Handle range requests for large files (partial content support)
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
            const chunksize = (end - start) + 1;
            
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stats.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': mimeType,
            });
            
            const fileStream = fs.createReadStream(fullPath, { start, end });
            fileStream.pipe(res);
        } else {
            // Stream the entire file
            const fileStream = fs.createReadStream(fullPath);
            fileStream.pipe(res);
        }
    } catch (error) {
        console.error('Download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed' });
        }
    }
});

// Delete file/directory
app.delete('/api/delete', requireAuth, async (req, res) => {
    try {
        const itemPath = req.body.path;
        if (!itemPath) {
            return res.status(400).json({ error: 'Path required' });
        }

        const fullPath = path.join(STORAGE_DIR, itemPath);
        
        // Security check
        if (!fullPath.startsWith(STORAGE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await fs.remove(fullPath);
        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

// Create directory
app.post('/api/mkdir', requireAuth, async (req, res) => {
    try {
        const { path: dirPath, name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Directory name required' });
        }

        const fullPath = path.join(STORAGE_DIR, dirPath || '', name);
        
        // Security check
        if (!fullPath.startsWith(STORAGE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await fs.ensureDir(fullPath);
        // Set proper permissions for the new directory
        await setFilePermissions(fullPath);
        res.json({ message: 'Directory created successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create directory' });
    }
});

// Rename file/directory
app.put('/api/rename', requireAuth, async (req, res) => {
    try {
        const { oldPath, newName } = req.body;
        if (!oldPath || !newName) {
            return res.status(400).json({ error: 'Old path and new name required' });
        }

        const oldFullPath = path.join(STORAGE_DIR, oldPath);
        const newFullPath = path.join(path.dirname(oldFullPath), newName);
        
        // Security check
        if (!oldFullPath.startsWith(STORAGE_DIR) || !newFullPath.startsWith(STORAGE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await fs.move(oldFullPath, newFullPath);
        res.json({ message: 'Item renamed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Rename failed' });
    }
});

// Search files
app.get('/api/search', requireAuth, async (req, res) => {
    try {
        const query = req.query.q;
        const searchPath = req.query.path || '';
        
        if (!query || query.trim().length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }

        const results = [];
        const searchDir = path.join(STORAGE_DIR, searchPath);
        const maxResults = 100; // Limit results to prevent memory issues
        const queryLower = query.toLowerCase().trim();

        const searchRecursive = async (dir, relativePath = '') => {
            if (results.length >= maxResults) return; // Early exit if limit reached
            
            try {
                const entries = await fs.readdir(dir);
                
                // Process entries in parallel for better performance
                const searchPromises = entries.map(async (entry) => {
                    if (results.length >= maxResults) return;
                    
                    const fullPath = path.join(dir, entry);
                    const itemRelativePath = path.join(relativePath, entry).replace(/\\/g, '/');
                    
                    try {
                        const stats = await getFileStats(fullPath);
                        if (!stats) return;
                        
                        // Check if filename matches (case-insensitive)
                        if (entry.toLowerCase().includes(queryLower)) {
                            if (results.length < maxResults) {
                                results.push({
                                    name: entry,
                                    path: itemRelativePath,
                                    size: stats.isDirectory ? null : formatFileSize(stats.size),
                                    type: stats.isDirectory ? 'directory' : 'file',
                                    mimeType: stats.isFile ? mime.lookup(entry) || 'application/octet-stream' : null
                                });
                            }
                        }

                        // Continue searching in subdirectories
                        if (stats.isDirectory && results.length < maxResults) {
                            await searchRecursive(fullPath, itemRelativePath);
                        }
                    } catch (err) {
                        // Skip files/directories we can't access
                        console.error(`Error processing ${fullPath}:`, err.message);
                    }
                });

                await Promise.all(searchPromises);
            } catch (err) {
                console.error(`Error reading directory ${dir}:`, err.message);
            }
        };

        await searchRecursive(searchDir, searchPath);
        
        res.setHeader('Cache-Control', 'no-cache'); // Don't cache search results
        res.json({ results: results.slice(0, maxResults) });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get file info for preview
app.get('/api/preview', requireAuth, async (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath) {
            return res.status(400).json({ error: 'File path required' });
        }

        const fullPath = path.join(STORAGE_DIR, filePath);
        
        // Security check
        if (!fullPath.startsWith(STORAGE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const stats = await getFileStats(fullPath);
        if (!stats || !stats.isFile) {
            return res.status(404).json({ error: 'File not found' });
        }

        const mimeType = mime.lookup(fullPath) || 'application/octet-stream';
        
        // Limit preview size to 512KB for better memory efficiency (reduced from 1MB)
        const maxPreviewSize = 512 * 1024; // 512KB
        
        // For text files, read content with size limit
        if (mimeType.startsWith('text/') && stats.size <= maxPreviewSize) {
            // Use streaming read for better memory efficiency
            const content = await fs.readFile(fullPath, 'utf8');
            res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache previews for 1 hour
            res.json({
                name: path.basename(fullPath),
                size: formatFileSize(stats.size),
                mimeType,
                content,
                isText: true
            });
        } else {
            res.setHeader('Cache-Control', 'private, max-age=3600');
            res.json({
                name: path.basename(fullPath),
                size: formatFileSize(stats.size),
                mimeType,
                isText: false
            });
        }
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ error: 'Preview failed' });
    }
});

// Copy files
app.post('/api/copy', requireAuth, async (req, res) => {
    try {
        const { files, destination } = req.body;
        if (!files || !Array.isArray(files) || !destination) {
            return res.status(400).json({ error: 'Files array and destination required' });
        }

        const destPath = path.join(STORAGE_DIR, destination);
        
        // Security check
        if (!destPath.startsWith(STORAGE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        fs.ensureDirSync(destPath);
        await setFilePermissions(destPath);

        for (const filePath of files) {
            const sourcePath = path.join(STORAGE_DIR, filePath);
            const fileName = path.basename(filePath);
            const targetPath = path.join(destPath, fileName);

            // Security check
            if (!sourcePath.startsWith(STORAGE_DIR)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            if (fs.existsSync(sourcePath)) {
                const stats = await getFileStats(sourcePath);
                fs.copySync(sourcePath, targetPath);
                // Set permissions for copied file/directory
                if (stats && stats.isDirectory) {
                    await setDirectoryPermissions(targetPath);
                } else {
                    await setFilePermissions(targetPath);
                }
            }
        }

        res.json({ message: 'Files copied successfully' });
    } catch (error) {
        console.error('Copy error:', error);
        res.status(500).json({ error: 'Copy failed: ' + error.message });
    }
});

// Move files
app.post('/api/move', requireAuth, async (req, res) => {
    try {
        const { files, destination } = req.body;
        if (!files || !Array.isArray(files) || !destination) {
            return res.status(400).json({ error: 'Files array and destination required' });
        }

        const destPath = path.join(STORAGE_DIR, destination);
        
        // Security check
        if (!destPath.startsWith(STORAGE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        fs.ensureDirSync(destPath);
        await setFilePermissions(destPath);

        for (const filePath of files) {
            const sourcePath = path.join(STORAGE_DIR, filePath);
            const fileName = path.basename(filePath);
            const targetPath = path.join(destPath, fileName);

            // Security check
            if (!sourcePath.startsWith(STORAGE_DIR)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            if (fs.existsSync(sourcePath)) {
                const stats = await getFileStats(sourcePath);
                fs.moveSync(sourcePath, targetPath);
                // Set permissions for moved file/directory
                if (stats && stats.isDirectory) {
                    await setDirectoryPermissions(targetPath);
                } else {
                    await setFilePermissions(targetPath);
                }
            }
        }

        res.json({ message: 'Files moved successfully' });
    } catch (error) {
        console.error('Move error:', error);
        res.status(500).json({ error: 'Move failed: ' + error.message });
    }
});

// Compress files to ZIP
app.post('/api/compress', requireAuth, async (req, res) => {
    try {
        const { files, zipName, destination } = req.body;
        if (!files || !Array.isArray(files)) {
            return res.status(400).json({ error: 'Files array required' });
        }

        const zipFileName = zipName || 'archive.zip';
        const destPath = destination || '';
        const zipPath = path.join(STORAGE_DIR, destPath, zipFileName);
        
        // Security check
        if (!zipPath.startsWith(STORAGE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const output = fs.createWriteStream(zipPath);
        // Use compression level 6 (balance between speed and size, default is 6)
        const archive = archiver('zip', { 
            zlib: { level: 6 }, // Balanced compression (level 6 instead of 9 for faster processing)
            store: false // Always compress
        });

        // Handle errors
        let hasError = false;
        archive.on('error', (err) => {
            if (!hasError) {
                hasError = true;
                console.error('Archive error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Compress failed: ' + err.message });
                }
            }
        });

        output.on('error', (err) => {
            if (!hasError) {
                hasError = true;
                console.error('Output stream error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Compress failed: ' + err.message });
                }
            }
        });

        output.on('close', () => {
            if (!hasError && !res.headersSent) {
                res.json({ 
                    message: 'Files compressed successfully',
                    zipPath: zipFileName,
                    size: archive.pointer()
                });
            }
        });

        archive.pipe(output);

        for (const filePath of files) {
            if (hasError) break;
            
            const fullPath = path.join(STORAGE_DIR, filePath);
            
            // Security check
            if (!fullPath.startsWith(STORAGE_DIR)) {
                if (!res.headersSent) {
                    return res.status(403).json({ error: 'Access denied' });
                }
                continue;
            }

            try {
                if (fs.existsSync(fullPath)) {
                    const stats = fs.statSync(fullPath);
                    if (stats.isDirectory()) {
                        archive.directory(fullPath, path.basename(filePath));
                    } else {
                        archive.file(fullPath, { name: path.basename(filePath) });
                    }
                }
            } catch (err) {
                console.error(`Error adding ${fullPath} to archive:`, err.message);
            }
        }

        archive.finalize();
    } catch (error) {
        console.error('Compress error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Compress failed: ' + error.message });
        }
    }
});

// Helper function to encode spaces and special characters in URL paths
function encodeUrlPath(urlPath) {
    // Split by /, encode each segment, then join back
    return urlPath.split('/').map(segment => {
        // Skip empty segments
        if (!segment) return segment;
        // Encode spaces and other special characters
        return encodeURIComponent(segment);
    }).join('/');
}

// Helper function to convert relative paths to absolute paths based on HTML file location
// Handles paths at any depth: ./file.png, ./subdir/file.png, ./subdir/subdir2/file.png, ../file.png, etc.
function convertToAbsolutePath(relativePath, htmlFilePath) {
    // Get the directory path relative to STORAGE_DIR
    // This gives us the path from storage root to the HTML file's directory
    // Example: if htmlFilePath is STORAGE_DIR/lyx/1-6-26/index.html
    // relativeDir will be "lyx/1-6-26"
    const htmlDir = path.dirname(htmlFilePath);
    const relativeDir = path.relative(STORAGE_DIR, htmlDir).replace(/\\/g, '/');
    
    // If already absolute (starts with /), return as-is (but normalize)
    if (relativePath.startsWith('/')) {
        return relativePath.replace(/\/+/g, '/');
    }
    
    // Normalize the relative path
    let normalizedPath = relativePath;
    
    // Remove ./ prefix if present
    if (normalizedPath.startsWith('./')) {
        normalizedPath = normalizedPath.substring(2);
    }
    
    // Handle parent directory references (../, ../../, etc.)
    if (normalizedPath.startsWith('../')) {
        // Build the full path from STORAGE_DIR
        // Start from the HTML file's directory
        let currentDir = relativeDir;
        
        // Process each ../ level
        let remainingPath = normalizedPath;
        while (remainingPath.startsWith('../')) {
            // Go up one directory level
            if (currentDir === '' || currentDir === '.') {
                // Can't go above root, stop here
                currentDir = '';
                break;
            }
            currentDir = path.dirname(currentDir).replace(/\\/g, '/');
            // Handle root directory case
            if (currentDir === '.' || currentDir === '') {
                currentDir = '';
            }
            remainingPath = remainingPath.substring(3);
        }
        
        // Build the absolute path
        const absolutePath = currentDir 
            ? `/${currentDir}/${remainingPath}`.replace(/\/+/g, '/')
            : `/${remainingPath}`.replace(/\/+/g, '/');
        return absolutePath;
    }
    
    // Handle relative paths (same directory or subdirectories)
    // Examples: "file.png", "subdir/file.png", "subdir/subdir2/file.png"
    // Convert to absolute path by prepending the HTML file's directory
    if (relativeDir && relativeDir !== '.') {
        const absolutePath = `/${relativeDir}/${normalizedPath}`.replace(/\/+/g, '/');
        return absolutePath;
    } else {
        // HTML file is in root directory
        const absolutePath = `/${normalizedPath}`.replace(/\/+/g, '/');
        return absolutePath;
    }
}

// Helper function to fix HTML files by converting absolute URLs to absolute paths and encoding spaces
async function fixHtmlFiles(directory) {
    try {
        const files = fs.readdirSync(directory, { withFileTypes: true });
        
        for (const file of files) {
            const fullPath = path.join(directory, file.name);
            
            if (file.isDirectory()) {
                // Recursively process subdirectories
                await fixHtmlFiles(fullPath);
            } else if (file.isFile() && (file.name.endsWith('.html') || file.name.endsWith('.htm') || file.name.endsWith('.css'))) {
                // Read HTML/CSS file
                let content = fs.readFileSync(fullPath, 'utf8');
                let modified = false;
                
                // Fix absolute URLs in src, href attributes (only for your domain)
                // Pattern: src="https://creative.reachableads.com/lyx/full_animation/Comp_M_1.png" -> src="/lyx/1-6-26/full%20animation/Comp_M_1.png"
                // Keep external URLs (CDN, etc.) unchanged
                content = content.replace(/(src|href)\s*=\s*["']https?:\/\/([^\/]+)(\/[^"']*)["']/gi, (match, attr, domain, filePath) => {
                    // Only convert URLs from your domain
                    if (domain === 'creative.reachableads.com' || domain === 'www.creative.reachableads.com') {
                        modified = true;
                        // Encode spaces in the path
                        const encodedPath = encodeUrlPath(filePath);
                        return `${attr}="${encodedPath}"`;
                    }
                    return match;
                });
                
                // Fix absolute URLs in CSS url() functions (only for your domain)
                // Pattern: url(https://creative.reachableads.com/path/file.png) -> url(/path/file.png)
                content = content.replace(/url\s*\(\s*["']?https?:\/\/([^\/]+)(\/[^"')]*)["']?\s*\)/gi, (match, domain, filePath) => {
                    // Only convert URLs from your domain
                    if (domain === 'creative.reachableads.com' || domain === 'www.creative.reachableads.com') {
                        modified = true;
                        const encodedPath = encodeUrlPath(filePath);
                        return `url(${encodedPath})`;
                    }
                    return match;
                });
                
                // Fix absolute URLs in JavaScript strings (only for your domain)
                // Pattern: "https://creative.reachableads.com/path/file.png" -> "/path/file.png"
                content = content.replace(/(["'])(https?:\/\/([^\/]+))(\/[^"']*)\1/g, (match, quote, fullDomain, domain, filePath) => {
                    // Only convert URLs from your domain
                    if (domain === 'creative.reachableads.com' || domain === 'www.creative.reachableads.com') {
                        modified = true;
                        const encodedPath = encodeUrlPath(filePath);
                        return `${quote}${encodedPath}${quote}`;
                    }
                    return match;
                });
                
                // Fix relative paths - convert to absolute paths and encode spaces
                // Handles all directory depths: 1 level, 2 levels, 3+ levels, parent references, etc.
                // Examples:
                //   - src="./file.png" -> src="/lyx/1-6-26/file.png"
                //   - src="./subdir/file.png" -> src="/lyx/1-6-26/subdir/file.png"
                //   - src="./subdir/subdir2/file.png" -> src="/lyx/1-6-26/subdir/subdir2/file.png"
                //   - src="./full animation/image.png" -> src="/lyx/1-6-26/full%20animation/image.png"
                //   - src="../file.png" -> src="/lyx/file.png"
                //   - src="../../file.png" -> src="/file.png"
                // Only for HTML files (not CSS, as CSS paths are relative to CSS file location)
                if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
                    content = content.replace(/(src|href)\s*=\s*["']([^"']+)["']/gi, (match, attr, urlPath) => {
                        // Skip if already absolute URL, data URI, or special protocol
                        if (urlPath.startsWith('http://') || urlPath.startsWith('https://') || 
                            urlPath.startsWith('data:') || urlPath.startsWith('mailto:') || 
                            urlPath.startsWith('#') || urlPath.startsWith('javascript:') ||
                            urlPath.startsWith('blob:')) {
                            return match;
                        }
                        
                        // Convert relative paths to absolute paths (handles any depth)
                        const absolutePath = convertToAbsolutePath(urlPath, fullPath);
                        // Encode spaces and special characters
                        const encodedPath = encodeUrlPath(absolutePath);
                        
                        // Modify if path changed (always convert relative to absolute for accessibility)
                        if (encodedPath !== urlPath) {
                            modified = true;
                            return `${attr}="${encodedPath}"`;
                        }
                        return match;
                    });
                }
                
                // Fix paths in CSS url() functions - encode spaces in relative paths
                if (file.name.endsWith('.css')) {
                    content = content.replace(/url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi, (match, urlPath) => {
                        // Skip if already absolute URL or data URI
                        if (urlPath.startsWith('http://') || urlPath.startsWith('https://') || 
                            urlPath.startsWith('data:')) {
                            return match;
                        }
                        
                        // Encode spaces in relative paths
                        if (urlPath.includes(' ')) {
                            modified = true;
                            const encodedPath = encodeUrlPath(urlPath);
                            return `url(${encodedPath})`;
                        }
                        return match;
                    });
                }
                
                if (modified) {
                    fs.writeFileSync(fullPath, content, 'utf8');
                    const fileType = file.name.endsWith('.css') ? 'CSS' : 'HTML';
                    console.log(`Fixed ${fileType} file: ${fullPath}`);
                }
            }
        }
    } catch (error) {
        console.error(`Error fixing HTML files in ${directory}:`, error);
    }
}

// Fix HTML files in a directory (convert absolute URLs to relative paths)
app.post('/api/fix-html', requireAuth, async (req, res) => {
    try {
        const { directory } = req.body;
        if (!directory) {
            return res.status(400).json({ error: 'Directory path required' });
        }

        const fullDirPath = path.join(STORAGE_DIR, directory);
        
        // Security check
        if (!fullDirPath.startsWith(STORAGE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!fs.existsSync(fullDirPath)) {
            return res.status(404).json({ error: 'Directory not found' });
        }

        await fixHtmlFiles(fullDirPath);
        res.json({ message: 'HTML files fixed successfully' });
    } catch (error) {
        console.error('Fix HTML error:', error);
        res.status(500).json({ error: 'Fix HTML failed: ' + error.message });
    }
});

// Extract archive
app.post('/api/extract', requireAuth, async (req, res) => {
    try {
        const { archivePath, destination } = req.body;
        if (!archivePath || !destination) {
            return res.status(400).json({ error: 'Archive path and destination required' });
        }

        const fullArchivePath = path.join(STORAGE_DIR, archivePath);
        const destPath = path.join(STORAGE_DIR, destination);
        
        // Security check
        if (!fullArchivePath.startsWith(STORAGE_DIR) || !destPath.startsWith(STORAGE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!fs.existsSync(fullArchivePath)) {
            return res.status(404).json({ error: 'Archive not found' });
        }

        fs.ensureDirSync(destPath);
        await setFilePermissions(destPath);

        const stream = fs.createReadStream(fullArchivePath);
        const extract = unzipper.Extract({ path: destPath });

        stream.pipe(extract);

        extract.on('close', async () => {
            // Set permissions for all extracted files and directories
            await setDirectoryPermissions(destPath);
            
            // Fix HTML files to convert absolute URLs to relative paths
            try {
                await fixHtmlFiles(destPath);
            } catch (fixError) {
                console.error('Error fixing HTML files:', fixError);
                // Don't fail the extraction if HTML fixing fails
            }
            
            res.json({ message: 'Archive extracted successfully' });
        });

        extract.on('error', (err) => {
            console.error('Extract error:', err);
            res.status(500).json({ error: 'Extract failed: ' + err.message });
        });
    } catch (error) {
        console.error('Extract error:', error);
        res.status(500).json({ error: 'Extract failed: ' + error.message });
    }
});

// Serve static files from storage directory (for direct HTML preview and assets)
// This allows accessing files like /apex/index.html directly
// MUST be before the catch-all route but after API routes
app.get('*', async (req, res, next) => {
  // Skip API routes, login, service worker, manifest, and root
  // Note: express.static middleware for dist/public runs first and will serve those files
  // This route only handles files that don't exist in dist/public
  if (req.path.startsWith('/api/') || 
      req.path === '/login' || 
      req.path === '/sw.js' || 
      req.path === '/manifest.json' ||
      req.path === '/') {
    return next(); // Let other routes handle these
  }

  try {
    // Remove leading slash and decode the path
    let requestedPath = decodeURIComponent(req.path).replace(/^\//, '');
    
    // Security: Prevent directory traversal
    if (requestedPath.includes('..') || requestedPath.includes('\\')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const fullPath = path.join(STORAGE_DIR, requestedPath);
    
    // Security check - ensure path is within STORAGE_DIR
    if (!fullPath.startsWith(STORAGE_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = await getFileStats(fullPath);
    
    if (!stats) {
      return next(); // File not found, let catch-all handle it
    }

    if (stats.isDirectory) {
      // If it's a directory, try to serve index.html
      const indexPath = path.join(fullPath, 'index.html');
      const indexStats = await getFileStats(indexPath);
      
      if (indexStats && indexStats.isFile) {
        // Serve index.html from the directory
        const mimeType = mime.lookup('index.html') || 'text/html';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        
        const fileStream = fs.createReadStream(indexPath);
        fileStream.pipe(res);
        return;
      } else {
        // Directory without index.html - return 404 or list files
        return next();
      }
    }

    if (stats.isFile) {
      // Serve the file
      const filename = path.basename(fullPath);
      const mimeType = mime.lookup(filename) || 'application/octet-stream';
      
      // Set appropriate headers
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stats.size);
      
      // Cache headers for static assets
      if (mimeType.startsWith('text/html')) {
        // HTML files - shorter cache, allow revalidation
        res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes
      } else if (mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
        // Media files - longer cache
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      } else if (mimeType.includes('css') || mimeType.includes('javascript') || mimeType.includes('json')) {
        // CSS/JS files - medium cache
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
      } else {
        // Other files
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
      }
      
      // Handle range requests for large files
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = (end - start) + 1;
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': mimeType,
        });
        
        const fileStream = fs.createReadStream(fullPath, { start, end });
        fileStream.pipe(res);
      } else {
        // Stream the entire file
        const fileStream = fs.createReadStream(fullPath);
        fileStream.pipe(res);
      }
      return;
    }

    // If we get here, something unexpected happened
    return next();
  } catch (error) {
    console.error('Static file serve error:', error);
    return next(); // Let catch-all handle errors
  }
});

// Final catch-all route - handles requests that don't match any other route
// This runs after the storage file serving route (which calls next() if file not found)
app.get('*', (req, res) => {
  // If this is a file request (has extension), return 404
  // Otherwise, redirect to frontend for React app routes
  const hasExtension = /\.[^/]+$/.test(req.path);
  
  if (hasExtension) {
    // File not found - return 404
    res.status(404).json({ error: 'File not found' });
  } else {
    // Likely a React app route - redirect to frontend
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
      res.redirect(302, 'https://creative.reachableads.com');
    } else {
      res.status(404).send('Please go to https://creative.reachableads.com to access the file manager');
    }
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File too large' });
        }
    }
    res.status(500).json({ error: error.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Reachable File Manager server running on http://localhost:${PORT}`);
    console.log(`📁 Storage directory: ${STORAGE_DIR}`);
    
    // Print .env file path
    const envFilePath = path.join(__dirname, '.env');
    if (fs.existsSync(envFilePath)) {
        console.log(`📝 Environment file: ${envFilePath}`);
    } else {
        console.log(`⚠️  Environment file not found at: ${envFilePath}`);
        console.log(`   Using process environment variables`);
    }
});
