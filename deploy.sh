#!/bin/bash

# ========================================
# Reachable File Manager - One-Click Deployment
# Frontend: creative.reachableads.com
# Backend: api.creative.reachableads.com
# ========================================

set -e  # Exit on any error (but we'll handle some errors gracefully)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/root/projects/Server-File-Manager/mainFile"
FRONTEND_DOMAIN="creative.reachableads.com"
BACKEND_DOMAIN="api.creative.reachableads.com"
NGINX_FRONTEND_CONFIG="ftp.conf"
NGINX_BACKEND_CONFIG="api-ftp.conf"
NGINX_FRONTEND_SITE="/etc/nginx/sites-available/${FRONTEND_DOMAIN}"
NGINX_BACKEND_SITE="/etc/nginx/sites-available/${BACKEND_DOMAIN}"
NGINX_FRONTEND_ENABLED="/etc/nginx/sites-enabled/${FRONTEND_DOMAIN}"
NGINX_BACKEND_ENABLED="/etc/nginx/sites-enabled/${BACKEND_DOMAIN}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Reachable File Manager - Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Step 1: Update system packages
echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
apt-get update -qq
echo -e "${GREEN}✓ System updated${NC}"
echo ""

# Step 2: Install essential build tools, dependencies, nginx, and certbot
echo -e "${YELLOW}Step 2: Installing essential build tools, dependencies, nginx, and certbot...${NC}"
apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    nginx \
    certbot \
    python3-certbot-nginx

# Enable and start nginx
systemctl enable nginx
systemctl start nginx

# Verify nginx is running
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Build tools, dependencies, nginx, and certbot installed${NC}"
    echo -e "${GREEN}✓ Nginx is running${NC}"
else
    echo -e "${YELLOW}⚠ Nginx installed but not running. Will start later.${NC}"
fi
echo ""

# Step 3: Install Node.js if not installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Step 3: Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo -e "${GREEN}✓ Node.js installed ($(node --version))${NC}"
else
    echo -e "${GREEN}Step 3: Node.js already installed ($(node --version))${NC}"
fi

# Verify npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}ERROR: npm not found after Node.js installation${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm version: $(npm --version)${NC}"
echo ""

# Step 4: Verify nginx and certbot are installed (they should be from Step 2)
echo -e "${YELLOW}Step 4: Verifying nginx and certbot installation...${NC}"
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}ERROR: Nginx not found. Installing...${NC}"
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
fi

if ! command -v certbot &> /dev/null; then
    echo -e "${RED}ERROR: Certbot not found. Installing...${NC}"
    apt-get install -y certbot python3-certbot-nginx
fi

# Ensure nginx is running
systemctl start nginx 2>/dev/null || true
systemctl enable nginx 2>/dev/null || true

echo -e "${GREEN}✓ Nginx and certbot verified${NC}"
echo ""

# Step 6: Navigate to project directory
echo -e "${YELLOW}Step 6: Navigating to project directory...${NC}"
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}ERROR: Project directory not found: $PROJECT_DIR${NC}"
    exit 1
fi
cd "$PROJECT_DIR" || exit 1
echo -e "${GREEN}✓ Current directory: $(pwd)${NC}"
echo ""

# Step 7: Install/update npm dependencies (including dev dependencies for build)
echo -e "${YELLOW}Step 7: Installing/updating npm dependencies...${NC}"
echo -e "${YELLOW}This may take a few minutes...${NC}"
npm install --production=false --legacy-peer-deps || npm install --production=false
npm update 2>/dev/null || true
echo -e "${GREEN}✓ Dependencies installed/updated${NC}"
echo ""

# Step 8: Build/rebuild the frontend (will overwrite existing build)
echo -e "${YELLOW}Step 8: Building frontend application...${NC}"
echo -e "${YELLOW}Removing old build if exists...${NC}"
rm -rf dist
npm run build
if [ ! -d "dist" ]; then
    echo -e "${RED}ERROR: Build failed - dist directory not found${NC}"
    exit 1
fi

# Set basic permissions immediately after build (so nginx can access)
find dist -type f -exec chmod 644 {} \; 2>/dev/null || true
find dist -type d -exec chmod 755 {} \; 2>/dev/null || true
chmod 755 dist 2>/dev/null || true

echo -e "${GREEN}✓ Frontend built successfully${NC}"
echo ""

# Step 9: Create storage directory and set proper permissions
echo -e "${YELLOW}Step 9: Creating storage directory and setting permissions...${NC}"

# Determine nginx user (varies by distribution)
NGINX_USER="www-data"
if id "nginx" &>/dev/null; then
    NGINX_USER="nginx"
fi

# Create storage directory (where files will be uploaded - one level up from mainFile)
STORAGE_DIR="/root/projects/Server-File-Manager/creative"
if [ ! -d "$STORAGE_DIR" ]; then
    echo -e "${YELLOW}Creating storage directory: $STORAGE_DIR${NC}"
    mkdir -p "$STORAGE_DIR"
    echo -e "${GREEN}✓ Storage directory created${NC}"
else
    echo -e "${GREEN}✓ Storage directory exists${NC}"
fi

# Set ownership for storage directory (nginx needs read/write for file operations)
chown -R "$NGINX_USER:$NGINX_USER" "$STORAGE_DIR" 2>/dev/null || {
    # If chown fails, set world-writable permissions (less secure but works)
    chmod -R 777 "$STORAGE_DIR" 2>/dev/null || true
    echo -e "${YELLOW}⚠ Using 777 permissions for storage (consider setting proper ownership)${NC}"
}

# Ensure parent directories are accessible for storage
chmod 755 "$(dirname "$STORAGE_DIR")" 2>/dev/null || true  # Server-File-Manager
chmod 755 "$(dirname "$(dirname "$STORAGE_DIR")")" 2>/dev/null || true  # projects
chmod 755 "$(dirname "$(dirname "$(dirname "$STORAGE_DIR")")")" 2>/dev/null || true  # root/projects

# Set ownership for dist folder and all parent directories (nginx needs to read files)
# Make sure parent directories are accessible (at least execute permission for others)
chmod 755 "$PROJECT_DIR" 2>/dev/null || true
chmod 755 "$(dirname "$PROJECT_DIR")" 2>/dev/null || true  # Server-File-Manager directory
chmod 755 "$(dirname "$(dirname "$PROJECT_DIR")")" 2>/dev/null || true  # projects directory
chmod 755 "$(dirname "$(dirname "$(dirname "$PROJECT_DIR")")")" 2>/dev/null || true  # root/projects

# Set ownership and permissions for dist folder
chown -R "$NGINX_USER:$NGINX_USER" "$PROJECT_DIR/dist" 2>/dev/null || {
    # If chown fails, try setting permissions that allow nginx to read
    chmod -R 755 "$PROJECT_DIR/dist" 2>/dev/null || true
    # Make files readable by all, directories executable by all
    find "$PROJECT_DIR/dist" -type f -exec chmod 644 {} \; 2>/dev/null || true
    find "$PROJECT_DIR/dist" -type d -exec chmod 755 {} \; 2>/dev/null || true
}

# Ensure dist directory itself has correct permissions
chmod 755 "$PROJECT_DIR/dist" 2>/dev/null || true

# Verify nginx can access the files
if [ -r "$PROJECT_DIR/dist/index.html" ]; then
    echo -e "${GREEN}✓ Permissions set - nginx can access files${NC}"
else
    echo -e "${YELLOW}⚠ Warning: Checking file permissions...${NC}"
    # Make files readable if they're not
    find "$PROJECT_DIR/dist" -type f ! -perm -004 -exec chmod 644 {} \; 2>/dev/null || true
    find "$PROJECT_DIR/dist" -type d ! -perm -005 -exec chmod 755 {} \; 2>/dev/null || true
    echo -e "${GREEN}✓ Permissions adjusted${NC}"
fi

# Ensure project directory has correct permissions (but keep dist accessible)
chmod 755 "$PROJECT_DIR" 2>/dev/null || true
chmod 644 "$PROJECT_DIR/ftp.conf" 2>/dev/null || true

# Also set permissions for storage directory files (if any exist)
if [ -d "$STORAGE_DIR" ]; then
    find "$STORAGE_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
    find "$STORAGE_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
fi

echo -e "${GREEN}✓ Permissions set (dist and storage directories)${NC}"
echo ""

# Step 9.5: Setup symlinks for nginx access
echo -e "${YELLOW}Step 9.5: Setting up symlinks for nginx access...${NC}"
if [ -f "$PROJECT_DIR/setup-symlinks.sh" ]; then
    chmod +x "$PROJECT_DIR/setup-symlinks.sh"
    bash "$PROJECT_DIR/setup-symlinks.sh"
    echo -e "${GREEN}✓ Symlinks setup complete${NC}"
else
    echo -e "${YELLOW}⚠ Symlink setup script not found - skipping${NC}"
    echo -e "${YELLOW}  Run manually: sudo bash $PROJECT_DIR/setup-symlinks.sh${NC}"
fi
echo ""

# Step 10: Configure/update nginx for frontend and backend
echo -e "${YELLOW}Step 10: Configuring nginx for frontend and backend...${NC}"

# Configure Frontend nginx (creative.reachableads.com)
if [ ! -f "$PROJECT_DIR/$NGINX_FRONTEND_CONFIG" ]; then
    echo -e "${RED}ERROR: $NGINX_FRONTEND_CONFIG not found in $PROJECT_DIR${NC}"
    exit 1
fi

echo -e "${YELLOW}Configuring frontend nginx (${FRONTEND_DOMAIN})...${NC}"
FRONTEND_SSL_CONFIGURED=false
if [ -f "$NGINX_FRONTEND_SITE" ] && grep -q "ssl_certificate" "$NGINX_FRONTEND_SITE" 2>/dev/null; then
    FRONTEND_SSL_CONFIGURED=true
    echo -e "${GREEN}Frontend SSL configuration detected - preserving SSL settings${NC}"
fi

if [ "$FRONTEND_SSL_CONFIGURED" = true ]; then
    # SSL exists - backup current config
    cp "$NGINX_FRONTEND_SITE" "$NGINX_FRONTEND_SITE.backup"
    
    # Check if creative directory serving is already configured
    if ! grep -q "@react_fallback" "$NGINX_FRONTEND_SITE" 2>/dev/null; then
        # New location blocks for creative directory not present - need to add them
        echo -e "${YELLOW}Updating frontend nginx config with creative directory serving...${NC}"
        
        # Copy new config template
        cp "$PROJECT_DIR/$NGINX_FRONTEND_CONFIG" "$NGINX_FRONTEND_SITE"
        
        # Try to restore SSL configuration automatically using certbot
        if command -v certbot &> /dev/null; then
            echo -e "${YELLOW}Restoring SSL configuration with certbot...${NC}"
            certbot --nginx -d "$FRONTEND_DOMAIN" --non-interactive --quiet --redirect 2>/dev/null && {
                echo -e "${GREEN}✓ SSL configuration restored${NC}"
            } || {
                echo -e "${YELLOW}⚠ Certbot restore failed - SSL may need manual configuration${NC}"
                echo -e "${YELLOW}  You can restore from backup: cp $NGINX_FRONTEND_SITE.backup $NGINX_FRONTEND_SITE${NC}"
                echo -e "${YELLOW}  Or run manually: certbot --nginx -d $FRONTEND_DOMAIN${NC}"
            }
        else
            echo -e "${YELLOW}⚠ Certbot not found - SSL configuration not restored${NC}"
            echo -e "${YELLOW}  Restore from backup or run: certbot --nginx -d $FRONTEND_DOMAIN${NC}"
        fi
        
        echo -e "${GREEN}✓ Frontend nginx config updated with creative directory serving${NC}"
    else
        # Creative directory serving already configured - just update basic settings if needed
        if ! grep -q "root /root/projects/Server-File-Manager/mainFile/dist" "$NGINX_FRONTEND_SITE" 2>/dev/null; then
            sed -i "s|root .*;|root /root/projects/Server-File-Manager/mainFile/dist;|g" "$NGINX_FRONTEND_SITE" 2>/dev/null || true
        fi
        if ! grep -q "server_name ${FRONTEND_DOMAIN}" "$NGINX_FRONTEND_SITE" 2>/dev/null; then
            sed -i "s|server_name .*;|server_name ${FRONTEND_DOMAIN};|g" "$NGINX_FRONTEND_SITE" 2>/dev/null || true
        fi
        echo -e "${GREEN}✓ Frontend nginx config updated (SSL preserved)${NC}"
    fi
else
    cp "$PROJECT_DIR/$NGINX_FRONTEND_CONFIG" "$NGINX_FRONTEND_SITE"
    echo -e "${GREEN}✓ Frontend nginx config copied${NC}"
fi

# Enable frontend site
if [ -L "$NGINX_FRONTEND_ENABLED" ]; then
    rm "$NGINX_FRONTEND_ENABLED"
fi
ln -s "$NGINX_FRONTEND_SITE" "$NGINX_FRONTEND_ENABLED"

# Configure Backend nginx (api.creative.reachableads.com)
if [ ! -f "$PROJECT_DIR/$NGINX_BACKEND_CONFIG" ]; then
    echo -e "${RED}ERROR: $NGINX_BACKEND_CONFIG not found in $PROJECT_DIR${NC}"
    exit 1
fi

echo -e "${YELLOW}Configuring backend nginx (${BACKEND_DOMAIN})...${NC}"
BACKEND_SSL_CONFIGURED=false
if [ -f "$NGINX_BACKEND_SITE" ] && grep -q "ssl_certificate" "$NGINX_BACKEND_SITE" 2>/dev/null; then
    BACKEND_SSL_CONFIGURED=true
    echo -e "${GREEN}Backend SSL configuration detected - preserving SSL settings${NC}"
fi

if [ "$BACKEND_SSL_CONFIGURED" = true ]; then
    # SSL exists - only update proxy settings if needed
    cp "$NGINX_BACKEND_SITE" "$NGINX_BACKEND_SITE.backup"
    if ! grep -q "proxy_pass http://localhost:3000" "$NGINX_BACKEND_SITE" 2>/dev/null; then
        sed -i "s|proxy_pass .*;|proxy_pass http://localhost:3000;|g" "$NGINX_BACKEND_SITE" 2>/dev/null || true
    fi
    if ! grep -q "server_name ${BACKEND_DOMAIN}" "$NGINX_BACKEND_SITE" 2>/dev/null; then
        sed -i "s|server_name .*;|server_name ${BACKEND_DOMAIN};|g" "$NGINX_BACKEND_SITE" 2>/dev/null || true
    fi
    echo -e "${GREEN}✓ Backend nginx config updated (SSL preserved)${NC}"
else
    cp "$PROJECT_DIR/$NGINX_BACKEND_CONFIG" "$NGINX_BACKEND_SITE"
    echo -e "${GREEN}✓ Backend nginx config copied${NC}"
fi

# Enable backend site
if [ -L "$NGINX_BACKEND_ENABLED" ]; then
    rm "$NGINX_BACKEND_ENABLED"
fi
ln -s "$NGINX_BACKEND_SITE" "$NGINX_BACKEND_ENABLED"

# Test nginx configuration
if nginx -t; then
    echo -e "${GREEN}✓ Nginx configuration is valid${NC}"
else
    echo -e "${RED}ERROR: Nginx configuration test failed${NC}"
    # Restore backups if they exist
    if [ "$FRONTEND_SSL_CONFIGURED" = true ] && [ -f "$NGINX_FRONTEND_SITE.backup" ]; then
        cp "$NGINX_FRONTEND_SITE.backup" "$NGINX_FRONTEND_SITE"
    fi
    if [ "$BACKEND_SSL_CONFIGURED" = true ] && [ -f "$NGINX_BACKEND_SITE.backup" ]; then
        cp "$NGINX_BACKEND_SITE.backup" "$NGINX_BACKEND_SITE"
    fi
    nginx -t
    exit 1
fi

# Reload nginx
systemctl reload nginx
echo -e "${GREEN}✓ Nginx configured and reloaded (frontend + backend)${NC}"
echo ""

# Step 11: Setup/renew SSL certificates for both frontend and backend
echo -e "${YELLOW}Step 11: Setting up/renewing SSL certificates with certbot...${NC}"

# Setup SSL for Frontend (creative.reachableads.com)
if [ ! -f "/etc/letsencrypt/live/${FRONTEND_DOMAIN}/fullchain.pem" ]; then
    echo -e "${YELLOW}Frontend SSL certificate not found. Running certbot for ${FRONTEND_DOMAIN}...${NC}"
    certbot --nginx -d "$FRONTEND_DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || {
        echo -e "${YELLOW}⚠ Frontend certbot failed. This is OK if:${NC}"
        echo -e "${YELLOW}  1. DNS doesn't point to this server yet${NC}"
        echo -e "${YELLOW}  2. Port 80 is not open${NC}"
        echo -e "${YELLOW}  3. Domain is not accessible from internet${NC}"
        echo -e "${YELLOW}Run manually later: certbot --nginx -d $FRONTEND_DOMAIN${NC}"
    }
else
    echo -e "${GREEN}✓ Frontend SSL certificate exists${NC}"
fi

# Setup SSL for Backend (api.creative.reachableads.com)
if [ ! -f "/etc/letsencrypt/live/${BACKEND_DOMAIN}/fullchain.pem" ]; then
    echo -e "${YELLOW}Backend SSL certificate not found. Running certbot for ${BACKEND_DOMAIN}...${NC}"
    certbot --nginx -d "$BACKEND_DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || {
        echo -e "${YELLOW}⚠ Backend certbot failed. This is OK if:${NC}"
        echo -e "${YELLOW}  1. DNS doesn't point to this server yet${NC}"
        echo -e "${YELLOW}  2. Port 80 is not open${NC}"
        echo -e "${YELLOW}  3. Domain is not accessible from internet${NC}"
        echo -e "${YELLOW}Run manually later: certbot --nginx -d $BACKEND_DOMAIN${NC}"
    }
else
    echo -e "${GREEN}✓ Backend SSL certificate exists${NC}"
fi

# Test nginx config after certbot (in case it modified configs)
if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reloaded after SSL configuration${NC}"
else
    echo -e "${YELLOW}⚠ Nginx config test failed after certbot. Check manually.${NC}"
fi

# Renew certificates if they exist (safe to run multiple times)
echo -e "${YELLOW}Checking certificate expiry...${NC}"
certbot renew --quiet || true
echo -e "${GREEN}✓ SSL certificates checked/renewed${NC}"
echo ""

# Step 12: Setup/update PM2 for backend (required for API)
if [ -f "$PROJECT_DIR/server.js" ]; then
    echo -e "${YELLOW}Step 12: Setting up/updating PM2 for backend...${NC}"
    if ! command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}Installing PM2 globally...${NC}"
        npm install -g pm2
        echo -e "${GREEN}✓ PM2 installed${NC}"
    fi
    
    cd "$PROJECT_DIR"
    
    # Check if .env file exists, create/update one if needed
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        echo -e "${YELLOW}Creating .env file from template...${NC}"
        cat > "$PROJECT_DIR/.env" << EOF
# Production Environment Variables
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://creative.reachableads.com
FM_USERNAME=reachable
FM_PASSWORD=Reachable@2025#
SESSION_SECRET=I_AM_SNIGDHO
EOF
        echo -e "${YELLOW}⚠ Please edit .env file with your production values!${NC}"
    else
        echo -e "${GREEN}✓ .env file exists${NC}"
        # Update FRONTEND_URL if it's different (but preserve other values)
        if ! grep -q "FRONTEND_URL=https://creative.reachableads.com" "$PROJECT_DIR/.env" 2>/dev/null; then
            if grep -q "^FRONTEND_URL=" "$PROJECT_DIR/.env" 2>/dev/null; then
                sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://creative.reachableads.com|g" "$PROJECT_DIR/.env"
            else
                echo "FRONTEND_URL=https://creative.reachableads.com" >> "$PROJECT_DIR/.env"
            fi
            echo -e "${GREEN}✓ Updated FRONTEND_URL in .env${NC}"
        fi
    fi
    
    # Handle PM2 process (restart if exists, start if not)
    if pm2 list | grep -q "filemanager-api"; then
        echo -e "${YELLOW}PM2 process 'filemanager-api' exists. Restarting with updated code...${NC}"
        pm2 delete filemanager-api 2>/dev/null || true
        sleep 1
    fi
    
    # Start backend with PM2 (PM2 automatically loads .env from project directory)
    echo -e "${YELLOW}Starting backend with PM2...${NC}"
    cd "$PROJECT_DIR"
    
    # Verify .env file exists and is readable
    if [ -f "$PROJECT_DIR/.env" ]; then
        echo -e "${GREEN}✓ .env file found - PM2 will load it automatically${NC}"
    else
        echo -e "${YELLOW}⚠ .env file not found - backend will use defaults${NC}"
    fi
    
    # PM2 automatically loads .env file from project directory when starting
    # Use --update-env to reload environment variables on restart
    pm2 start server.js --name filemanager-api --update-env
    pm2 save
    
    # Setup PM2 to start on boot (safe to run multiple times)
    pm2 startup systemd -u root --hp /root | grep -v "PM2" | bash 2>/dev/null || true
    
    # Wait a moment and check status
    sleep 3
    if pm2 list | grep -q "filemanager-api.*online"; then
        echo -e "${GREEN}✓ Backend is running on port 3000${NC}"
        echo -e "${GREEN}✓ API available at: https://api.creative.reachableads.com${NC}"
    else
        echo -e "${YELLOW}⚠ Backend may not be running. Checking logs...${NC}"
        pm2 logs filemanager-api --lines 20 --nostream || true
        echo -e "${YELLOW}Check manually: pm2 status${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}Step 12: server.js not found - skipping backend setup${NC}"
    echo -e "${YELLOW}⚠ Backend must be configured separately on api.creative.reachableads.com${NC}"
    echo ""
fi

# Step 13: Configure firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    echo -e "${YELLOW}Step 13: Configuring firewall...${NC}"
    
    # Check if firewall is already enabled
    if ufw status | grep -q "Status: active"; then
        echo -e "${GREEN}✓ Firewall is already enabled${NC}"
    else
        echo -e "${YELLOW}Enabling firewall...${NC}"
        # Allow SSH first to prevent lockout (important!)
        ufw allow 22/tcp 2>/dev/null || true
        echo "y" | ufw --force enable 2>/dev/null || true
    fi
    
    # Allow SSH (port 22) - critical for server access
    ufw allow 22/tcp 2>/dev/null || true
    echo -e "${GREEN}✓ SSH (port 22) allowed${NC}"
    
    # Allow HTTP and HTTPS (ports 80 and 443) via Nginx Full profile
    ufw allow 'Nginx Full' 2>/dev/null || true
    echo -e "${GREEN}✓ Nginx Full (ports 80, 443) allowed${NC}"
    
    # Allow backend API port 3000 (though nginx proxies, this ensures direct access works if needed)
    ufw allow 3000/tcp 2>/dev/null || true
    echo -e "${GREEN}✓ Backend API (port 3000) allowed${NC}"
    
    # Show firewall status
    echo -e "${YELLOW}Current firewall status:${NC}"
    ufw status numbered 2>/dev/null || ufw status
    
    echo -e "${GREEN}✓ Firewall configured${NC}"
    echo ""
else
    echo -e "${YELLOW}Step 13: ufw not found - skipping firewall configuration${NC}"
    echo -e "${YELLOW}⚠ Please configure firewall manually to allow ports 22, 80, 443, and 3000${NC}"
    echo ""
fi

# Final summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Frontend: ${GREEN}https://${FRONTEND_DOMAIN}${NC}"
echo -e "Backend: ${GREEN}https://${BACKEND_DOMAIN}${NC}"
echo ""
echo -e "Project directory: ${YELLOW}${PROJECT_DIR}${NC}"
echo -e "Frontend nginx config: ${YELLOW}${NGINX_FRONTEND_SITE}${NC}"
echo -e "Backend nginx config: ${YELLOW}${NGINX_BACKEND_SITE}${NC}"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo -e "  Check nginx status: ${GREEN}systemctl status nginx${NC}"
echo -e "  Check PM2 status: ${GREEN}pm2 status${NC}"
echo -e "  View PM2 logs: ${GREEN}pm2 logs filemanager-api${NC}"
echo -e "  View nginx logs: ${GREEN}tail -f /var/log/nginx/error.log${NC}"
echo -e "  Reload nginx: ${GREEN}systemctl reload nginx${NC}"
echo -e "  Restart backend: ${GREEN}pm2 restart filemanager-api${NC}"
echo -e "  Check firewall status: ${GREEN}ufw status${NC}"
echo -e "  Allow port: ${GREEN}ufw allow <port>/tcp${NC}"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo -e "  - Edit ${YELLOW}$PROJECT_DIR/.env${NC} with your production credentials"
echo -e "  - After editing .env, restart backend: ${GREEN}pm2 restart filemanager-api${NC}"
echo -e "  - Ensure DNS points to this server for SSL to work"
echo ""
echo -e "${GREEN}Your application is now live and up to date!${NC}"
echo ""
echo -e "${YELLOW}📝 To update your application, simply run this script again:${NC}"
echo -e "  ${GREEN}sudo bash deploy.sh${NC}"
echo -e "${YELLOW}The script will:${NC}"
echo -e "  ✓ Update dependencies"
echo -e "  ✓ Rebuild frontend"
echo -e "  ✓ Update nginx config (preserving SSL)"
echo -e "  ✓ Restart backend"
echo -e "  ✓ Renew SSL certificates if needed"
echo ""

