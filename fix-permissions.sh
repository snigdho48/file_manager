#!/bin/bash

# Fix permissions for creative directory
# This script fixes permissions for all files and directories in the creative folder
# so that nginx can read them
# IMPORTANT: Also fixes parent directory permissions so nginx can traverse /root

STORAGE_DIR="/root/projects/Server-File-Manager/creative"

echo "Fixing permissions for creative directory..."
echo "Directory: $STORAGE_DIR"
echo ""
echo "WARNING: This will make /root/projects accessible to nginx user."
echo "This is necessary for nginx to serve files from the creative directory."
echo ""

# Determine nginx user (varies by distribution)
NGINX_USER="www-data"
if id "nginx" &>/dev/null; then
    NGINX_USER="nginx"
fi

echo "Nginx user: $NGINX_USER"
echo ""

# CRITICAL: Fix parent directory permissions so nginx can traverse to creative directory
# /root typically has 700 permissions, which blocks nginx
echo "Step 1: Fixing parent directory permissions (so nginx can traverse)..."
echo "  Setting /root/projects to 755..."
chmod 755 /root/projects 2>/dev/null || echo "  Warning: Could not set /root/projects permissions"
echo "  Setting /root/projects/Server-File-Manager to 755..."
chmod 755 /root/projects/Server-File-Manager 2>/dev/null || echo "  Warning: Could not set Server-File-Manager permissions"
echo "  Setting creative directory to 755..."
chmod 755 "$STORAGE_DIR" 2>/dev/null || echo "  Warning: Could not set creative directory permissions"
echo ""

# Fix file permissions (644 = rw-r--r--)
echo "Step 2: Setting file permissions to 644..."
find "$STORAGE_DIR" -type f -exec chmod 644 {} \; 2>/dev/null
echo "  Done"
echo ""

# Fix directory permissions (755 = rwxr-xr-x) - executable needed for traversal
echo "Step 3: Setting directory permissions to 755..."
find "$STORAGE_DIR" -type d -exec chmod 755 {} \; 2>/dev/null
echo "  Done"
echo ""

# Try to set ownership (may fail if not root, but that's OK)
echo "Step 4: Setting ownership to $NGINX_USER..."
chown -R "$NGINX_USER:$NGINX_USER" "$STORAGE_DIR" 2>/dev/null || {
    echo "  Warning: Could not change ownership. Using world-readable permissions instead."
    echo "  This is OK - files are readable by all (644/755)."
}
echo ""

# Verify permissions
echo "Step 5: Verifying permissions..."
if [ -d "$STORAGE_DIR/lackme/4-7-24" ]; then
    echo "  Checking: $STORAGE_DIR/lackme/4-7-24/"
    ls -ld "$STORAGE_DIR/lackme/4-7-24" 2>/dev/null || echo "  Directory not found or not accessible"
else
    echo "  Test directory not found, but that's OK"
fi
echo ""

echo "Done! Permissions fixed."
echo ""
echo "IMPORTANT: If you still get 403 errors, check:"
echo "  1. SELinux status: getenforce (if enabled, may need: setsebool -P httpd_read_user_content 1)"
echo "  2. AppArmor status: aa-status (if enabled, may need to configure)"
echo "  3. Nginx error log: tail -f /var/log/nginx/error.log"
echo ""
echo "To verify permissions:"
echo "  ls -la $STORAGE_DIR/lackme/4-7-24/"
echo "  Files should show: -rw-r--r--"
echo "  Directories should show: drwxr-xr-x"

