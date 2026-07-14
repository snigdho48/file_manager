#!/bin/bash

# Setup symlinks for nginx to access app dist + storage
# Paths are derived from this script's location (not hardcoded).

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$PROJECT_DIR/.." && pwd )"
SOURCE_DIST="$PROJECT_DIR/dist"
SOURCE_CREATIVE="${STORAGE_DIR:-$REPO_ROOT/creative}"
PUBLIC_DIR="/var/www/creative"
SYMLINK_DIST="$PUBLIC_DIR/dist/app"
SYMLINK_CREATIVE="$PUBLIC_DIR/uploads/files"

echo -e "${GREEN}Setting up symlinks for nginx access...${NC}"
echo "  Dist:     $SOURCE_DIST"
echo "  Storage:  $SOURCE_CREATIVE"
echo ""

mkdir -p "$PUBLIC_DIR/dist" "$PUBLIC_DIR/uploads"
mkdir -p "$SOURCE_CREATIVE"

rm -f "$SYMLINK_DIST" "$SYMLINK_CREATIVE"

if [ -d "$SOURCE_DIST" ]; then
    ln -sfn "$SOURCE_DIST" "$SYMLINK_DIST"
    echo -e "${GREEN}✓ $SYMLINK_DIST -> $SOURCE_DIST${NC}"
else
    echo -e "${YELLOW}⚠ dist/ missing — run npm run build first${NC}"
fi

ln -sfn "$SOURCE_CREATIVE" "$SYMLINK_CREATIVE"
echo -e "${GREEN}✓ $SYMLINK_CREATIVE -> $SOURCE_CREATIVE${NC}"

chmod 755 "$PUBLIC_DIR" "$PUBLIC_DIR/dist" "$PUBLIC_DIR/uploads"

# Allow nginx to traverse to real paths under /root if needed
PARENT="$PROJECT_DIR"
while [ "$PARENT" != "/" ]; do
    chmod o+x "$PARENT" 2>/dev/null || true
    PARENT="$(dirname "$PARENT")"
done

NGINX_USER="www-data"
id nginx &>/dev/null && NGINX_USER="nginx"

echo ""
if [ -L "$SYMLINK_CREATIVE" ] && sudo -u "$NGINX_USER" ls "$SYMLINK_CREATIVE" &>/dev/null; then
    echo -e "${GREEN}✓ Nginx can access storage symlink${NC}"
else
    echo -e "${YELLOW}⚠ Could not verify nginx read access — check permissions${NC}"
fi

echo -e "${GREEN}Done.${NC}"
