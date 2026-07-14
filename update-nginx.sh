#!/bin/bash

# Update nginx site config from ftp.conf (single domain; /api on same host).
# Reads domain from .deploy-info or prompts.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ -f "$SCRIPT_DIR/.deploy-info" ]; then
    # shellcheck disable=SC1090
    source "$SCRIPT_DIR/.deploy-info"
fi

if [ -z "${FRONTEND_DOMAIN:-}" ] && [ -n "${FRONTEND_URL:-}" ]; then
    FRONTEND_DOMAIN="$(echo "$FRONTEND_URL" | sed -E 's#^https?://##; s#/.*##')"
fi

if [ -z "${FRONTEND_DOMAIN:-}" ]; then
    read -r -p "$(echo -e ${CYAN}DEPLOY_FRONTEND_URL${NC}=)" RAW
    RAW="$(echo "$RAW" | sed -E 's/^DEPLOY_FRONTEND_URL=//; s/[[:space:]]+//g')"
    FRONTEND_DOMAIN="$(echo "$RAW" | sed -E 's#^https?://##; s#/.*##; s#/$##')"
fi

FRONTEND_DOMAIN="$(echo "$FRONTEND_DOMAIN" | sed -E 's#^https?://##; s#/$##' | tr '[:upper:]' '[:lower:]')"

FRONTEND_CONFIG="/etc/nginx/sites-available/${FRONTEND_DOMAIN}"
FRONTEND_ENABLED="/etc/nginx/sites-enabled/${FRONTEND_DOMAIN}"

echo -e "${YELLOW}Rendering nginx config for ${FRONTEND_DOMAIN} (/api on same host)...${NC}"

TMP_FE="$(mktemp)"
sed -e "s/__FRONTEND_DOMAIN__/${FRONTEND_DOMAIN}/g" \
    -e "s/__BACKEND_DOMAIN__/${FRONTEND_DOMAIN}/g" \
    "$SCRIPT_DIR/ftp.conf" > "$TMP_FE"

[ -f "$FRONTEND_CONFIG" ] && cp "$FRONTEND_CONFIG" "${FRONTEND_CONFIG}.backup.$(date +%s)"
cp "$TMP_FE" "$FRONTEND_CONFIG"
rm -f "$TMP_FE"

ln -sfn "$FRONTEND_CONFIG" "$FRONTEND_ENABLED"

if nginx -t; then
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx updated and reloaded${NC}"
    echo -e "${YELLOW}Re-run certbot if SSL was reset: certbot --nginx -d ${FRONTEND_DOMAIN}${NC}"
else
    echo -e "${RED}Nginx test failed — backup kept beside the site file${NC}"
    exit 1
fi
