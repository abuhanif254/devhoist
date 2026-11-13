# DevHost Compute & Build Agent (`devhost-agent`)

Standalone authenticated runtime daemon for DevHost VPS nodes (`SG1` / `US1`).

## Features
- Mutually authenticated HMAC-SHA256 control protocol (`X-DevHost-Timestamp`, `X-DevHost-Signature`, `Authorization: Bearer`)
- Docker isolated container lifecycle with memory/CPU quotas
- Per-domain Caddy reverse proxy site generation & zero-downtime reloads
- PostgreSQL 16 & MySQL 8 database/user provisioning
- Path-safe tenant workspace file manager & jailed SSH execution
- Signed webhook callbacks back to `/api/compute/agent-callback`

## Quick Start on Ubuntu / Debian VPS
```bash
export DEVHOST_COMPUTE_AGENT_SECRET="<same-64-char-hex-secret-as-control-plane>"
export POSTGRES_PASSWORD="<strong-pg-password>"
export MYSQL_ROOT_PASSWORD="<strong-mysql-password>"
docker compose up -d --build
```
Set `COMPUTE_AGENT_URL=https://agent-sg1.yourdomain.com` (behind TLS or Cloudflare Tunnel) and `DEVHOST_COMPUTE_AGENT_SECRET` in the DevHost Control Plane.
