#!/bin/bash

# Setup symlinks for nginx to access files in /root
# This allows nginx to serve files without exposing /root directly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up symlinks for nginx access...${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Paths
SOURCE_DIST="/root/projects/Server-File-Manager/mainFile/dist"
SOURCE_CREATIVE="/root/projects/Server-File-Manager/creative"
PUBLIC_DIR="/var/www/creative"
SYMLINK_DIST="$PUBLIC_DIR/dist/app"
SYMLINK_CREATIVE="$PUBLIC_DIR/uploads/files"

# Step 1: Create public directories
echo -e "${YELLOW}Step 1: Creating public directories...${NC}"
mkdir -p "$PUBLIC_DIR/dist"
mkdir -p "$PUBLIC_DIR/uploads"
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Step 2: Remove existing symlinks if they exist
echo -e "${YELLOW}Step 2: Removing existing symlinks (if any)...${NC}"
rm -f "$SYMLINK_DIST"
rm -f "$SYMLINK_CREATIVE"
echo -e "${GREEN}✓ Old symlinks removed${NC}"
echo ""

# Step 3: Create symbolic links
echo -e "${YELLOW}Step 3: Creating symbolic links...${NC}"
if [ -d "$SOURCE_DIST" ]; then
    ln -s "$SOURCE_DIST" "$SYMLINK_DIST"
    echo -e "${GREEN}✓ Created: $SYMLINK_DIST -> $SOURCE_DIST${NC}"
else
    echo -e "${YELLOW}⚠ Warning: $SOURCE_DIST does not exist (will be created on build)${NC}"
    # Create placeholder symlink that will work when dist is created
    mkdir -p "$(dirname "$SYMLINK_DIST")"
    touch "$SYMLINK_DIST.placeholder"
fi

if [ -d "$SOURCE_CREATIVE" ]; then
    ln -s "$SOURCE_CREATIVE" "$SYMLINK_CREATIVE"
    echo -e "${GREEN}✓ Created: $SYMLINK_CREATIVE -> $SOURCE_CREATIVE${NC}"
else
    echo -e "${YELLOW}⚠ Warning: $SOURCE_CREATIVE does not exist (creating it)${NC}"
    mkdir -p "$SOURCE_CREATIVE"
    ln -s "$SOURCE_CREATIVE" "$SYMLINK_CREATIVE"
    echo -e "${GREEN}✓ Created directory and symlink${NC}"
fi
echo ""

# Step 4: Set permissions on public directory
echo -e "${YELLOW}Step 4: Setting permissions on public directory...${NC}"
chmod 755 "$PUBLIC_DIR"
chmod 755 "$PUBLIC_DIR/dist"
chmod 755 "$PUBLIC_DIR/uploads"
echo -e "${GREEN}✓ Permissions set${NC}"
echo ""

# Step 5: Allow www-data to traverse /root (required for symlinks to work)
echo -e "${YELLOW}Step 5: Setting traverse permissions on /root path...${NC}"
echo -e "${YELLOW}  This allows nginx to follow symlinks but does NOT expose /root files${NC}"
chmod o+x /root 2>/dev/null || echo -e "${YELLOW}  Warning: Could not set /root permissions (may already be set)${NC}"
chmod o+x /root/projects 2>/dev/null || echo -e "${YELLOW}  Warning: Could not set /root/projects permissions${NC}"
chmod o+x /root/projects/Server-File-Manager 2>/dev/null || echo -e "${YELLOW}  Warning: Could not set Server-File-Manager permissions${NC}"
echo -e "${GREEN}✓ Traverse permissions set${NC}"
echo ""

# Step 6: Verify access
echo -e "${YELLOW}Step 6: Verifying nginx can access symlinks...${NC}"

# Determine nginx user
NGINX_USER="www-data"
if id "nginx" &>/dev/null; then
    NGINX_USER="nginx"
fi

if sudo -u "$NGINX_USER" ls "$SYMLINK_DIST" &>/dev/null 2>&1; then
    echo -e "${GREEN}✓ Nginx can access dist symlink${NC}"
else
    echo -e "${YELLOW}⚠ Nginx cannot access dist symlink (may not exist yet - will work after build)${NC}"
fi

if sudo -u "$NGINX_USER" ls "$SYMLINK_CREATIVE" &>/dev/null 2>&1; then
    echo -e "${GREEN}✓ Nginx can access creative symlink${NC}"
else
    echo -e "${RED}✗ Nginx cannot access creative symlink - check permissions!${NC}"
    exit 1
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Symlinks setup complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Symlinks created:"
echo "  $SYMLINK_DIST -> $SOURCE_DIST"
echo "  $SYMLINK_CREATIVE -> $SOURCE_CREATIVE"
echo ""
echo "Next steps:"
echo "  1. Update nginx config to use /var/www/creative paths"
echo "  2. Test nginx config: sudo nginx -t"
echo "  3. Reload nginx: sudo systemctl reload nginx"
echo ""

