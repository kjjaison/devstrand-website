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

#### Open from the laptop (SSH tunnel required)

Do **not** open http://148.113.179.108:9000 in the browser — those ports are bound to `127.0.0.1` on the VPS only.

```bash
ssh -L 9000:127.0.0.1:9000 -L 9443:127.0.0.1:9443 -L 8081:127.0.0.1:8081 ubuntu@148.113.179.108
```

Keep that session open, then:

| UI | URL on laptop | Notes |
|----|----------------|--------|
| **Portainer** | https://localhost:9443 | Accept the self-signed cert warning |
| Portainer (HTTP) | http://localhost:9000 | Works when `--http-enabled` is set |
| **Dozzle** | http://localhost:8081 | Live container logs |

First Portainer visit: create the admin user within a few minutes, then choose **Get Started** → local Docker environment.

Optional `~/.ssh/config` (Windows: `%USERPROFILE%\.ssh\config`):

```
Host ovh-tools
  HostName 148.113.179.108
  User ubuntu
  LocalForward 9000 127.0.0.1:9000
  LocalForward 9443 127.0.0.1:9443
  LocalForward 8081 127.0.0.1:8081
```

Then: `ssh ovh-tools` and open the URLs above.

#### If Portainer / Dozzle still fail

1. **Wrong URL** — public IP ports won’t work; use the SSH tunnel + `localhost`.
2. **Tunnel not running** — browser connection refused until `ssh -L ...` is connected.
3. **Containers not started** — run the `docker compose ... up -d portainer dozzle` commands above.
4. **Portainer blank / SSL error** — use `https://localhost:9443` and proceed past the cert warning.
5. **Portainer “admin password already set”** — reset data once (destroys Portainer settings only):

```bash
docker compose -f docker-compose.yml -f docker-compose.ops.yml stop portainer
docker volume rm tools_portainer_data
docker compose -f docker-compose.yml -f docker-compose.ops.yml up -d portainer
```

6. **Dozzle empty** — user must be in the `docker` group; socket mount must be `/var/run/docker.sock`.
7. **Windows local port busy** — change local side, e.g. `-L 19000:127.0.0.1:9000` then open http://localhost:19000.
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
