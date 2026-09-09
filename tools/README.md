# DevStrand Tools (`tools.devstrand.com`)

PDF & document utilities for DevStrand. Runs in **Docker** (LibreOffice + FastAPI).  
**Not for GitHub Pages.**

## Features

| Tool | Notes |
|------|--------|
| Merge / Split / Compress PDF | `pypdf` + Ghostscript (compress levels: low → maximum) |
| Edit PDF | Header/footer text + rotate |
| Watermark PDF | Diagonal text stamp |
| PDF ↔ JPG | Poppler + Pillow |
| JPG → PDF | Pillow |
| Word → PDF / Excel → PDF | LibreOffice |
| PDF → Word | LibreOffice or `pdf2docx` |
| PDF → Excel | Table/text extract (`pdfplumber`) |
| PDF → PowerPoint | One image slide per page |
| OCR Document | PDF, images, Word/Excel/PowerPoint → searchable PDF (Tesseract / ocrmypdf) |
| E-sign PDF | Draw or upload signature and stamp onto pages |
| Email result | Optional SMTP — send processed file to an address |
| Shareable link | Temporary download URL (15m / 1h / 6h / 24h), then deleted |

Upload limit default: **100 MB** per file. Email attachments default max **20 MB**. Share links default max **50 MB**.

**Privacy:** No permanent document archive. Processing uses temp dirs; share folders are purged on expiry.
---

## Email delivery (optional)

After a tool finishes, users can email a copy of the result. This stays **off** until SMTP is set.

1. Add to `tools/.env` (same file as the tunnel token):

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASSWORD=your-password
SMTP_FROM=tools@devstrand.com
SMTP_TLS=true
```

2. Restart:

```bash
docker compose up -d --force-recreate tools
```

3. Check `GET /api/health` — `"email_enabled": true`.

Common providers: Google Workspace (SMTP relay / app password), Microsoft 365, [Resend](https://resend.com) SMTP, Mailgun SMTP. Use a real From address on a domain you control so messages are less likely to land in spam.

---

## 1. Run locally (no tunnel)

```bash
cd tools
docker compose up --build tools
```

Open: http://127.0.0.1:18080  
Health: http://127.0.0.1:18080/api/health  

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

### C. Published application routes (traffic stays on Docker networks)

In the Cloudflare dashboard: **Networking → Tunnels** → select this tunnel → **Routes** → **Add route** → **Published application**.

Host ports **80 / 443 / 8080** are not used. `cloudflared` reaches apps by Docker DNS on `toolsnet` (and `expense-tracker_default` for the expense tracker). Bind host ports to **127.0.0.1** only, for local testing.

| Subdomain | Domain | Type | Service URL |
|-----------|--------|------|-------------|
| `tools` | `devstrand.com` | HTTP | `http://tools:8080` |
| `pdf` | `devstrand.com` | HTTP | `http://tools:8080` |
| `expensetracker` | `devstrand.com` | HTTP | `http://nginx:80` |

Local browser (not public): PDF tools at http://127.0.0.1:18080 — expense tracker at http://127.0.0.1:18081.

**Do not** use `localhost`, `https://…`, `host.docker.internal`, or a second `docker run cloudflared` (that container is not on Compose networks, so `tools` / `nginx` will not resolve).

Save. Cloudflare creates a proxied CNAME for each hostname automatically.

> Run **only one** cloudflared (the Compose service). Extra connectors with the same token fight each other.
>
> Start the expense-tracker compose stack first so `expense-tracker_default` exists; otherwise `docker compose up` here cannot attach cloudflared to that network.

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
