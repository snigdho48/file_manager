# Deploy Guide — Reachableads

One-click install on a fresh Ubuntu/Debian server (nginx + SSL + PM2).

## What you need

- Ubuntu 20.04+ / Debian 11+ (root/sudo)
- One domain with DNS **A** record pointing at this server (e.g. `files.example.com`)
- Ports **80** and **443** open
- Optional: a separate API domain if you don’t want same-origin `/api`

## One-click deploy

```bash
cd /path/to/your/repo/mainFile
sudo bash deploy.sh
```

The script asks for:

```text
DEPLOY_FRONTEND_URL=
DEPLOY_BACKEND_URL=
```

| Input | Empty Enter |
|--------|-------------|
| `DEPLOY_FRONTEND_URL` | Keep existing `FRONTEND_URL` in `.env` (required on first deploy) |
| `DEPLOY_BACKEND_URL` | Use the **frontend URL** as the API base (`/api` via nginx) |

Example (same-origin API):

```text
DEPLOY_FRONTEND_URL=https://files.example.com
DEPLOY_BACKEND_URL=
→ API at https://files.example.com/api
```

Example (separate API host):

```text
DEPLOY_FRONTEND_URL=https://files.example.com
DEPLOY_BACKEND_URL=https://api.files.example.com
```

Then: username / password → confirm → full install.

### Non-interactive (optional)

```bash
sudo DEPLOY_FRONTEND_URL=https://files.example.com DEPLOY_BACKEND_URL= bash deploy.sh
```

## How traffic works

| Piece | Role |
|--------|------|
| Nginx (frontend domain) | Serves UI + files; when same-origin, proxies `/api` → Node `:3000` |
| Nginx (API domain, optional) | Proxies API-only host → Node `:3000` |
| Express (`server.js`) | Auth, uploads, downloads, search, zip/extract |
| Storage | Sibling folder `../creative` (or `STORAGE_DIR` in `.env`) |

**Same-origin:** `config.js` uses `API_URL: ''` (browser calls `/api/...`).  
**Separate API:** `config.js` uses the backend origin; cookies use `SameSite=None` + shared parent `COOKIE_DOMAIN` when possible.

## Local development

```bash
cd mainFile
cp .env.example .env   # edit if needed
npm install
npm run server         # API on :3000
npm run dev            # Vite UI (proxies /api)
```

## Login 405

If `POST /api/login` returns **405**, nginx must use `location ^~ /api/` so regex static locations don’t steal the request. `deploy.sh` installs and re-checks that after certbot.

## After logo / branding changes

Rebuild and redeploy so `dist/` gets the new `public/logo.png` / `icon.png`:

```bash
npm run build
sudo bash deploy.sh
```

Hard-refresh the browser (or clear site data) if an old service-worker cached icon remains.
