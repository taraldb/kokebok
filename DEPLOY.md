# Kokebok — Deploy Guide (Unraid)

## Architecture

Single container: Node.js server + SQLite DB in `/data`, static files
in `/app/public`. nginx reverse proxy on Unraid terminates TLS.

---

## First-time deploy

### 1. Pre-migrate existing recipes

If you have existing `recipes/*.json` files, copy them to the data volume
**before** the first boot:

```sh
cp -r /mnt/user/appdata/kokebok-old/recipes \
      /mnt/user/appdata/kokebok/recipes/
```

The container auto-migrates on first boot when the DB is empty and
`/data/recipes/*.json` exist.

### 2. Pull the image

```sh
docker pull ghcr.io/taraldb/kokebok:latest
```

### 3. Run the container

```sh
docker run -d \
  --name kokebok \
  -p 8080:8080 \
  -v /mnt/user/appdata/kokebok:/data \
  -e DATA_DIR=/data \
  --restart unless-stopped \
  ghcr.io/taraldb/kokebok:latest
```

Or via Unraid Community Applications / Docker tab with these settings:

| Field | Value |
|-------|-------|
| Repository | `ghcr.io/taraldb/kokebok:latest` |
| Port | `8080:8080` |
| Path `/data` | `/mnt/user/appdata/kokebok` |
| Environment `DATA_DIR` | `/data` |

#### Volume path requirements

| Container path | Purpose | Required |
|----------------|---------|----------|
| `/data` | SQLite DB (`kokebok.db`) + JSON snapshots | Yes — mount a persistent directory here |
| `/data/recipes/` | Recipe JSON files for first-boot auto-migration | Optional — create and populate before first start to seed the DB |

The server writes the DB to `/data/kokebok.db`. If `/data/recipes/*.json` exist when the DB is empty, they are auto-migrated into SQLite on first boot.

### 4. File permissions

Unraid runs containers as uid 99 (nobody). Fix ownership:

```sh
chown -R 99:100 /mnt/user/appdata/kokebok
```

---

## Reverse proxy (nginx on Unraid)

Update `your-domain.example.conf`:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.example;

    ssl_certificate     /etc/letsencrypt/live/your-domain.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.example/privkey.pem;

    location / {
        proxy_pass http://YOUR_CONTAINER_IP:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Prevent nginx from caching HTML (container handles Cache-Control)
        add_header Cache-Control "no-cache" always;
    }
}

server {
    listen 80;
    server_name your-domain.example;
    return 301 https://$host$request_uri;
}
```

Replace `YOUR_CONTAINER_IP` with the container's IP (visible in Unraid
Docker tab) or use the Unraid host IP if port-mapped.

---

## Updates

### Watchtower (auto-update)

Add the label to the container:

```sh
--label com.centurylinklabs.watchtower.enable=true
```

### Manual update

```sh
docker pull ghcr.io/taraldb/kokebok:latest
docker stop kokebok && docker rm kokebok
# Re-run the docker run command from above
```

---

## Backup

Primary backup target (SQLite DB):
```
/mnt/user/appdata/kokebok/kokebok.db
```

JSON snapshots (redundant safety net, written on every save):
```
/mnt/user/appdata/kokebok/recipes/
```

Recommended: include `/mnt/user/appdata/kokebok/` in your Unraid backup
schedule (CA Backup plugin or Duplicati).

---

## Zero-trust access control (Cloudflare Access)

Protect `/admin/` and `/api/` while keeping the recipe site public.

### Cloudflare Access — two-application setup

**Application 1 — Public site (bypass)**

| Field | Value |
|-------|-------|
| Name | `Kokebok public` |
| Subdomain | `your-domain.example` |
| Path | *(leave empty — matches all paths)* |
| Policy | Action: **Bypass** — no authentication required |

**Application 2 — Admin (protected)**

| Field | Value |
|-------|-------|
| Name | `Kokebok admin` |
| Subdomain | `your-domain.example` |
| Path | `/admin` |
| Policy | Action: **Allow** — add your email or identity provider |

Add a second rule for the API if you want to protect it too:

| Field | Value |
|-------|-------|
| Name | `Kokebok API` |
| Subdomain | `your-domain.example` |
| Path | `/api` |
| Policy | Action: **Allow** — same identity rule as admin |

> **Order matters** — Cloudflare Access matches the most specific path first.
> The `/admin` and `/api` applications will take precedence over the root bypass.

### Cloudflare Tunnel (alternative to nginx)

If using `cloudflared` instead of nginx for ingress:

```yaml
# config.yml for cloudflared
tunnel: <tunnel-id>
credentials-file: /etc/cloudflared/creds.json

ingress:
  - hostname: your-domain.example
    service: http://localhost:8080
  - service: http_status:404
```

Access policies are configured in the Cloudflare Zero Trust dashboard
(Access → Applications) — the tunnel config itself doesn't need path rules.

---

## Admin interface

Available at `https://your-domain.example/admin/` once deployed.

---

## Smoke test after deploy

```sh
curl -s https://your-domain.example/healthz           # → {"ok":true}
curl -s https://your-domain.example/api/recipes | jq length  # → 7+
curl -sI "https://your-domain.example/recipe.html?id=rundstykker" | grep location
# → location: https://your-domain.example/r/rundstykker
```
