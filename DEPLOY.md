# Deploy Guide — CrowdWork360 File Manager

One-click install on a fresh Ubuntu/Debian server (nginx + SSL + PM2).

## What you need

- Ubuntu 20.04+ / Debian 11+ (root/sudo)
- A domain with DNS **A** records pointing at this server:
  - Frontend: e.g. `files.example.com`
  - API: e.g. `api.files.example.com`
- Ports **80** and **443** open

## One-click deploy

```bash
cd /path/to/your/repo/mainFile
sudo bash deploy.sh
```

The script asks for:

```text
DEPLOY_FRONTEND_URL=
DEPLOY_BACKEND_DOMAIN=
```

**Examples you can type:**

```text
DEPLOY_FRONTEND_URL=https://files.example.com
DEPLOY_BACKEND_DOMAIN=api.files.example.com
```

Or just the values:

```text
https://files.example.com
api.files.example.com
```

| Input | Empty Enter |
|--------|-------------|
| `DEPLOY_FRONTEND_URL` | Keep existing `FRONTEND_URL` in `.env` (required on first deploy) |
| `DEPLOY_BACKEND_DOMAIN` | Use `api.<frontend-domain>` (or last deploy value) |

Then: username / password → confirm → full install.

### Non-interactive (optional)

```bash
sudo DEPLOY_FRONTEND_URL=https://files.example.com \
     DEPLOY_BACKEND_DOMAIN=api.files.example.com \
     bash deploy.sh
```

## How traffic works

| Piece | Role |
|--------|------|
| Frontend nginx | Serves `dist/`, hosted files from `creative/`, proxies `/api` and `/download/file` to Node |
| API nginx | Optional direct access to Express on `localhost:3000` |
| Express (`server.js`) | Auth, uploads, downloads, search, zip/extract |
| Storage | Sibling folder `../creative` (or `STORAGE_DIR` in `.env`) |

**Sessions:** Production uses **same-origin** `/api` (empty `API_URL` in `config.js`) so cookies work without cross-site tricks.

## Local development

```bash
cd mainFile
cp .env.example .env   # optional
npm install
npm run dev            # API + Vite (proxy /api → :3000)
```

Default login (unless changed in `.env`): see `FM_USERNAME` / `FM_PASSWORD`.

## Updating an existing install

```bash
cd /path/to/mainFile
sudo bash deploy.sh
```

Enter the same domains again. The script rebuilds the frontend, refreshes nginx, and restarts PM2.

## Useful commands

```bash
pm2 status
pm2 logs filemanager-api
pm2 restart filemanager-api
sudo nginx -t && sudo systemctl reload nginx
sudo certbot renew
```

Edit credentials anytime in `mainFile/.env`, then `pm2 restart filemanager-api`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Login fails / 401 loops | Confirm `config.js` has `API_URL: ''` and frontend nginx has `location /api/` |
| 502 on /api | `pm2 status` — start with `pm2 start server.js --name filemanager-api` |
| SSL failed | Point DNS first, then `sudo certbot --nginx -d your.domain` |
| Uploaded HTML 403 | Re-run deploy (symlinks + permissions) or `sudo bash fix-permissions.sh` after updating paths |
| Hosted creative blocked in iframe | Frontend nginx sets `frame-ancestors *` on creative HTML; SPA keeps `X-Frame-Options SAMEORIGIN` |

## Files touched by deploy

- `mainFile/.env` — secrets and domains  
- `mainFile/dist/` — built UI  
- `/etc/nginx/sites-available/<your-domains>`  
- `/var/www/creative/dist/app` → project `dist`  
- `/var/www/creative/uploads/files` → storage folder  
