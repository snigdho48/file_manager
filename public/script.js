// Fast File Manager - Frontend JavaScript
class FileManager {
    constructor() {
        this.currentPath = '';
        this.selectedItems = new Set();
        this.isGridView = true;
        this.searchTimeout = null;
        this.isUploading = false;

        this.init();
    }

    init() {
        this.initializeElements();
        this.attachEventListeners();
        this.checkAuthentication();
        this.setupDragAndDrop();
    }

    async checkAuthentication() {
        try {
            const response = await fetch('/api/auth-status');
            const data = await response.json();
            
            if (!data.authenticated) {
                window.location.href = '/login';
                return;
            }
            
            // Add logout functionality
            this.addLogoutButton(data.username);
            this.loadFiles();
        } catch (error) {
            window.location.href = '/login';
        }
    }

    addLogoutButton(username) {
        const headerRight = document.querySelector('.header-right');
        
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.style.cssText = 'display: flex; align-items: center; gap: 0.75rem; margin-right: 1rem;';
        
        userInfo.innerHTML = `
            <span style="color: var(--text-secondary); font-size: 0.875rem;">
                <i class="fas fa-user"></i> ${username}
            </span>
            <button id="logoutBtn" class="btn btn-secondary" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;">
                <i class="fas fa-sign-out-alt"></i>
                Logout
            </button>
        `;
        
        headerRight.insertBefore(userInfo, headerRight.firstChild);
        
        // Add logout handler
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    }

    async logout() {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            });
            
            if (response.ok) {
                window.location.href = '/login';
            }
        } catch (error) {
            this.showNotification('Logout Error', 'Failed to logout', 'error');
        }
    }

    initializeElements() {
        // Main elements
        this.fileContainer = document.getElementById('fileContainer');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.emptyState = document.getElementById('emptyState');
        this.breadcrumbPath = document.getElementById('breadcrumbPath');
        this.searchInput = document.getElementById('searchInput');
        this.searchResults = document.getElementById('searchResults');
        this.searchContainer = document.getElementById('searchContainer');
        this.itemCount = document.getElementById('itemCount');
        this.selectedInfo = document.getElementById('selectedInfo');

        // Buttons
        this.uploadBtn = document.getElementById('uploadBtn');
        this.newFolderBtn = document.getElementById('newFolderBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.homeBtn = document.getElementById('homeBtn');
        this.gridViewBtn = document.getElementById('gridViewBtn');
        this.listViewBtn = document.getElementById('listViewBtn');
        this.clearSearchBtn = document.getElementById('clearSearchBtn');
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

        // Modals
        this.uploadModal = document.getElementById('uploadModal');
        this.previewModal = document.getElementById('previewModal');
        this.confirmDialog = document.getElementById('confirmDialog');
        this.contextMenu = document.getElementById('contextMenu');

        // Notification container
        this.notificationContainer = document.getElementById('notificationContainer');
    }

    attachEventListeners() {
        // Navigation
        this.homeBtn.addEventListener('click', () => this.navigateToPath(''));
        this.refreshBtn.addEventListener('click', () => this.loadFiles());

        // View toggle
        this.gridViewBtn.addEventListener('click', () => this.toggleView('grid'));
        this.listViewBtn.addEventListener('click', () => this.toggleView('list'));

        // Search
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.clearSearchBtn.addEventListener('click', () => this.clearSearch());

        // File operations
        this.uploadBtn.addEventListener('click', () => this.showUploadModal());
        this.newFolderBtn.addEventListener('click', () => this.createNewFolder());
        this.selectAllBtn.addEventListener('click', () => this.selectAll());
        this.deleteSelectedBtn.addEventListener('click', () => this.deleteSelected());

        // Modal events
        this.setupModalEvents();

        // Context menu
        document.addEventListener('click', () => this.hideContextMenu());
        document.addEventListener('contextmenu', (e) => this.handleContextMenu(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    setupModalEvents() {
        // Upload modal
        document.getElementById('closeUploadModal').addEventListener('click', () => this.hideUploadModal());
        document.getElementById('browseFilesBtn').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelect(e));

        // Preview modal
        document.getElementById('closePreviewModal').addEventListener('click', () => this.hidePreviewModal());
        document.getElementById('downloadPreviewBtn').addEventListener('click', () => this.downloadCurrentPreview());

        // Confirm dialog
        document.getElementById('confirmCancel').addEventListener('click', () => this.hideConfirmDialog());
        document.getElementById('confirmOk').addEventListener('click', () => this.executeConfirmAction());

        // Context menu actions
        document.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', (e) => this.handleContextAction(e.target.dataset.action));
        });
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            
            this.fileContainer.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'));
            this.fileContainer.addEventListener(eventName, () => this.fileContainer.classList.add('dragover'));
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'));
            this.fileContainer.addEventListener(eventName, () => this.fileContainer.classList.remove('dragover'));
        });

        uploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));
        this.fileContainer.addEventListener('drop', (e) => this.handleFileDrop(e));
    }

    async loadFiles(path = this.currentPath) {
        try {
            this.showLoading();
            const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
            
            if (!response.ok) {
                throw new Error('Failed to load files');
            }

            const data = await response.json();
            this.currentPath = data.path;
            this.updateBreadcrumb(data.path, data.parentPath);
            this.renderFiles(data.items);
            this.updateItemCount(data.items.length);
            this.selectedItems.clear();
            this.updateSelectionUI();

        } catch (error) {
            this.showNotification('Error loading files', error.message, 'error');
            this.hideLoading();
        }
    }

    showLoading() {
        this.loadingIndicator.style.display = 'flex';
        this.emptyState.style.display = 'none';
        this.fileContainer.innerHTML = '';
        this.fileContainer.appendChild(this.loadingIndicator);
    }

    hideLoading() {
        this.loadingIndicator.style.display = 'none';
    }

    renderFiles(files) {
        this.hideLoading();
        
        if (files.length === 0) {
            this.emptyState.style.display = 'block';
            this.fileContainer.innerHTML = '';
            this.fileContainer.appendChild(this.emptyState);
            return;
        }

        this.emptyState.style.display = 'none';
        this.fileContainer.innerHTML = '';

        files.forEach(file => {
            const fileElement = this.createFileElement(file);
            this.fileContainer.appendChild(fileElement);
        });
    }

    createFileElement(file) {
        const element = document.createElement('div');
        element.className = `file-item ${this.isGridView ? 'grid-view' : 'list-view'}`;
        element.dataset.path = file.path;
        element.dataset.type = file.type;
        element.dataset.name = file.name;

        const icon = this.getFileIcon(file);
        const formattedDate = new Date(file.modified).toLocaleDateString();

        element.innerHTML = `
            <div class="file-icon">${icon}</div>
            <div class="file-info">
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-meta">
                    <span>${file.type === 'directory' ? 'Folder' : file.size}</span>
                    <span>${formattedDate}</span>
                </div>
            </div>
        `;

        // Add event listeners
        element.addEventListener('click', (e) => this.handleFileClick(e, file));
        element.addEventListener('dblclick', (e) => this.handleFileDoubleClick(e, file));
        element.addEventListener('contextmenu', (e) => this.handleFileContextMenu(e, file));

        return element;
    }

    getFileIcon(file) {
        if (file.type === 'directory') {
            return '<i class="fas fa-folder"></i>';
        }

        const ext = file.name.split('.').pop().toLowerCase();
        const mimeType = file.mimeType || '';

        // Image files
        if (mimeType.startsWith('image/')) {
            return '<i class="fas fa-file-image"></i>';
        }

        // Video files
        if (mimeType.startsWith('video/')) {
            return '<i class="fas fa-file-video"></i>';
        }

        // Audio files
        if (mimeType.startsWith('audio/')) {
            return '<i class="fas fa-file-audio"></i>';
        }

        // Document files
        const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
        if (docExts.includes(ext)) {
            return '<i class="fas fa-file-alt"></i>';
        }

        // Spreadsheet files
        const spreadsheetExts = ['xls', 'xlsx', 'csv'];
        if (spreadsheetExts.includes(ext)) {
            return '<i class="fas fa-file-excel"></i>';
        }

        // Archive files
        const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];
        if (archiveExts.includes(ext)) {
            return '<i class="fas fa-file-archive"></i>';
        }

        // Code files
        const codeExts = ['js', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php', 'json', 'xml'];
        if (codeExts.includes(ext)) {
            return '<i class="fas fa-file-code"></i>';
        }

        return '<i class="fas fa-file"></i>';
    }

    handleFileClick(e, file) {
        if (e.ctrlKey || e.metaKey) {
            this.toggleSelection(file.path);
        } else {
            this.clearSelection();
            this.toggleSelection(file.path);
        }
        this.updateSelectionUI();
    }

    handleFileDoubleClick(e, file) {
        e.preventDefault();
        if (file.type === 'directory') {
            this.navigateToPath(file.path);
        } else {
            this.previewFile(file);
        }
    }

    handleFileContextMenu(e, file) {
        e.preventDefault();
        this.showContextMenu(e, file);
    }

    toggleSelection(path) {
        if (this.selectedItems.has(path)) {
            this.selectedItems.delete(path);
        } else {
            this.selectedItems.add(path);
        }

        // Update visual selection
        const element = document.querySelector(`[data-path="${path}"]`);
        if (element) {
            element.classList.toggle('selected', this.selectedItems.has(path));
        }
    }

    clearSelection() {
        this.selectedItems.clear();
        document.querySelectorAll('.file-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
    }

    selectAll() {
        document.querySelectorAll('.file-item').forEach(item => {
            const path = item.dataset.path;
            this.selectedItems.add(path);
            item.classList.add('selected');
        });
        this.updateSelectionUI();
    }

    updateSelectionUI() {
        const count = this.selectedItems.size;
        
        if (count > 0) {
            this.selectedInfo.textContent = `${count} selected`;
            this.selectedInfo.style.display = 'inline';
            this.selectAllBtn.style.display = 'inline-flex';
            this.deleteSelectedBtn.style.display = 'inline-flex';
        } else {
            this.selectedInfo.style.display = 'none';
            this.selectAllBtn.style.display = 'none';
            this.deleteSelectedBtn.style.display = 'none';
        }
    }

    navigateToPath(path) {
        this.currentPath = path;
        this.loadFiles(path);
        this.clearSelection();
    }

    updateBreadcrumb(path, parentPath) {
        this.breadcrumbPath.innerHTML = '';
        
        if (!path) return;

        const parts = path.split('/').filter(part => part);
        let currentPath = '';

        parts.forEach((part, index) => {
            currentPath += (index > 0 ? '/' : '') + part;
            
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '/';
            this.breadcrumbPath.appendChild(separator);

            const button = document.createElement('button');
            button.className = 'breadcrumb-item';
            button.textContent = part;
            button.addEventListener('click', () => this.navigateToPath(currentPath));
            this.breadcrumbPath.appendChild(button);
        });
    }

    toggleView(view) {
        this.isGridView = view === 'grid';
        
        this.gridViewBtn.classList.toggle('active', this.isGridView);
        this.listViewBtn.classList.toggle('active', !this.isGridView);
        
        this.fileContainer.className = `file-container ${this.isGridView ? 'grid-view' : 'list-view'}`;
        
        // Update existing file items
        document.querySelectorAll('.file-item').forEach(item => {
            item.className = `file-item ${this.isGridView ? 'grid-view' : 'list-view'}`;
        });
    }

    updateItemCount(count) {
        this.itemCount.textContent = `${count} item${count !== 1 ? 's' : ''}`;
    }

    // Search functionality
    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        
        if (!query.trim()) {
            this.clearSearch();
            return;
        }

        this.searchTimeout = setTimeout(() => {
            this.performSearch(query.trim());
        }, 300);
    }

    async performSearch(query) {
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&path=${encodeURIComponent(this.currentPath)}`);
            
            if (!response.ok) {
                throw new Error('Search failed');
            }

            const data = await response.json();
            this.showSearchResults(data.results, query);

        } catch (error) {
            this.showNotification('Search Error', error.message, 'error');
        }
    }

    showSearchResults(results, query) {
        document.getElementById('searchTitle').textContent = `Search results for "${query}" (${results.length} found)`;
        this.searchContainer.innerHTML = '';
        
        if (results.length === 0) {
            this.searchContainer.innerHTML = '<div class="empty-state"><p>No files found matching your search.</p></div>';
        } else {
            results.forEach(file => {
                const element = this.createFileElement(file);
                this.searchContainer.appendChild(element);
            });
        }
        
        this.searchResults.style.display = 'block';
        this.fileContainer.style.display = 'none';
    }

    clearSearch() {
        this.searchInput.value = '';
        this.searchResults.style.display = 'none';
        this.fileContainer.style.display = 'grid';
    }

    // Upload functionality
    showUploadModal() {
        this.uploadModal.classList.add('show');
        this.resetUploadModal();
    }

    hideUploadModal() {
        this.uploadModal.classList.remove('show');
        this.resetUploadModal();
    }

    resetUploadModal() {
        document.getElementById('fileInput').value = '';
        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('uploadResults').style.display = 'none';
        document.getElementById('uploadArea').style.display = 'block';
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            this.uploadFiles(files);
        }
    }

    handleFileDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            this.showUploadModal();
            this.uploadFiles(files);
        }
    }

    async uploadFiles(files) {
        if (this.isUploading) return;
        
        this.isUploading = true;
        const formData = new FormData();
        
        files.forEach(file => {
            formData.append('files', file);
        });
        
        formData.append('path', this.currentPath);

        try {
            document.getElementById('uploadArea').style.display = 'none';
            document.getElementById('uploadProgress').style.display = 'block';
            
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    document.getElementById('progressFill').style.width = percentComplete + '%';
                    document.getElementById('uploadPercent').textContent = percentComplete + '%';
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    this.showUploadResults(response);
                    this.showNotification('Upload Complete', `${response.files.length} file(s) uploaded successfully`, 'success');
                    setTimeout(() => {
                        this.hideUploadModal();
                        this.loadFiles();
                    }, 2000);
                } else {
                    throw new Error('Upload failed');
                }
                this.isUploading = false;
            });

            xhr.addEventListener('error', () => {
                throw new Error('Upload failed');
            });

            xhr.open('POST', '/api/upload');
            xhr.send(formData);

        } catch (error) {
            this.isUploading = false;
            this.showNotification('Upload Error', error.message, 'error');
            this.resetUploadModal();
        }
    }

    showUploadResults(results) {
        document.getElementById('uploadProgress').style.display = 'none';
        const resultsDiv = document.getElementById('uploadResults');
        
        let html = '<h4>Upload Complete!</h4><ul>';
        results.files.forEach(file => {
            html += `<li>${file.name} (${file.size})</li>`;
        });
        html += '</ul>';
        
        resultsDiv.innerHTML = html;
        resultsDiv.style.display = 'block';
    }

    // File operations
    async createNewFolder() {
        const name = prompt('Enter folder name:');
        if (!name || !name.trim()) return;

        try {
            const response = await fetch('/api/mkdir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: this.currentPath,
                    name: name.trim()
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create folder');
            }

            this.showNotification('Success', 'Folder created successfully', 'success');
            this.loadFiles();

        } catch (error) {
            this.showNotification('Error', error.message, 'error');
        }
    }

    async downloadFile(path) {
        try {
            window.open(`/api/download?path=${encodeURIComponent(path)}`, '_blank');
        } catch (error) {
            this.showNotification('Download Error', error.message, 'error');
        }
    }

    async deleteFile(path) {
        try {
            const response = await fetch('/api/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });

            if (!response.ok) {
                throw new Error('Failed to delete item');
            }

            this.showNotification('Success', 'Item deleted successfully', 'success');
            this.loadFiles();

        } catch (error) {
            this.showNotification('Error', error.message, 'error');
        }
    }

    async renameFile(oldPath, newName) {
        try {
            const response = await fetch('/api/rename', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPath, newName })
            });

            if (!response.ok) {
                throw new Error('Failed to rename item');
            }

            this.showNotification('Success', 'Item renamed successfully', 'success');
            this.loadFiles();

        } catch (error) {
            this.showNotification('Error', error.message, 'error');
        }
    }

    async deleteSelected() {
        if (this.selectedItems.size === 0) return;

        const items = Array.from(this.selectedItems);
        const itemText = items.length === 1 ? 'item' : 'items';
        
        this.showConfirmDialog(
            'Delete Items',
            `Are you sure you want to delete ${items.length} ${itemText}? This action cannot be undone.`,
            async () => {
                for (const path of items) {
                    await this.deleteFile(path);
                }
                this.clearSelection();
            }
        );
    }

    // Preview functionality
    async previewFile(file) {
        try {
            const response = await fetch(`/api/preview?path=${encodeURIComponent(file.path)}`);
            
            if (!response.ok) {
                throw new Error('Preview failed');
            }

            const data = await response.json();
            this.showPreview(data);

        } catch (error) {
            this.showNotification('Preview Error', error.message, 'error');
        }
    }

    showPreview(data) {
        document.getElementById('previewTitle').textContent = data.name;
        const content = document.getElementById('previewContent');
        
        if (data.isText) {
            content.innerHTML = `<pre class="preview-text">${this.escapeHtml(data.content)}</pre>`;
        } else if (data.mimeType.startsWith('image/')) {
            content.innerHTML = `<img src="/api/download?path=${encodeURIComponent(this.currentPreviewPath)}" class="preview-image" alt="${data.name}">`;
        } else {
            content.innerHTML = `
                <div class="preview-info">
                    <div><strong>Name:</strong> ${data.name}</div>
                    <div><strong>Size:</strong> ${data.size}</div>
                    <div><strong>Type:</strong> ${data.mimeType}</div>
                </div>
                <p>This file type cannot be previewed. You can download it instead.</p>
            `;
        }
        
        this.currentPreviewPath = this.selectedItems.values().next().value;
        this.previewModal.classList.add('show');
    }

    hidePreviewModal() {
        this.previewModal.classList.remove('show');
        this.currentPreviewPath = null;
    }

    downloadCurrentPreview() {
        if (this.currentPreviewPath) {
            this.downloadFile(this.currentPreviewPath);
        }
    }

    // Context menu
    showContextMenu(e, file) {
        e.preventDefault();
        this.contextMenuFile = file;
        
        const contextMenu = this.contextMenu;
        contextMenu.style.display = 'block';
        contextMenu.style.left = e.pageX + 'px';
        contextMenu.style.top = e.pageY + 'px';

        // Adjust position if menu goes off screen
        const rect = contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            contextMenu.style.left = (e.pageX - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            contextMenu.style.top = (e.pageY - rect.height) + 'px';
        }
    }

    hideContextMenu() {
        this.contextMenu.style.display = 'none';
    }

    handleContextAction(action) {
        if (!this.contextMenuFile) return;
        
        const file = this.contextMenuFile;
        
        switch (action) {
            case 'open':
                if (file.type === 'directory') {
                    this.navigateToPath(file.path);
                } else {
                    this.previewFile(file);
                }
                break;
            case 'download':
                this.downloadFile(file.path);
                break;
            case 'preview':
                this.previewFile(file);
                break;
            case 'rename':
                const newName = prompt('Enter new name:', file.name);
                if (newName && newName.trim() && newName.trim() !== file.name) {
                    this.renameFile(file.path, newName.trim());
                }
                break;
            case 'delete':
                this.showConfirmDialog(
                    'Delete Item',
                    `Are you sure you want to delete "${file.name}"? This action cannot be undone.`,
                    () => this.deleteFile(file.path)
                );
                break;
        }
        
        this.hideContextMenu();
    }

    // Dialogs and notifications
    showConfirmDialog(title, message, callback) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        this.confirmCallback = callback;
        this.confirmDialog.classList.add('show');
    }

    hideConfirmDialog() {
        this.confirmDialog.classList.remove('show');
        this.confirmCallback = null;
    }

    executeConfirmAction() {
        if (this.confirmCallback) {
            this.confirmCallback();
        }
        this.hideConfirmDialog();
    }

    showNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        this.notificationContainer.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Keyboard shortcuts
    handleKeyboard(e) {
        // Delete key
        if (e.key === 'Delete' && this.selectedItems.size > 0) {
            e.preventDefault();
            this.deleteSelected();
        }

        // Ctrl+A - Select all
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            this.selectAll();
        }

        // F5 - Refresh
        if (e.key === 'F5') {
            e.preventDefault();
            this.loadFiles();
        }

        // Escape - Clear selection, close modals
        if (e.key === 'Escape') {
            this.clearSelection();
            this.hideContextMenu();
            this.hideUploadModal();
            this.hidePreviewModal();
            this.hideConfirmDialog();
            this.clearSearch();
        }
    }

    // Utility functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the file manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FileManager();
});
