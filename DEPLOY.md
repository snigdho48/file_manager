# Deploy Guide — CrowdWork360 File Manager

One-click install on a fresh Ubuntu/Debian server (nginx + SSL + PM2).

## What you need

- Ubuntu 20.04+ / Debian 11+ (root/sudo)
- One domain with DNS **A** record pointing at this server (e.g. `files.example.com`)
- Ports **80** and **443** open

## One-click deploy

```bash
cd /path/to/your/repo/mainFile
sudo bash deploy.sh
```

The script asks for **one URL only**:

```text
DEPLOY_FRONTEND_URL=
```

Example:

```text
https://files.example.com
```

API is automatically the same host under `/api`:

```text
https://files.example.com/api
```

| Input | Empty Enter |
|--------|-------------|
| `DEPLOY_FRONTEND_URL` | Keep existing `FRONTEND_URL` in `.env` (required on first deploy) |

Then: username / password → confirm → full install.

### Non-interactive (optional)

```bash
sudo DEPLOY_FRONTEND_URL=https://files.example.com bash deploy.sh
```

## How traffic works

| Piece | Role |
|--------|------|
| Nginx (your domain) | Serves UI + files; proxies `/api` and `/download/file` → Node `:3000` |
| Express (`server.js`) | Auth, uploads, downloads, search, zip/extract |
| Storage | Sibling folder `../creative` (or `STORAGE_DIR` in `.env`) |

**Sessions:** same-origin `/api` (`API_URL: ''` in `config.js`) — no separate API subdomain.

## Local development

```bash
cd mainFile
cp .env.example .env   # optional
npm install
npm run dev            # API + Vite (proxy /api → :3000)
```

## Updating

```bash
cd /path/to/mainFile
sudo bash deploy.sh
```

Leave `DEPLOY_FRONTEND_URL` empty to keep `.env`; rebuild + restart still run.

## Useful commands

```bash
pm2 status
pm2 logs filemanager-api
pm2 restart filemanager-api
sudo nginx -t && sudo systemctl reload nginx
sudo certbot renew
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Login fails / 401 | `config.js` has `API_URL: ''` and nginx has `location /api/` |
| 502 on /api | `pm2 status` / `pm2 start server.js --name filemanager-api` |
| SSL failed | Point DNS first, then `certbot --nginx -d your.domain` |
