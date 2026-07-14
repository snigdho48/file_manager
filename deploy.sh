#!/bin/bash

# ========================================
# Reachable File Manager — One-Click Deploy
# Asks for your domain, then installs everything.
# ========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Resolve project dir from this script (works no matter where the repo lives)
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$PROJECT_DIR/.." && pwd )"
STORAGE_DIR="${STORAGE_DIR:-$REPO_ROOT/creative}"
PUBLIC_WWW="/var/www/creative"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} CrowdWork360 — Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Project: ${CYAN}${PROJECT_DIR}${NC}"
echo -e "Storage: ${CYAN}${STORAGE_DIR}${NC}"
echo ""

# Must run as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo bash deploy.sh${NC}"
    exit 1
fi

# ---------- Helpers: read/update .env ----------
ENV_FILE="$PROJECT_DIR/.env"

read_env_var() {
    local key="$1"
    if [ -f "$ENV_FILE" ]; then
        # shellcheck disable=SC2002
        grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' -e 's/\r$//'
    fi
}

# Upsert KEY=value in .env (creates file if missing)
set_env_var() {
    local key="$1"
    local value="$2"
    touch "$ENV_FILE"
    if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
        # Escape & \ for sed replacement
        local escaped
        escaped="$(printf '%s' "$value" | sed -e 's/[&\\]/\\&/g')"
        sed -i "s|^${key}=.*|${key}=${escaped}|" "$ENV_FILE"
    else
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

normalize_frontend_url() {
    local raw="$1"
    raw="$(echo "$raw" | sed -E 's/[[:space:]]+//g; s#/$##')"
    if [ -z "$raw" ]; then
        echo ""
        return
    fi
    # Accept domain or full URL
    if [[ "$raw" =~ ^https?:// ]]; then
        echo "$raw"
    else
        echo "https://${raw}"
    fi
}

domain_from_url() {
    echo "$1" | sed -E 's#^https?://##; s#/.*##; s/[[:space:]]+//g' | tr '[:upper:]' '[:lower:]'
}

# ---------- Interactive deploy inputs ----------
# Same vars as non-interactive:
#   DEPLOY_FRONTEND_URL=https://files.example.com
#   DEPLOY_BACKEND_DOMAIN=api.files.example.com
EXISTING_FRONTEND_URL="$(read_env_var FRONTEND_URL)"
EXISTING_SESSION_SECRET="$(read_env_var SESSION_SECRET)"
EXISTING_FM_USERNAME="$(read_env_var FM_USERNAME)"
EXISTING_FM_PASSWORD="$(read_env_var FM_PASSWORD)"

EXISTING_BACKEND_HINT=""
if [ -f "$PROJECT_DIR/.deploy-info" ]; then
    EXISTING_BACKEND_HINT="$(grep -E '^BACKEND_DOMAIN=' "$PROJECT_DIR/.deploy-info" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r')"
fi

echo -e "${YELLOW}Enter deploy settings (or press Enter to keep / use defaults)${NC}"
echo -e "  Example:"
echo -e "    ${CYAN}DEPLOY_FRONTEND_URL=https://files.example.com${NC}"
echo -e "    ${CYAN}DEPLOY_BACKEND_DOMAIN=api.files.example.com${NC}"
echo ""

# --- DEPLOY_FRONTEND_URL ---
if [ -n "${DEPLOY_FRONTEND_URL:-}" ]; then
    FRONTEND_URL_INPUT="$DEPLOY_FRONTEND_URL"
    echo -e "${GREEN}Using env DEPLOY_FRONTEND_URL=${DEPLOY_FRONTEND_URL}${NC}"
else
    if [ -n "$EXISTING_FRONTEND_URL" ]; then
        echo -e "  Current .env FRONTEND_URL: ${CYAN}${EXISTING_FRONTEND_URL}${NC}"
        echo -e "  ${YELLOW}Leave empty to keep it unchanged.${NC}"
    fi
    read -r -p "$(echo -e ${CYAN}DEPLOY_FRONTEND_URL${NC}=)" FRONTEND_URL_INPUT
fi

# Allow paste like "DEPLOY_FRONTEND_URL=https://..." or just the URL/domain
FRONTEND_URL_INPUT="$(echo "${FRONTEND_URL_INPUT:-}" | sed -E 's/^DEPLOY_FRONTEND_URL=//; s/[[:space:]]+//g')"

if [ -n "$FRONTEND_URL_INPUT" ]; then
    FRONTEND_URL="$(normalize_frontend_url "$FRONTEND_URL_INPUT")"
    UPDATE_FRONTEND_URL=1
    echo -e "${GREEN}✓ Will set FRONTEND_URL=${FRONTEND_URL}${NC}"
elif [ -n "$EXISTING_FRONTEND_URL" ]; then
    FRONTEND_URL="$EXISTING_FRONTEND_URL"
    UPDATE_FRONTEND_URL=0
    echo -e "${GREEN}✓ Keeping existing FRONTEND_URL=${FRONTEND_URL}${NC}"
else
    echo -e "${RED}DEPLOY_FRONTEND_URL is required on first deploy (none in .env).${NC}"
    echo -e "${YELLOW}Example: https://files.example.com${NC}"
    exit 1
fi

FRONTEND_DOMAIN="$(domain_from_url "$FRONTEND_URL")"
if [ -z "$FRONTEND_DOMAIN" ]; then
    echo -e "${RED}Could not parse domain from DEPLOY_FRONTEND_URL=${FRONTEND_URL}${NC}"
    exit 1
fi

DEFAULT_API="${EXISTING_BACKEND_HINT:-api.${FRONTEND_DOMAIN}}"

# --- DEPLOY_BACKEND_DOMAIN ---
echo ""
if [ -n "${DEPLOY_BACKEND_DOMAIN:-}" ]; then
    BACKEND_INPUT="$DEPLOY_BACKEND_DOMAIN"
    echo -e "${GREEN}Using env DEPLOY_BACKEND_DOMAIN=${DEPLOY_BACKEND_DOMAIN}${NC}"
else
    echo -e "  Default API host: ${CYAN}${DEFAULT_API}${NC}"
    echo -e "  ${YELLOW}Leave empty to use the default.${NC}"
    read -r -p "$(echo -e ${CYAN}DEPLOY_BACKEND_DOMAIN${NC}=)" BACKEND_INPUT
fi

BACKEND_INPUT="$(echo "${BACKEND_INPUT:-}" | sed -E 's/^DEPLOY_BACKEND_DOMAIN=//; s/[[:space:]]+//g')"
BACKEND_INPUT="${BACKEND_INPUT:-$DEFAULT_API}"
BACKEND_DOMAIN="$(domain_from_url "$(normalize_frontend_url "$BACKEND_INPUT")")"

if [ -z "$BACKEND_DOMAIN" ]; then
    echo -e "${RED}Invalid DEPLOY_BACKEND_DOMAIN${NC}"
    exit 1
fi
echo -e "${GREEN}✓ DEPLOY_BACKEND_DOMAIN=${BACKEND_DOMAIN}${NC}"

# Cookie domain: parent of frontend (optional; same-origin /api is default)
derive_cookie_domain() {
    local host="$1"
    local parts
    IFS='.' read -r -a parts <<< "$host"
    local n=${#parts[@]}
    if [ "$n" -ge 2 ]; then
        echo ".${parts[$((n-2))]}.${parts[$((n-1))]}"
    else
        echo ""
    fi
}
COOKIE_DOMAIN="$(derive_cookie_domain "$FRONTEND_DOMAIN")"

echo ""
DEFAULT_USER="${EXISTING_FM_USERNAME:-reachable}"
read -r -p "$(echo -e ${CYAN}Admin username${NC} [${DEFAULT_USER}]: )" FM_USERNAME
FM_USERNAME="${FM_USERNAME:-$DEFAULT_USER}"
if [ -n "$EXISTING_FM_PASSWORD" ]; then
    read -r -s -p "$(echo -e ${CYAN}Admin password${NC} [keep current]: )" FM_PASSWORD
    echo ""
    FM_PASSWORD="${FM_PASSWORD:-$EXISTING_FM_PASSWORD}"
else
    read -r -s -p "$(echo -e ${CYAN}Admin password${NC} [Reachable@2025#]: )" FM_PASSWORD
    echo ""
    FM_PASSWORD="${FM_PASSWORD:-Reachable@2025#}"
fi

# Keep session secret stable across redeploys
if [ -n "$EXISTING_SESSION_SECRET" ]; then
    SESSION_SECRET="$EXISTING_SESSION_SECRET"
else
    SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32)}"
fi

BACKEND_URL="https://${BACKEND_DOMAIN}"

NGINX_FRONTEND_SITE="/etc/nginx/sites-available/${FRONTEND_DOMAIN}"
NGINX_BACKEND_SITE="/etc/nginx/sites-available/${BACKEND_DOMAIN}"
NGINX_FRONTEND_ENABLED="/etc/nginx/sites-enabled/${FRONTEND_DOMAIN}"
NGINX_BACKEND_ENABLED="/etc/nginx/sites-enabled/${BACKEND_DOMAIN}"

echo ""
echo -e "${GREEN}Will deploy:${NC}"
echo -e "  DEPLOY_FRONTEND_URL=${CYAN}${FRONTEND_URL}${NC}$([ "$UPDATE_FRONTEND_URL" = "1" ] && echo " → update .env" || echo " → keep .env")"
echo -e "  DEPLOY_BACKEND_DOMAIN=${CYAN}${BACKEND_DOMAIN}${NC}"
echo -e "  API URL: ${CYAN}${BACKEND_URL}${NC} (nginx → localhost:3000)"
echo ""
read -r -p "Continue? [Y/n]: " CONFIRM
CONFIRM="${CONFIRM:-Y}"
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

render_nginx() {
    local src="$1"
    local dest="$2"
    sed -e "s/__FRONTEND_DOMAIN__/${FRONTEND_DOMAIN}/g" \
        -e "s/__BACKEND_DOMAIN__/${BACKEND_DOMAIN}/g" \
        "$src" > "$dest"
}

# ---------- System packages ----------
echo -e "${YELLOW}Step 1: Updating packages & installing dependencies...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y \
    build-essential python3 python3-pip curl wget git ca-certificates \
    gnupg lsb-release nginx certbot python3-certbot-nginx openssl \
    >/dev/null
systemctl enable nginx >/dev/null 2>&1 || true
systemctl start nginx >/dev/null 2>&1 || true
echo -e "${GREEN}✓ Base packages ready${NC}"

# ---------- Node.js ----------
if ! command -v node &>/dev/null; then
    echo -e "${YELLOW}Step 2: Installing Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}Step 2: Node.js already installed ($(node --version))${NC}"
fi
if ! command -v npm &>/dev/null; then
    echo -e "${RED}npm not found after Node install${NC}"
    exit 1
fi

# ---------- App install & build ----------
cd "$PROJECT_DIR"
echo -e "${YELLOW}Step 3: Installing npm dependencies...${NC}"
npm install --production=false --legacy-peer-deps || npm install --production=false
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "${YELLOW}Step 4: Building frontend...${NC}"
rm -rf dist
npm run build
if [ ! -d dist ]; then
    echo -e "${RED}Build failed — dist/ missing${NC}"
    exit 1
fi
find dist -type f -exec chmod 644 {} \; 2>/dev/null || true
find dist -type d -exec chmod 755 {} \; 2>/dev/null || true
echo -e "${GREEN}✓ Frontend built${NC}"

# ---------- Runtime config ----------
echo -e "${YELLOW}Step 5: Writing .env and config.js...${NC}"

# Ensure .env exists; only change FRONTEND_URL when the user provided a new value
if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" << EOF
PORT=3000
NODE_ENV=production
FRONTEND_URL=${FRONTEND_URL}
FRONTEND_HOSTS=${FRONTEND_DOMAIN},www.${FRONTEND_DOMAIN}
COOKIE_SAME_SITE=lax
STORAGE_DIR=${STORAGE_DIR}
FM_USERNAME=${FM_USERNAME}
FM_PASSWORD=${FM_PASSWORD}
SESSION_SECRET=${SESSION_SECRET}
EOF
else
    set_env_var "PORT" "3000"
    set_env_var "NODE_ENV" "production"
    set_env_var "STORAGE_DIR" "${STORAGE_DIR}"
    set_env_var "FM_USERNAME" "${FM_USERNAME}"
    set_env_var "FM_PASSWORD" "${FM_PASSWORD}"
    set_env_var "SESSION_SECRET" "${SESSION_SECRET}"
    set_env_var "COOKIE_SAME_SITE" "lax"

    if [ "$UPDATE_FRONTEND_URL" = "1" ]; then
        set_env_var "FRONTEND_URL" "${FRONTEND_URL}"
        set_env_var "FRONTEND_HOSTS" "${FRONTEND_DOMAIN},www.${FRONTEND_DOMAIN}"
        echo -e "${GREEN}✓ Updated FRONTEND_URL in .env${NC}"
    else
        echo -e "${GREEN}✓ Left FRONTEND_URL unchanged in .env${NC}"
        # Refresh FRONTEND_HOSTS only if missing
        if [ -z "$(read_env_var FRONTEND_HOSTS)" ]; then
            set_env_var "FRONTEND_HOSTS" "${FRONTEND_DOMAIN},www.${FRONTEND_DOMAIN}"
        fi
    fi
fi

# Same-origin API (empty) — nginx proxies /api on the frontend domain
cat > "$PROJECT_DIR/public/config.js" << 'EOF'
window.APP_CONFIG = {
  API_URL: ''
};
EOF
cp -f "$PROJECT_DIR/public/config.js" "$PROJECT_DIR/dist/config.js"
echo -e "${GREEN}✓ Environment ready (${ENV_FILE})${NC}"

# ---------- Storage + symlinks ----------
echo -e "${YELLOW}Step 6: Storage directory & nginx symlinks...${NC}"
mkdir -p "$STORAGE_DIR"
mkdir -p "$PUBLIC_WWW/dist" "$PUBLIC_WWW/uploads"

NGINX_USER="www-data"
id nginx &>/dev/null && NGINX_USER="nginx"

# Symlinks nginx can follow
rm -f "$PUBLIC_WWW/dist/app" "$PUBLIC_WWW/uploads/files"
ln -sfn "$PROJECT_DIR/dist" "$PUBLIC_WWW/dist/app"
ln -sfn "$STORAGE_DIR" "$PUBLIC_WWW/uploads/files"

# Allow nginx to traverse path to real files (if under /root)
chmod o+x /root 2>/dev/null || true
PARENT="$PROJECT_DIR"
while [ "$PARENT" != "/" ]; do
    chmod o+x "$PARENT" 2>/dev/null || true
    PARENT="$(dirname "$PARENT")"
done
chmod o+x "$REPO_ROOT" 2>/dev/null || true
chmod -R u+rwX,go+rX "$STORAGE_DIR" 2>/dev/null || true
find "$STORAGE_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
find "$STORAGE_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
chown -R "$NGINX_USER:$NGINX_USER" "$STORAGE_DIR" 2>/dev/null || true
chmod 755 "$PUBLIC_WWW" "$PUBLIC_WWW/dist" "$PUBLIC_WWW/uploads"
echo -e "${GREEN}✓ Storage + symlinks ready${NC}"

# ---------- Nginx ----------
echo -e "${YELLOW}Step 7: Configuring nginx...${NC}"
TMP_FE="$(mktemp)"
TMP_BE="$(mktemp)"
render_nginx "$PROJECT_DIR/ftp.conf" "$TMP_FE"
render_nginx "$PROJECT_DIR/api-ftp.conf" "$TMP_BE"

# Preserve SSL cert lines if site already has certbot config
preserve_ssl() {
    local existing="$1"
    local newfile="$2"
    if [ -f "$existing" ] && grep -q "ssl_certificate" "$existing" 2>/dev/null; then
        cp "$existing" "${existing}.backup.$(date +%s)"
    fi
    cp "$newfile" "$existing"
}

preserve_ssl "$NGINX_FRONTEND_SITE" "$TMP_FE"
preserve_ssl "$NGINX_BACKEND_SITE" "$TMP_BE"
rm -f "$TMP_FE" "$TMP_BE"

ln -sfn "$NGINX_FRONTEND_SITE" "$NGINX_FRONTEND_ENABLED"
ln -sfn "$NGINX_BACKEND_SITE" "$NGINX_BACKEND_ENABLED"

if ! nginx -t; then
    echo -e "${RED}Nginx config test failed${NC}"
    exit 1
fi
systemctl reload nginx
echo -e "${GREEN}✓ Nginx configured${NC}"

# ---------- SSL ----------
echo -e "${YELLOW}Step 8: SSL certificates (certbot)...${NC}"
echo -e "${YELLOW}DNS for ${FRONTEND_DOMAIN} and ${BACKEND_DOMAIN} must point here.${NC}"
certbot --nginx -d "$FRONTEND_DOMAIN" --non-interactive --agree-tos \
    --register-unsafely-without-email --redirect 2>/dev/null || \
    echo -e "${YELLOW}⚠ Frontend cert skipped (DNS/ports?). Later: certbot --nginx -d ${FRONTEND_DOMAIN}${NC}"
certbot --nginx -d "$BACKEND_DOMAIN" --non-interactive --agree-tos \
    --register-unsafely-without-email --redirect 2>/dev/null || \
    echo -e "${YELLOW}⚠ API cert skipped (DNS/ports?). Later: certbot --nginx -d ${BACKEND_DOMAIN}${NC}"
nginx -t 2>/dev/null && systemctl reload nginx || true
certbot renew --quiet 2>/dev/null || true
echo -e "${GREEN}✓ SSL step done${NC}"

# ---------- PM2 ----------
echo -e "${YELLOW}Step 9: Starting API with PM2...${NC}"
if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
fi
cd "$PROJECT_DIR"
pm2 delete filemanager-api 2>/dev/null || true
pm2 start server.js --name filemanager-api --update-env
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | grep -v "PM2" | bash 2>/dev/null || true
sleep 2
if pm2 list | grep -q "filemanager-api.*online"; then
    echo -e "${GREEN}✓ Backend online (port 3000)${NC}"
else
    echo -e "${YELLOW}⚠ Check: pm2 logs filemanager-api${NC}"
    pm2 logs filemanager-api --lines 30 --nostream || true
fi

# ---------- Firewall ----------
if command -v ufw &>/dev/null; then
    echo -e "${YELLOW}Step 10: Firewall...${NC}"
    ufw allow 22/tcp 2>/dev/null || true
    ufw allow 'Nginx Full' 2>/dev/null || true
    if ! ufw status | grep -q "Status: active"; then
        echo "y" | ufw --force enable 2>/dev/null || true
    fi
    echo -e "${GREEN}✓ Firewall updated${NC}"
fi

# ---------- Save deploy info ----------
cat > "$PROJECT_DIR/.deploy-info" << EOF
FRONTEND_DOMAIN=${FRONTEND_DOMAIN}
BACKEND_DOMAIN=${BACKEND_DOMAIN}
FRONTEND_URL=${FRONTEND_URL}
BACKEND_URL=${BACKEND_URL}
STORAGE_DIR=${STORAGE_DIR}
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Deployment complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Open:     ${GREEN}${FRONTEND_URL}${NC}"
echo -e "API:      ${GREEN}${BACKEND_URL}${NC}"
echo -e "Login:    ${CYAN}${FM_USERNAME}${NC} / (password you set)"
echo ""
echo -e "Useful:"
echo -e "  pm2 status"
echo -e "  pm2 logs filemanager-api"
echo -e "  systemctl status nginx"
echo -e "  Edit credentials: ${YELLOW}${PROJECT_DIR}/.env${NC} then ${GREEN}pm2 restart filemanager-api${NC}"
echo ""
echo -e "Re-run anytime: ${GREEN}sudo bash ${PROJECT_DIR}/deploy.sh${NC}"
echo ""
