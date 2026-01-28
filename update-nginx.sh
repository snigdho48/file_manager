#!/bin/bash

# Simple script to update nginx configurations on existing system
# Usage: ./update-nginx.sh

set -e  # Exit on error

echo "=========================================="
echo "Updating Nginx Configurations"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: Please run as root (use sudo)${NC}"
    exit 1
fi

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Nginx config file paths
FRONTEND_CONFIG="/etc/nginx/sites-available/creative.reachableads.com"
BACKEND_CONFIG="/etc/nginx/sites-available/api.creative.reachableads.com"
FRONTEND_ENABLED="/etc/nginx/sites-enabled/creative.reachableads.com"
BACKEND_ENABLED="/etc/nginx/sites-enabled/api.creative.reachableads.com"

# Source config files
FRONTEND_SOURCE="$SCRIPT_DIR/ftp.conf"
BACKEND_SOURCE="$SCRIPT_DIR/api-ftp.conf"

echo ""
echo -e "${YELLOW}Step 1: Checking source files...${NC}"
if [ ! -f "$FRONTEND_SOURCE" ]; then
    echo -e "${RED}Error: Frontend config not found: $FRONTEND_SOURCE${NC}"
    exit 1
fi

if [ ! -f "$BACKEND_SOURCE" ]; then
    echo -e "${RED}Error: Backend config not found: $BACKEND_SOURCE${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Source files found${NC}"

echo ""
echo -e "${YELLOW}Step 2: Backing up existing configurations...${NC}"
BACKUP_DIR="/etc/nginx/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f "$FRONTEND_CONFIG" ]; then
    cp "$FRONTEND_CONFIG" "$BACKUP_DIR/creative.reachableads.com.conf"
    echo -e "${GREEN}✓ Backed up frontend config${NC}"
fi

if [ -f "$BACKEND_CONFIG" ]; then
    cp "$BACKEND_CONFIG" "$BACKUP_DIR/api.creative.reachableads.com.conf"
    echo -e "${GREEN}✓ Backed up backend config${NC}"
fi

echo -e "${GREEN}Backup saved to: $BACKUP_DIR${NC}"

echo ""
echo -e "${YELLOW}Step 3: Copying new configurations...${NC}"

# Copy frontend config
cp "$FRONTEND_SOURCE" "$FRONTEND_CONFIG"
chmod 644 "$FRONTEND_CONFIG"
echo -e "${GREEN}✓ Updated frontend config${NC}"

# Copy backend config
cp "$BACKEND_SOURCE" "$BACKEND_CONFIG"
chmod 644 "$BACKEND_CONFIG"
echo -e "${GREEN}✓ Updated backend config${NC}"

# Ensure configs are enabled (create symlinks if they don't exist)
if [ ! -L "$FRONTEND_ENABLED" ]; then
    if [ -f "$FRONTEND_ENABLED" ]; then
        rm "$FRONTEND_ENABLED"
    fi
    ln -s "$FRONTEND_CONFIG" "$FRONTEND_ENABLED"
    echo -e "${GREEN}✓ Enabled frontend config${NC}"
fi

if [ ! -L "$BACKEND_ENABLED" ]; then
    if [ -f "$BACKEND_ENABLED" ]; then
        rm "$BACKEND_ENABLED"
    fi
    ln -s "$BACKEND_CONFIG" "$BACKEND_ENABLED"
    echo -e "${GREEN}✓ Enabled backend config${NC}"
fi

echo ""
echo -e "${YELLOW}Step 4: Testing nginx configuration...${NC}"
if nginx -t; then
    echo -e "${GREEN}✓ Nginx configuration test passed${NC}"
else
    echo -e "${RED}✗ Nginx configuration test failed!${NC}"
    echo -e "${YELLOW}Restoring backup...${NC}"
    if [ -f "$BACKUP_DIR/creative.reachableads.com.conf" ]; then
        cp "$BACKUP_DIR/creative.reachableads.com.conf" "$FRONTEND_CONFIG"
    fi
    if [ -f "$BACKUP_DIR/api.creative.reachableads.com.conf" ]; then
        cp "$BACKUP_DIR/api.creative.reachableads.com.conf" "$BACKEND_CONFIG"
    fi
    echo -e "${RED}Configuration restored from backup${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 5: Reloading nginx...${NC}"
if systemctl reload nginx; then
    echo -e "${GREEN}✓ Nginx reloaded successfully${NC}"
else
    echo -e "${RED}✗ Failed to reload nginx${NC}"
    echo -e "${YELLOW}Check nginx status: systemctl status nginx${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=========================================="
echo -e "Update completed successfully!"
echo -e "==========================================${NC}"
echo ""
echo "Configuration files updated:"
echo "  - Frontend: $FRONTEND_CONFIG"
echo "  - Backend:  $BACKEND_CONFIG"
echo ""
echo "Backup location: $BACKUP_DIR"
echo ""
echo "To verify nginx is running:"
echo "  systemctl status nginx"
echo ""
echo "To check nginx error logs:"
echo "  tail -f /var/log/nginx/error.log"
echo ""
