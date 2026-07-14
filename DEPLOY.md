# Deploy Guide — Reachable File Manager

One-click install on a fresh Ubuntu/Debian server (nginx + SSL + PM2).

## What you need

- Ubuntu 20.04+ / Debian 11+ (root/sudo)
- A domain with DNS **A** records pointing at this server:
  - Frontend: e.g. `files.example.com`
  - API: e.g. `api.files.example.com` (default suggested by the script)
- Ports **80** and **443** open

## One-click deploy

From the `mainFile` folder on the server:

```bash
cd /path/to/your/repo/mainFile
sudo bash deploy.sh
```

The script will ask in the terminal:

1. **FRONTEND_URL** — e.g. `https://creative.reachableads.com`  
   - Leave **empty** to keep the existing value in `.env` (no change)  
   - Enter a new URL/domain to update `.env`  
2. **API domain** (default `api.<frontend>`)  
3. **Admin username / password** (empty password keeps current)

Then it will:

- Install Node.js, nginx, certbot, build tools  
- `npm install` + build the React app  
- Create storage + nginx-friendly symlinks under `/var/www/creative`  
- Write `.env` and `dist/config.js` for your domains  
- Configure nginx (frontend + API), request Let’s Encrypt certs  
- Start the API with PM2 and open the firewall  

When finished, open `https://your-frontend-domain`.

### Non-interactive (CI / automation)

```bash
sudo DEPLOY_FRONTEND_URL=https://files.example.com \
     DEPLOY_BACKEND_DOMAIN=api.files.example.com \
     bash deploy.sh
```

Leave `DEPLOY_FRONTEND_URL` unset and press Enter at the prompt to keep the existing `.env` `FRONTEND_URL`.

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
