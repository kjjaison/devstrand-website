# DevStrand Tools (`tools.devstrand.com`)

PDF & document utilities for DevStrand. Runs in **Docker** (LibreOffice + FastAPI).  
**Not for GitHub Pages.**

## Features

| Tool | Notes |
|------|--------|
| Merge / Split / Compress PDF | `pypdf` |
| Edit PDF | Header/footer text + rotate |
| Watermark PDF | Diagonal text stamp |
| PDF ↔ JPG | Poppler + Pillow |
| JPG → PDF | Pillow |
| Word → PDF / Excel → PDF | LibreOffice |
| PDF → Word | LibreOffice or `pdf2docx` |
| PDF → Excel | Table/text extract (`pdfplumber`) |
| PDF → PowerPoint | One image slide per page |

Upload limit default: **25 MB** (Compress PDF: **100 MB**).

---

## 1. Run locally (no tunnel)

```bash
cd tools
docker compose up --build tools
```

Open: http://localhost:8080  
Health: http://localhost:8080/api/health  

First build installs LibreOffice and can take several minutes.

---

## 2. Cloudflare Tunnel (no static IP)

This is the recommended way to publish `tools.devstrand.com` from a home PC / laptop with a changing IP. No router port forwarding.

### A. Put the domain on Cloudflare DNS

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com/)
2. **Add site** → `devstrand.com`
3. Cloudflare shows two nameservers (e.g. `ada.ns.cloudflare.com`)
4. In **GoDaddy → DNS → Nameservers** → change from GoDaddy defaults to Cloudflare’s nameservers
5. Wait until Cloudflare shows the domain as **Active** (can take from minutes to a few hours)

> Your main site on GitHub Pages can stay: in Cloudflare DNS, keep/create records for `@` and `www` pointing at GitHub Pages (A records / CNAME) as you already have.

### B. Create the tunnel

1. Cloudflare dashboard → **Zero Trust** (free plan is enough)
2. **Networks** → **Tunnels** → **Create a tunnel**
3. Choose **Cloudflared** → name it e.g. `devstrand-tools`
4. Copy the **token** shown (long string)
5. In this folder:

```bash
copy .env.example .env
```

6. Paste the token into `.env`:

```env
CLOUDFLARE_TUNNEL_TOKEN=eyJ...your-token...
```

### C. Public hostname (routes traffic into Docker)

Still in the tunnel wizard / tunnel **Public Hostname** tab:

| Field | Value |
|-------|--------|
| Subdomain | `tools` |
| Domain | `devstrand.com` |
| Type | `HTTP` |
| URL | `tools:8080` |

Important: use hostname **`tools`** (the Docker Compose service name), **not** `localhost`.  
Both containers share the `toolsnet` network, so `cloudflared` can reach `http://tools:8080`.

Save. Cloudflare will create the DNS CNAME for `tools.devstrand.com` automatically.

### D. Start both containers

```bash
cd tools
docker compose up --build -d
```

Check:

```bash
docker compose ps
docker compose logs -f cloudflared
```

You want to see the tunnel **connected**. Then open:

https://tools.devstrand.com

HTTPS is handled by Cloudflare — no Let's Encrypt on your PC.

### E. Keep it online

- Docker Desktop must be running  
- PC must be on  
- Containers set to `restart: unless-stopped`  

For 24/7 uptime without leaving a PC on, move the same `docker compose` stack to a cheap VPS later (token still works).

---

## Useful commands

```bash
# Start
docker compose up -d

# Rebuild after code changes
docker compose up --build -d

# Stop
docker compose down

# Logs
docker compose logs -f tools
docker compose logs -f cloudflared
```

---

## Security notes

- Do **not** commit `.env` (token = full access to the tunnel)
- Prefer Cloudflare Access (email login) later if the tools should not be fully public
- Files are processed in temp dirs; add cleanup for long-running hosts
- Increase limit with `MAX_UPLOAD_MB` in `docker-compose.yml` if needed

---

## Project layout

```
tools/
  Dockerfile
  docker-compose.yml   # tools + cloudflared
  .env.example
  backend/
  frontend/
```
