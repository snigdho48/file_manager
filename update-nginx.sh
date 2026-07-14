#!/bin/bash

# Update nginx site configs from templates (ftp.conf / api-ftp.conf).
# Reads domains from .deploy-info or prompts.

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

if [ -z "${FRONTEND_DOMAIN:-}" ]; then
    read -r -p "$(echo -e ${CYAN}Frontend domain${NC}: )" FRONTEND_DOMAIN
fi
if [ -z "${BACKEND_DOMAIN:-}" ]; then
    read -r -p "$(echo -e ${CYAN}API domain${NC} [api.${FRONTEND_DOMAIN}]: )" BACKEND_DOMAIN
    BACKEND_DOMAIN="${BACKEND_DOMAIN:-api.${FRONTEND_DOMAIN}}"
fi

FRONTEND_DOMAIN="$(echo "$FRONTEND_DOMAIN" | sed -E 's#^https?://##; s#/$##')"
BACKEND_DOMAIN="$(echo "$BACKEND_DOMAIN" | sed -E 's#^https?://##; s#/$##')"

FRONTEND_CONFIG="/etc/nginx/sites-available/${FRONTEND_DOMAIN}"
BACKEND_CONFIG="/etc/nginx/sites-available/${BACKEND_DOMAIN}"
FRONTEND_ENABLED="/etc/nginx/sites-enabled/${FRONTEND_DOMAIN}"
BACKEND_ENABLED="/etc/nginx/sites-enabled/${BACKEND_DOMAIN}"

echo -e "${YELLOW}Rendering nginx configs for ${FRONTEND_DOMAIN} / ${BACKEND_DOMAIN}...${NC}"

TMP_FE="$(mktemp)"
TMP_BE="$(mktemp)"
sed -e "s/__FRONTEND_DOMAIN__/${FRONTEND_DOMAIN}/g" \
    -e "s/__BACKEND_DOMAIN__/${BACKEND_DOMAIN}/g" \
    "$SCRIPT_DIR/ftp.conf" > "$TMP_FE"
sed -e "s/__FRONTEND_DOMAIN__/${FRONTEND_DOMAIN}/g" \
    -e "s/__BACKEND_DOMAIN__/${BACKEND_DOMAIN}/g" \
    "$SCRIPT_DIR/api-ftp.conf" > "$TMP_BE"

[ -f "$FRONTEND_CONFIG" ] && cp "$FRONTEND_CONFIG" "${FRONTEND_CONFIG}.backup.$(date +%s)"
[ -f "$BACKEND_CONFIG" ] && cp "$BACKEND_CONFIG" "${BACKEND_CONFIG}.backup.$(date +%s)"

cp "$TMP_FE" "$FRONTEND_CONFIG"
cp "$TMP_BE" "$BACKEND_CONFIG"
rm -f "$TMP_FE" "$TMP_BE"

ln -sfn "$FRONTEND_CONFIG" "$FRONTEND_ENABLED"
ln -sfn "$BACKEND_CONFIG" "$BACKEND_ENABLED"

if nginx -t; then
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx updated and reloaded${NC}"
    echo -e "${YELLOW}Re-run certbot if SSL lines were reset: certbot --nginx -d ${FRONTEND_DOMAIN} -d ${BACKEND_DOMAIN}${NC}"
else
    echo -e "${RED}Nginx test failed — backups kept beside the site files${NC}"
    exit 1
fi
