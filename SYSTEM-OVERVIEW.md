# Doc Intelligence - System Overview

**Last updated:** February 18, 2026
**Repository:** https://github.com/quaternaryps/doc-intelligence

---

## 1. Production System

The production system runs on a single server and serves all end users (receptionists, staff).

**Server:** `dms.ethio-domain.local` (`10.100.128.119`)

### Containers and Ports

| Container | Port | Tech | Purpose |
|---|---|---|---|
| `docman-mariadb` | 3306 | MariaDB 10.3 | Database (Drupal content + document metadata) |
| `docman-drupal` | **80** | Drupal 7 + Apache | Original DMS - document search, browse, view |
| `dms-prod-review-ui` | **3000** | Next.js | Automated review - batch document approval |
| `dms-prod-menu-portal` | **5000** | Node.js Express | Main navigation portal for all systems |
| `dms-prod-autoprocessor-api` | **8000** | Deno TypeScript | Document processing engine (OCR, classification) |
| `dms-prod-autoprocessor-cron` | _(internal)_ | Deno TypeScript | Scheduled batch processing (daily 5pm) |

### User-Facing URLs

| URL | System |
|---|---|
| http://dms.ethio-domain.local | Original DMS (Drupal) - document search and viewing |
| http://dms.ethio-domain.local:3000 | Automated Review - batch document approval with AI |
| http://dms.ethio-domain.local:5000 | Main Menu Portal - entry point for all systems |

### Shared Storage (Host Filesystem)

| Path | Purpose | Access |
|---|---|---|
| `/data/documents/drupal-files/Documents/` | Filed document storage | Read/write by autoprocessor, read by review-ui |
| `/data/documents/drupal-files/Thumbnails/` | Generated PNG previews | Write by autoprocessor, read by review-ui |
| `/data/mysql/mariadb-data/` | Production MariaDB data | Managed by docman-mariadb container |
| `/mnt/nas_company/` | Daily scan folders (MM-DD-YYYY) | Read-only by autoprocessor |
| `/mnt/nas_share/` | Scanner backlog | Read-only by autoprocessor |

### How Production is Started

```bash
cd /home/rabarr/doc-intelligence
./prod.sh up -d --build
```

This uses Docker Compose overlay: `docker-compose.yml` + `docker-compose.server.yml`, which:
- Disables MariaDB and Drupal (they run in the separate `docman-docker` stack)
- Connects DMS services to the existing `docman-docker_docman-network`
- Binds host paths for documents and NAS mounts
- Injects secrets from Infisical

---

## 2. Dev/Test Instance

The dev/test instance runs on the **same server** as production but with isolated ports and its own database. It is used for QA/QC before releasing code changes to production.

**Server:** Same as production (`10.100.128.119`)

### Dev Containers and Ports

| Container | Port | Purpose |
|---|---|---|
| `dms-dev-mariadb` | **3307** | Isolated dev database (synced from prod) |
| `dms-dev-review-ui` | **3500** | Dev review interface |
| `dms-dev-menu-portal` | **5500** | Dev menu portal |
| `dms-dev-autoprocessor-api` | **8500** | Dev processing engine |
| `dms-dev-autoprocessor-cron` | _(internal)_ | Dev cron processor |

### Dev URLs

| URL | System |
|---|---|
| http://dms.ethio-domain.local:3500 | Dev Review UI |
| http://dms.ethio-domain.local:5500 | Dev Menu Portal |

### How Dev/Test is Started

```bash
cd /home/rabarr/doc-intelligence

# Start the dev stack
./dev.sh up -d --build

# Sync production data to dev database
./sync-db.sh
```

### Production vs Dev Side-by-Side

| | Production | Dev/Test |
|---|---|---|
| **Review UI** | :3000 | :3500 |
| **Menu Portal** | :5000 | :5500 |
| **Autoprocessor API** | :8000 | :8500 |
| **MariaDB** | :3306 (shared docman) | :3307 (isolated) |
| **Drupal** | :80 (shared) | :80 (shared, read-only) |
| **Document files** | read/write | read-only |
| **Container prefix** | `dms-prod-*` | `dms-dev-*` |
| **Network** | `docman-docker_docman-network` | `dms-dev-network` |

> **Key safety feature:** Dev has its own MariaDB and read-only access to documents. Code changes on dev cannot corrupt production data.

---

## 3. GitHub Repository (Golden Code)

**Repository:** https://github.com/quaternaryps/doc-intelligence

The GitHub repository is the **single source of truth** for all code. Every change — whether it's a bug fix, new feature, or configuration update — flows through this repo.

### What's in the Repository

```
doc-intelligence/
├── docker-compose.yml              # Base stack (for developers)
├── docker-compose.server.yml       # Production server overlay
├── docker-compose.dev-server.yml   # Dev server overlay
├── prod.sh / dev.sh / sync-db.sh  # Server management scripts
├── .env.example                    # Environment template (no secrets)
├── .infisical.json                 # Infisical workspace config
├── README.md                       # Developer quick start
├── ARCHITECTURE.md                 # Technical architecture details
├── SYSTEM-OVERVIEW.md              # This document
├── docman-docker/                  # Drupal CMS (modules, theme, config)
└── dms-automation/                 # DMS services
    ├── dms-autoprocessor/          # Deno processing engine
    ├── dms-review-ui/              # Next.js review interface
    └── menu-portal/                # Express navigation portal
```

### Code Flow: Development to Production

```
  Developer          GitHub Repo           Production Server
  Workstation        (Golden Code)         (dms.ethio-domain.local)
 +-----------+      +-------------+       +--------------------+
 |           |      |             |       |                    |
 | 1. Clone  |<-----|  main       |       |                    |
 |    repo   |      |  branch     |       |                    |
 |           |      |             |       |                    |
 | 2. Code + |      |             |       |                    |
 |    test   |      |             |       |                    |
 |    locally |      |             |       |                    |
 |           |      |             |       |                    |
 | 3. Push   |----->|  Updated    |       |                    |
 |           |      |  main       |       |                    |
 |           |      |             |       |                    |
 |           |      |             |------>| 4. git pull        |
 |           |      |             |       |                    |
 |           |      |             |       | 5. ./dev.sh up -d  |
 |           |      |             |       |    --build         |
 |           |      |             |       |    (QA on :3500)   |
 |           |      |             |       |                    |
 |           |      |             |       | 6. QA/QC testing   |
 |           |      |             |       |    PASSES          |
 |           |      |             |       |                    |
 |           |      |             |       | 7. ./prod.sh up -d |
 |           |      |             |       |    --build         |
 |           |      |             |       |    (Live on :3000) |
 +-----------+      +-------------+       +--------------------+
```

### Version Control Rules

- **All changes go through GitHub** — no editing files directly on the production server
- **`main` branch** = production-ready code
- **Test before deploying** — always run on dev (:3500) and verify before rebuilding prod (:3000)
- **Secrets never enter the repo** — `.env` is in `.gitignore`, passwords live in Infisical

---

## 4. Secrets Management with Infisical

[Infisical](https://infisical.com) is a cloud-hosted secrets manager that stores all passwords, API keys, and environment-specific configuration. **No passwords are stored in the GitHub repo or in files on the server.**

### How It Works

```
  Infisical Cloud (app.infisical.com)
  +---------------------------------------+
  |  Project: Doc Intelligence            |
  |  Workspace: be6cf11e-...             |
  |                                       |
  |  Environment: prod                    |
  |    MYSQL_PASSWORD=xxxxx               |
  |    NEXT_PUBLIC_API_URL=....:8000      |
  |    ...                                |
  |                                       |
  |  Environment: dev                     |
  |    MYSQL_PASSWORD=xxxxx               |
  |    NEXT_PUBLIC_API_URL=....:8500      |
  |    ...                                |
  +---------------------------------------+
           |                    |
           v                    v
   ./prod.sh               ./dev.sh
   (injects prod           (injects dev
    secrets at               secrets at
    runtime)                 runtime)
           |                    |
           v                    v
   Production               Dev/Test
   Containers               Containers
```

### Secrets Stored in Infisical

| Secret | Prod Value | Dev Value |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | _(stored securely)_ | _(stored securely)_ |
| `MYSQL_DATABASE` | `drupal` | `drupal` |
| `MYSQL_USER` | `drupaluser` | `drupaluser` |
| `MYSQL_PASSWORD` | _(stored securely)_ | _(stored securely)_ |
| `NEXT_PUBLIC_DMS_URL` | `http://dms.ethio-domain.local` | `http://dms.ethio-domain.local` |
| `NEXT_PUBLIC_API_URL` | `http://dms.ethio-domain.local:8000` | `http://dms.ethio-domain.local:8500` |
| `NEXT_PUBLIC_MENU_URL` | `http://dms.ethio-domain.local:5000` | `http://dms.ethio-domain.local:5500` |
| `DRUPAL_BASE_URL` | `http://dms.ethio-domain.local` | `http://dms.ethio-domain.local` |
| `CRON_SCHEDULE` | `0 17 * * *` | `0 17 * * *` |

### Adding a New Secret

When you add a new environment variable (e.g., a new API key):

1. **Add it in Infisical** (app.infisical.com) for both `prod` and `dev` environments
2. **Reference it in `docker-compose.yml`** as `${NEW_VARIABLE_NAME}`
3. **Commit and push** the compose change to GitHub
4. **That's it** — all developers and the server automatically get the new secret via Infisical CLI

> **Developers do NOT need to manually update their `.env` files for secrets managed by Infisical.** The Infisical CLI injects secrets at runtime. Developers who use Infisical get secrets automatically. Developers without Infisical use a local `.env` file and would need to add the variable manually (documented in `.env.example`).

### Who Needs Infisical Access

| Role | Needs Infisical CLI? | How they get secrets |
|---|---|---|
| **Production server** | Yes (installed at `~/bin/infisical`) | `./prod.sh` auto-injects via machine identity |
| **Developer with Infisical** | Yes | Gets a machine identity from admin, secrets auto-inject |
| **Developer without Infisical** | No | Uses `.env` file (copy from `.env.example`, fill in values) |
| **Distributed tester** | Recommended | Same as developer — Infisical or `.env` file |

### Granting Infisical Access to a New Developer

1. Go to https://app.infisical.com → Project → Access Control → Machine Identities
2. Create a new Machine Identity with Universal Auth
3. Grant it access to the `dev` environment (and `prod` if they need prod access)
4. Send the developer their `CLIENT_ID` and `CLIENT_SECRET`
5. Developer adds to their `~/.bashrc`:
   ```bash
   export INFISICAL_UNIVERSAL_AUTH_CLIENT_ID="their-client-id"
   export INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET="their-client-secret"
   ```

---

## 5. New Tester Setup: Clean Ubuntu Server

These instructions set up a complete local dev/test environment on a fresh Ubuntu machine. The tester gets their own self-contained stack (MariaDB, Drupal, all DMS services) — completely independent from production.

### Prerequisites

- Ubuntu 22.04 or 24.04 (server or desktop)
- At least 4 GB RAM, 20 GB disk
- Internet access

### Step-by-Step Setup

#### 1. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

#### 2. Install Git

```bash
sudo apt-get update && sudo apt-get install -y git
```

#### 3. Install Infisical CLI (recommended)

```bash
mkdir -p ~/bin
curl -sL "https://github.com/Infisical/cli/releases/latest/download/cli_0.43.56_linux_amd64.tar.gz" \
  -o /tmp/infisical.tar.gz
# Note: check https://github.com/Infisical/cli/releases for latest version
tar xzf /tmp/infisical.tar.gz -C /tmp/
mv /tmp/infisical ~/bin/
chmod +x ~/bin/infisical
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify
infisical --version
```

#### 4. Configure Infisical Credentials

Get your `CLIENT_ID` and `CLIENT_SECRET` from your project admin, then:

```bash
echo 'export INFISICAL_UNIVERSAL_AUTH_CLIENT_ID="your-client-id"' >> ~/.bashrc
echo 'export INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET="your-client-secret"' >> ~/.bashrc
source ~/.bashrc
```

#### 5. Clone the Repository

```bash
git clone https://github.com/quaternaryps/doc-intelligence.git
cd doc-intelligence
```

#### 6. Start the System

**Option A — With Infisical (recommended):**
```bash
# Secrets are injected automatically
docker compose up -d --build
```

**Option B — Without Infisical:**
```bash
cp .env.example .env
# Edit .env and set your database passwords:
#   MYSQL_ROOT_PASSWORD=choose_a_password
#   MYSQL_PASSWORD=choose_a_password
nano .env

docker compose up -d --build
```

#### 7. Wait for Build (First Time ~5 minutes)

```bash
# Watch build progress
docker compose logs -f

# Check all containers are running
docker compose ps
```

#### 8. Complete Drupal Setup (First Time Only)

Visit http://localhost:80 in your browser and complete the Drupal installation wizard:

| Field | Value |
|---|---|
| Database name | `drupal` |
| Database username | `drupaluser` |
| Database password | Your `MYSQL_PASSWORD` value |
| Database host | `mariadb` |
| Database port | `3306` |

#### 9. Access Your Local System

| Service | URL |
|---|---|
| Drupal (DMS) | http://localhost |
| Review UI | http://localhost:3500 |
| Menu Portal | http://localhost:5000 |
| Autoprocessor API | http://localhost:8000/health |

#### 10. Daily Workflow

```bash
# Pull latest code
cd ~/doc-intelligence
git pull

# Rebuild changed services
docker compose up -d --build

# View logs for a specific service
docker compose logs -f review-ui

# Stop everything
docker compose down

# Full reset (removes database and all data)
docker compose down -v
```

### Troubleshooting

| Problem | Solution |
|---|---|
| Port conflict (e.g., port 80 already in use) | Edit `.env` and set `DRUPAL_PORT=8080` (or other free port) |
| Build fails with memory error | Ensure at least 4 GB RAM available |
| Cannot connect to Docker | Run `sudo usermod -aG docker $USER` and log out/in |
| Infisical auth fails | Verify CLIENT_ID/SECRET, check internet connectivity |

---

## 6. Quick Reference

### Server Commands (Production Admin)

```bash
cd /home/rabarr/doc-intelligence

# Production
./prod.sh up -d --build      # Start/rebuild production
./prod.sh down                # Stop production
./prod.sh logs -f review-ui   # View logs
./prod.sh ps                  # Check status

# Dev/Test
./dev.sh up -d --build        # Start/rebuild dev
./dev.sh down                 # Stop dev
./sync-db.sh                  # Sync prod DB to dev

# Update code from GitHub
git pull
./prod.sh up -d --build       # Rebuild with new code
```

### Key File Locations on Production Server

| Path | Purpose |
|---|---|
| `/home/rabarr/doc-intelligence/` | Git repo (source code) |
| `/home/rabarr/docman-docker/` | Drupal stack (separate compose project) |
| `/data/documents/` | Document storage |
| `/data/mysql/mariadb-data/` | Production database |
| `/data/mysql/dev-mariadb-data/` | Dev database |
| `/mnt/nas_company/` | NAS daily scan folders |
| `/mnt/nas_share/` | NAS scanner backlog |

### Important Links

| Resource | URL |
|---|---|
| GitHub Repository | https://github.com/quaternaryps/doc-intelligence |
| Infisical Dashboard | https://app.infisical.com |
| Production DMS | http://dms.ethio-domain.local |
| Production Review UI | http://dms.ethio-domain.local:3000 |
| Production Menu Portal | http://dms.ethio-domain.local:5000 |
