# OVH remote ops — Steps 9 & 10

Use these after tools are running on the OVH VPS. Replace `148.113.179.108` and paths if your layout differs.

Assumed layout on the VPS:

```text
/opt/devstrand/devstrand-website/tools
```

SSH user example: `ubuntu`.

---

## Step 9 — Day-to-day commands (laptop → VPS)

### 9.1 SSH and check containers

```bash
ssh ubuntu@148.113.179.108

cd /opt/devstrand/devstrand-website/tools
docker compose ps
docker compose logs -f tools
docker compose logs -f cloudflared
```

Health check on the VPS:

```bash
curl -s http://127.0.0.1:18080/api/health
```

### 9.2 One-shot commands from the laptop

```bash
ssh ubuntu@148.113.179.108 "docker ps"
ssh ubuntu@148.113.179.108 "cd /opt/devstrand/devstrand-website/tools && docker compose logs --tail 100 tools"
```

### 9.3 Portainer & Dozzle

These are **not** in the main compose. Start them with the ops overlay on the VPS:

```bash
ssh ubuntu@148.113.179.108
cd /opt/devstrand/devstrand-website/tools

# get the ops file if missing
git pull

docker compose -f docker-compose.yml -f docker-compose.ops.yml up -d portainer dozzle
docker compose -f docker-compose.yml -f docker-compose.ops.yml ps
docker compose -f docker-compose.yml -f docker-compose.ops.yml logs --tail 50 portainer dozzle
```

Confirm they listen on loopback only:

```bash
ss -lntp | grep -E '9000|9443|8081' || netstat -lntp | grep -E '9000|9443|8081'
curl -sI http://127.0.0.1:9000 | head -5
curl -skI https://127.0.0.1:9443 | head -5
curl -sI http://127.0.0.1:8081 | head -5
```

#### What `ssh -L` does

```bash
ssh -L LOCAL_PORT:127.0.0.1:REMOTE_PORT user@vps
```

It opens a **tunnel** from your laptop to the VPS:

1. On the **laptop**, SSH listens on `LOCAL_PORT`.
2. When you open `http://localhost:LOCAL_PORT`, traffic goes through SSH.
3. On the **VPS**, SSH connects to `127.0.0.1:REMOTE_PORT` (Portainer / Dozzle).

```text
Laptop browser → localhost:19000 → SSH tunnel → VPS 127.0.0.1:9000 → Portainer
```

Portainer and Dozzle stay bound to VPS loopback only (not public on the internet).  
**Only one** `ssh -L` session can own a given local port at a time.

#### Open from the laptop (SSH tunnel required)

Do **not** open `http://148.113.179.108:9000` in the browser — those ports are bound to `127.0.0.1` on the VPS only.

**Recommended** (uses free laptop ports `19000` / `19443` / `18081` so you avoid “Address already in use” on 9000/9443/8081):

1. Close every other SSH window to the VPS.
2. Start **one** tunnel and leave it open:

```bash
ssh -L 19000:127.0.0.1:9000 -L 19443:127.0.0.1:9443 -L 18081:127.0.0.1:8081 ubuntu@148.113.179.108
```

3. Open in the browser:

| UI | URL on laptop | Notes |
|----|----------------|--------|
| **Portainer** | https://localhost:19443 | Accept the self-signed cert warning |
| Portainer (HTTP) | http://localhost:19000 | Works when `--http-enabled` is set |
| **Dozzle** | http://localhost:18081 | Live container logs |

First Portainer visit: create the admin user within a few minutes, then choose **Get Started** → local Docker environment.

Same ports as VPS (only if laptop ports 9000/9443/8081 are free):

```bash
ssh -L 9000:127.0.0.1:9000 -L 9443:127.0.0.1:9443 -L 8081:127.0.0.1:8081 ubuntu@148.113.179.108
```

Then use https://localhost:9443 / http://localhost:9000 / http://localhost:8081.

Optional `~/.ssh/config` (Windows: `%USERPROFILE%\.ssh\config`):

```
Host ovh-tools
  HostName 148.113.179.108
  User ubuntu
  LocalForward 19000 127.0.0.1:9000
  LocalForward 19443 127.0.0.1:9443
  LocalForward 18081 127.0.0.1:8081
```

Then: `ssh ovh-tools` and open https://localhost:19443 and http://localhost:18081.

#### Clean restart (VPS + laptop)

On the **VPS**:

```bash
cd /opt/devstrand/devstrand-website/tools
git pull
docker compose -f docker-compose.yml -f docker-compose.ops.yml stop portainer dozzle
docker compose -f docker-compose.yml -f docker-compose.ops.yml rm -f portainer dozzle
docker compose -f docker-compose.yml -f docker-compose.ops.yml up -d portainer dozzle
docker compose -f docker-compose.yml -f docker-compose.ops.yml ps
```

On the **laptop** (PowerShell) — free stuck tunnels, then reconnect once:

```powershell
Get-Process ssh -ErrorAction SilentlyContinue | Stop-Process -Force
ssh -L 19000:127.0.0.1:9000 -L 19443:127.0.0.1:9443 -L 18081:127.0.0.1:8081 ubuntu@148.113.179.108
```

#### If Portainer / Dozzle still fail

1. **Wrong URL** — public IP ports won’t work; use the SSH tunnel + `localhost`.
2. **Tunnel not running** — browser connection refused until `ssh -L ...` is connected.
3. **Containers not started** — run the `docker compose ... up -d portainer dozzle` commands above.
4. **Portainer blank / SSL error** — use `https://localhost:19443` (or `:9443`) and proceed past the cert warning.
5. **`bind ... Address already in use`** — a previous `ssh -L` on the laptop still owns that port. Close other SSH windows, or:

```powershell
netstat -ano | findstr "LISTENING" | findstr ":9000 :9443 :8081 :19000 :19443 :18081"
Get-Process ssh -ErrorAction SilentlyContinue | Stop-Process -Force
```

Then start **one** new tunnel with the recommended `19000` / `19443` / `18081` command. Do not run a second `ssh -L` while the first is open.

6. **Portainer “admin password already set”** — reset data once (destroys Portainer settings only):

```bash
docker compose -f docker-compose.yml -f docker-compose.ops.yml stop portainer
docker volume rm tools_portainer_data
docker compose -f docker-compose.yml -f docker-compose.ops.yml up -d portainer
```

7. **Dozzle empty** — user must be in the `docker` group; socket mount must be `/var/run/docker.sock`.

### 9.4 Docker context (optional)

Run local `docker` / `docker compose` against the VPS:

```bash
docker context create ovh --docker "host=ssh://ubuntu@148.113.179.108"
docker context use ovh

docker ps
docker compose -f /opt/devstrand/devstrand-website/tools/docker-compose.yml ps
docker compose -f /opt/devstrand/devstrand-website/tools/docker-compose.yml logs -f tools
```

Switch back to the laptop Docker engine:

```bash
docker context use default
```

---

## Step 10 — Updates after code changes

### 10.1 Normal frontend / backend changes

1. On the laptop: commit and push to GitHub.
2. On the VPS:

```bash
ssh ubuntu@148.113.179.108
cd /opt/devstrand/devstrand-website/tools
git pull
docker compose up --build -d
```

With `./frontend` and `./backend` mounted:

- Many **JS/CSS/HTML** changes apply after a hard refresh.
- **Python** usually reloads with `uvicorn --reload`.
- Still run `up --build -d` after a pull so the container matches the repo.

### 10.2 When you must rebuild

Rebuild after changes to:

- `Dockerfile`
- `backend/requirements.txt`
- system packages inside the image (LibreOffice, Tesseract, etc.)

```bash
cd /opt/devstrand/devstrand-website/tools
git pull
docker compose build --no-cache tools
docker compose up -d
```

### 10.3 Env / SMTP / tunnel token changes

```bash
cd /opt/devstrand/devstrand-website/tools
nano .env
docker compose up -d --force-recreate tools cloudflared
```

Never commit `.env`. Keep only **one** `cloudflared` running (VPS **or** PC, not both).

### 10.4 Verify after an update

```bash
docker compose ps
curl -s http://127.0.0.1:18080/api/health
docker compose logs --tail 50 tools
```

Then open https://tools.devstrand.com and smoke-test merge / OCR briefly.

---

## Step 11 — Usage analytics (full analysis)

Logged per request (when enabled): **IP**, **country** (`CF-IPCountry` via Cloudflare), **UTC time**, **tool** (merge/compress/…), **file name + size**, **share create/download**, email sends.

### On the VPS `.env`

```bash
cd /opt/devstrand/devstrand-website/tools
nano .env
```

Add:

```env
USAGE_LOG_ENABLED=true
USAGE_ADMIN_TOKEN=paste-a-long-random-secret
```

Generate a token:

```bash
openssl rand -hex 24
```

Apply:

```bash
docker compose up -d --force-recreate tools
```

### View analysis

```bash
# Full summary JSON
curl -s -H "X-Usage-Token: YOUR_TOKEN" http://127.0.0.1:18080/api/admin/usage | python3 -m json.tool

# Raw recent lines
docker compose exec tools tail -n 100 /tmp/devstrand-tools/usage/events.jsonl
```

From the laptop (through the public hostname):

```bash
curl -s -H "X-Usage-Token: YOUR_TOKEN" https://tools.devstrand.com/api/admin/usage
```

Country is reliable when users hit `tools.devstrand.com` through Cloudflare. Direct `127.0.0.1:18080` tests often show country `XX`.
