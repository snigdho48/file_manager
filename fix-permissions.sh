#!/bin/bash

# Fix permissions so nginx can read hosted creatives / uploads.
# Paths derived from this script (override with STORAGE_DIR=...).

STORAGE_DIR="${STORAGE_DIR:-$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )/creative}"

echo "Fixing permissions for: $STORAGE_DIR"

if [ ! -d "$STORAGE_DIR" ]; then
    echo "Directory not found. Creating..."
    mkdir -p "$STORAGE_DIR"
fi

NGINX_USER="www-data"
id nginx &>/dev/null && NGINX_USER="nginx"

# Traverse path
PARENT="$STORAGE_DIR"
while [ "$PARENT" != "/" ]; do
    chmod o+x "$PARENT" 2>/dev/null || true
    PARENT="$(dirname "$PARENT")"
done

find "$STORAGE_DIR" -type f -exec chmod 644 {} \; 2>/dev/null
find "$STORAGE_DIR" -type d -exec chmod 755 {} \; 2>/dev/null
chown -R "$NGINX_USER:$NGINX_USER" "$STORAGE_DIR" 2>/dev/null || true

echo "Done. Nginx user: $NGINX_USER"
