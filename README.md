# Doc Intelligence - Document Management System

A document management automation platform built on Drupal 7, with AI-powered document processing, review workflows, and a management portal.

## Architecture

| Service | Tech | Default Port | Description |
|---|---|---|---|
| **MariaDB** | MariaDB 10.3 | 3306 | Database (Drupal content + document metadata) |
| **Drupal** | Drupal 7 + ImageMagick | 80 | CMS with custom docman module |
| **Autoprocessor API** | Deno, TypeScript | 8000 | Document ingestion, OCR, classification, filing |
| **Autoprocessor Cron** | Deno, TypeScript | - | Scheduled batch processing (daily at 5pm) |
| **Review UI** | Next.js, React, Tailwind | 3500 | Document review and approval interface |
| **Menu Portal** | Node.js, Express | 5000 | Dashboard / navigation portal |

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed diagrams and environment documentation.

## Quick Start (Developers)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2+)
- Git

### 1. Clone and configure

```bash
git clone https://github.com/quaternaryps/doc-intelligence.git
cd doc-intelligence
cp .env.example .env
```

Edit `.env` and set your database passwords:

```
MYSQL_ROOT_PASSWORD=choose_a_root_password
MYSQL_PASSWORD=choose_a_drupal_password
```

### 2. Build and start

```bash
docker compose up -d --build
```

First build takes a few minutes (4 custom images + MariaDB pull).

### 3. Verify

```bash
docker compose ps
```

| Service | URL |
|---|---|
| Drupal (DMS) | http://localhost:80 |
| Review UI | http://localhost:3500 |
| Menu Portal | http://localhost:5000 |
| Autoprocessor API | http://localhost:8000/health |

### 4. First-time Drupal setup

Visit http://localhost:80 and complete the Drupal installation wizard:

| Field | Value |
|---|---|
| Database name | `drupal` |
| Database username | `drupaluser` |
| Database password | Your `MYSQL_PASSWORD` value |
| Database host | `mariadb` |
| Database port | `3306` |

## Development Workflow

```bash
# Edit code in dms-automation/dms-review-ui/, menu-portal/, etc.

# Rebuild a specific service after changes
docker compose up -d --build review-ui

# View logs
docker compose logs -f autoprocessor-api

# Stop everything
docker compose down

# Fresh start (removes all data)
docker compose down -v
```

## Deployment Environments

This repo supports three deployment modes from the same codebase:

| Environment | Command | Use Case |
|---|---|---|
| **Developer Local** | `docker compose up -d --build` | Self-contained stack for development |
| **Production Server** | `./prod.sh up -d --build` | Connects to existing Drupal/MariaDB |
| **Dev Server** | `./dev.sh up -d --build` | Isolated dev DB on shifted ports |

### Production Server Deployment

Requires the [Infisical CLI](https://infisical.com/docs/cli/overview) for secrets management (falls back to `.env` if not available):

```bash
# Set Infisical credentials in your shell profile
export INFISICAL_CLIENT_ID="your-client-id"
export INFISICAL_CLIENT_SECRET="your-client-secret"

# Deploy
./prod.sh up -d --build
```

### Dev Server Deployment

```bash
# Start dev stack (own MariaDB on :3307, shifted ports)
./dev.sh up -d --build

# Sync production data to dev
./sync-db.sh
```

### Port Allocations

| Service | Developer | Prod Server | Dev Server |
|---|---|---|---|
| MariaDB | 3306 | _(external)_ | 3307 |
| Drupal | 80 | _(external)_ | _(external)_ |
| Review UI | 3500 | 3000 | 3500 |
| Menu Portal | 5000 | 5000 | 5500 |
| Autoprocessor API | 8000 | 8000 | 8500 |

## Port Conflicts

If default ports conflict with other services, override them in `.env`:

```
MARIADB_PORT=3307
DRUPAL_PORT=8080
AUTOPROCESSOR_PORT=8001
REVIEW_UI_PORT=3501
MENU_PORTAL_PORT=5001
```

## Optional: Azure AI Services

For enhanced OCR and document classification, add Azure credentials to `.env`:

```
AZURE_OCR_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_OCR_KEY=your_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your_key
```

## Project Structure

```
doc-intelligence/
├── docker-compose.yml            # Base stack (developer self-contained)
├── docker-compose.server.yml     # Production server overlay
├── docker-compose.dev-server.yml # Dev server overlay
├── prod.sh / dev.sh / sync-db.sh # Server management scripts
├── .env.example                  # Environment template
├── .infisical.json               # Secrets management config
├── ARCHITECTURE.md               # Detailed architecture docs
│
├── docman-docker/                # Drupal CMS stack
│   ├── Dockerfile
│   ├── settings.php
│   ├── drupal-modules/
│   │   ├── docman/               # Custom document management module
│   │   ├── date-time-field/
│   │   └── entity/
│   └── drupal-themes/
│       └── antonelli/
│
└── dms-automation/               # DMS automation services
    ├── dms-autoprocessor/        # Deno document processor
    │   ├── main.ts               # API server
    │   ├── cron.ts               # Cron scheduler
    │   └── lib/                  # Processing pipeline modules
    ├── dms-review-ui/            # Next.js review interface
    │   ├── app/                  # Pages + API routes
    │   └── components/           # React components
    └── menu-portal/              # Express dashboard
        ├── server.js
        └── public/index.html
```
