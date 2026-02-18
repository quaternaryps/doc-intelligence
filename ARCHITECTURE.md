# Doc Intelligence - Architecture Overview

## System Summary

Doc Intelligence is a document management automation platform for Ethio-American Insurance Company. It extends an existing Drupal 7 DMS with AI-powered batch processing, automated review workflows, and a governance dashboard.

---

## Production Server Layout

```
 Production Server: dms.ethio-domain.local (10.100.128.119)
+------------------------------------------------------------------------+
|                                                                        |
|  +--- docman-docker stack (separate compose project) ---------------+  |
|  |                                                                   |  |
|  |  docman-mariadb (:3306)        docman-drupal (:80)               |  |
|  |  /data/mysql/mariadb-data      Original DMS web interface        |  |
|  |                                                                   |  |
|  +-------------- docman-docker_docman-network -----------------------+  |
|                          |                                             |
|  +--- dms-prod stack (./prod.sh) -------- same network -------------+  |
|  |                                                                   |  |
|  |  autoprocessor-api (:8000)     autoprocessor-cron (internal)     |  |
|  |  Document processing engine    Daily 5pm batch processing        |  |
|  |                                                                   |  |
|  |  review-ui (:3000)             menu-portal (:5000)               |  |
|  |  Next.js review interface      Navigation dashboard              |  |
|  |                                                                   |  |
|  +-------------------------------------------------------------------+  |
|                                                                        |
|  +--- dms-dev stack (./dev.sh) --- separate network ----------------+  |
|  |                                                                   |  |
|  |  dev-mariadb (:3307)           autoprocessor-api (:8500)         |  |
|  |  Own DB (synced from prod)     Dev processing engine             |  |
|  |                                                                   |  |
|  |  review-ui (:3500)             menu-portal (:5500)               |  |
|  |  Dev review interface          Dev navigation                    |  |
|  |                                                                   |  |
|  +-------------------------------------------------------------------+  |
|                                                                        |
|  Shared Filesystem:                                                    |
|    /data/documents/drupal-files/Documents/   (document storage)        |
|    /data/documents/drupal-files/Thumbnails/  (generated previews)      |
|    /mnt/nas_company/                         (daily scan folders)      |
|    /mnt/nas_share/                           (scanner backlog)         |
|                                                                        |
+------------------------------------------------------------------------+
```

---

## Three Deployment Environments

### 1. Developer Local Machine

**Purpose:** Feature development and testing on a developer's laptop/workstation.

**How to start:**
```bash
git clone https://github.com/quaternaryps/doc-intelligence.git
cd doc-intelligence
cp .env.example .env   # edit with local passwords
docker compose up -d --build
```

**What runs:** All 6 services in a self-contained stack with its own MariaDB and Drupal.

**Network:** Internal `doc-intel-network` (isolated, no external dependencies).

**Data:** Docker volumes (ephemeral, can be reset with `docker compose down -v`).

| Service | Port | URL |
|---|---|---|
| MariaDB | 3306 | `localhost:3306` |
| Drupal | 80 | http://localhost |
| Review UI | 3500 | http://localhost:3500 |
| Menu Portal | 5000 | http://localhost:5000 |
| Autoprocessor API | 8000 | http://localhost:8000 |

---

### 2. Production Server

**Purpose:** Live system used by staff for daily document processing.

**How to start:**
```bash
./prod.sh up -d --build
```

**What runs:** 4 DMS services only (autoprocessor-api, autoprocessor-cron, review-ui, menu-portal). MariaDB and Drupal are provided by the separate `docman-docker` stack.

**Network:** External `docman-docker_docman-network` (shared with Drupal/MariaDB).

**Data:** Host bind mounts to persistent storage.

**Secrets:** Injected via [Infisical](https://infisical.com) (falls back to `.env`).

| Service | Port | URL |
|---|---|---|
| MariaDB | 3306 | _(docman-docker stack)_ |
| Drupal | 80 | http://dms.ethio-domain.local |
| Review UI | 3000 | http://dms.ethio-domain.local:3000 |
| Menu Portal | 5000 | http://dms.ethio-domain.local:5000 |
| Autoprocessor API | 8000 | http://dms.ethio-domain.local:8000 |

---

### 3. Dev Server (QA/QC Testing)

**Purpose:** Test code changes before deploying to production. Runs on the same server as production but with isolated database and shifted ports.

**How to start:**
```bash
./dev.sh up -d --build
./sync-db.sh           # copy production data to dev DB
```

**What runs:** 5 services (own MariaDB + 4 DMS services). Uses production Drupal for the legacy UI.

**Network:** Isolated `dms-dev-network`.

**Data:** Own MariaDB at `/data/mysql/dev-mariadb-data`. Shared document filesystem (read-only for safety).

| Service | Port | URL |
|---|---|---|
| Dev MariaDB | 3307 | `localhost:3307` |
| Drupal | 80 | _(production, shared)_ |
| Review UI | 3500 | http://dms.ethio-domain.local:3500 |
| Menu Portal | 5500 | http://dms.ethio-domain.local:5500 |
| Autoprocessor API | 8500 | http://dms.ethio-domain.local:8500 |

---

## Port Allocation Summary

| Service | Developer Local | Production Server | Dev Server |
|---|---|---|---|
| MariaDB | 3306 (own) | 3306 (external) | 3307 (own) |
| Drupal | 80 (own) | 80 (external) | 80 (external) |
| Review UI | 3500 | **3000** | 3500 |
| Menu Portal | 5000 | 5000 | 5500 |
| Autoprocessor API | 8000 | 8000 | 8500 |
| Autoprocessor Cron | _(internal)_ | _(internal)_ | _(internal)_ |

---

## Document Processing Pipeline

```
 Input Sources                    Processing Engine                    Output
+------------------+    +------------------------------------+    +------------------+
|                  |    |                                    |    |                  |
| /mnt/nas_company |    |  autoprocessor-api / cron          |    | MariaDB          |
| (daily folders   |--->|                                    |--->| (document meta-  |
|  MM-DD-YYYY)     |    |  1. folder-scanner.ts  (find PDFs) |    |  data records)   |
|                  |    |  2. file-processor.ts  (pipeline)  |    |                  |
| /mnt/nas_share   |    |  3. file-converter.ts  (PDF conv)  |    | /data/documents/ |
| (scanner backlog)|--->|  4. ocr-service.ts     (OCR text)  |--->| Documents/       |
|                  |    |  5. ai-classifier.ts   (AI class)  |    | (filed copies)   |
| Browse & Import  |    |  6. duplicate-checker.ts           |    |                  |
| (manual upload   |--->|  7. thumbnail-gen.ts   (previews)  |--->| Thumbnails/      |
|  via Review UI)  |    |  8. mysql-writer.ts    (save)      |    | (PNG previews)   |
|                  |    |                                    |    |                  |
+------------------+    +------------------------------------+    +------------------+
                                      |
                                      v
                        +------------------------------------+
                        |  review-ui (Next.js)               |
                        |                                    |
                        |  - Document queue display          |
                        |  - Thumbnail preview + zoom        |
                        |  - Metadata editing                |
                        |  - Approval workflow               |
                        |  - Governance dashboard            |
                        |  - Backlog log viewer              |
                        +------------------------------------+
```

---

## Secrets Management

### For Developers
- Copy `.env.example` to `.env` and fill in passwords
- `.env` is in `.gitignore` and never committed

### For Production/Dev Server
- [Infisical](https://infisical.com) injects secrets at runtime
- Workspace ID: `be6cf11e-7475-4183-88de-85c7363dc034`
- Environments: `prod` (main branch), `dev` (other branches)
- `prod.sh` and `dev.sh` handle authentication automatically
- Falls back to `.env` file if Infisical CLI is not installed

### Secrets Required
| Variable | Description |
|---|---|
| `MYSQL_ROOT_PASSWORD` | MariaDB root password |
| `MYSQL_DATABASE` | Database name (default: `drupal`) |
| `MYSQL_USER` | Database user (default: `drupaluser`) |
| `MYSQL_PASSWORD` | Database user password |
| `AZURE_OCR_ENDPOINT` | _(optional)_ Azure Document Intelligence endpoint |
| `AZURE_OCR_KEY` | _(optional)_ Azure Document Intelligence key |
| `AZURE_OPENAI_ENDPOINT` | _(optional)_ Azure OpenAI endpoint |
| `AZURE_OPENAI_KEY` | _(optional)_ Azure OpenAI key |

---

## Developer Workflow

```
 Developer Machine                    GitHub                    Production Server
+------------------+    +-----------------------------+    +---------------------+
|                  |    |                             |    |                     |
| 1. Clone repo    |<---|  quaternaryps/              |    |                     |
|                  |    |  doc-intelligence           |    |                     |
| 2. cp .env.example    |                             |    |                     |
|    .env          |    |                             |    |                     |
|                  |    |                             |    |                     |
| 3. docker compose|    |                             |    |                     |
|    up -d --build |    |                             |    |                     |
|                  |    |                             |    |                     |
| 4. Edit code     |    |                             |    |                     |
|    Test locally  |    |                             |    |                     |
|                  |    |                             |    |                     |
| 5. git commit    |--->|  Push to GitHub             |    |                     |
|    git push      |    |                             |    |                     |
|                  |    |                             |    | 6. git pull          |
|                  |    |                             |--->| 7. ./dev.sh up -d   |
|                  |    |                             |    |    --build           |
|                  |    |                             |    | 8. QA/QC testing    |
|                  |    |                             |    | 9. ./prod.sh up -d  |
|                  |    |                             |    |    --build           |
+------------------+    +-----------------------------+    +---------------------+
```

### Steps:
1. **Clone** the repo and configure `.env`
2. **Develop** locally with `docker compose up -d --build`
3. **Test** at `localhost:3500` (Review UI), `localhost:5000` (Menu), `localhost:8000` (API)
4. **Rebuild** changed services: `docker compose up -d --build review-ui`
5. **Commit and push** to GitHub
6. **On the server:** `git pull` to get changes
7. **Test on dev:** `./dev.sh up -d --build` (ports 3500/5500/8500)
8. **QA/QC** — verify the changes work with real data
9. **Deploy to prod:** `./prod.sh up -d --build` (ports 3000/5000/8000)

---

## Repository Structure

```
doc-intelligence/
├── docker-compose.yml              # Base: self-contained developer stack
├── docker-compose.server.yml       # Overlay: production server deployment
├── docker-compose.dev-server.yml   # Overlay: dev server deployment
├── prod.sh                         # Production launcher (Infisical)
├── dev.sh                          # Dev launcher (Infisical)
├── sync-db.sh                      # Sync prod DB to dev
├── .env.example                    # Environment template
├── .infisical.json                 # Infisical workspace config
├── .gitignore                      # Excludes .env, node_modules, etc.
├── README.md                       # Quick start guide
├── ARCHITECTURE.md                 # This document
│
├── docman-docker/                  # Drupal CMS stack
│   ├── Dockerfile                  # drupal:7 + ImageMagick + Ghostscript
│   ├── settings.php                # Drupal config (env-var driven)
│   ├── drupal-modules/
│   │   ├── docman/                 # Custom document management module
│   │   │   ├── docman.module       # Search, browse, upload, view
│   │   │   ├── browse.inc          # Document browsing
│   │   │   ├── policy.inc          # Policy number handling
│   │   │   ├── upload.inc          # File upload
│   │   │   └── search.inc          # Document search
│   │   ├── date-time-field/        # Date/time field widget
│   │   └── entity/                 # Entity API module
│   └── drupal-themes/
│       └── antonelli/              # Custom theme
│
└── dms-automation/                 # DMS automation services
    ├── dms-autoprocessor/          # Deno TypeScript backend
    │   ├── Dockerfile              # Deno + ImageMagick + Ghostscript + Poppler
    │   ├── main.ts                 # HTTP API server (:8000)
    │   ├── cron.ts                 # Scheduled batch processor
    │   ├── backlog.ts              # Backlog processing entry point
    │   └── lib/
    │       ├── file-processor.ts   # Core processing pipeline
    │       ├── filename-parser.ts  # Filename -> metadata extraction
    │       ├── file-converter.ts   # PDF/image format conversion
    │       ├── ocr-service.ts      # OCR text extraction (+ Azure)
    │       ├── ai-classifier.ts    # AI document classification (+ Azure)
    │       ├── duplicate-checker.ts# Duplicate detection
    │       ├── thumbnail-gen.ts    # PNG thumbnail generation
    │       ├── mysql-writer.ts     # Database operations
    │       ├── folder-scanner.ts   # NAS folder scanning
    │       ├── backlog-processor.ts# Backlog queue processor
    │       ├── file-manager.ts     # File move/copy operations
    │       ├── policy-parser.ts    # Policy number parsing
    │       └── stats.ts            # Processing statistics
    │
    ├── dms-review-ui/              # Next.js review interface
    │   ├── Dockerfile              # Node 20 Alpine, multi-stage build
    │   ├── app/
    │   │   ├── page.tsx            # Main review queue page
    │   │   ├── layout.tsx          # App layout
    │   │   ├── governance/         # Governance dashboard
    │   │   └── api/
    │   │       ├── documents/      # Document queue API
    │   │       ├── approve/        # Approval workflow API
    │   │       ├── thumbnail/      # Thumbnail serving
    │   │       ├── report/         # Statistics API
    │   │       ├── governance/     # Governance data API
    │   │       ├── backlog-logs/   # Backlog log viewer API
    │   │       └── autocomplete/   # Policy/client autocomplete
    │   └── components/
    │       ├── DocumentReviewInterface.tsx  # Main review component
    │       ├── DocumentViewer.tsx           # Document preview + zoom
    │       ├── DocumentQueue.tsx            # Queue sidebar
    │       ├── AutocompleteInput.tsx        # Smart autocomplete
    │       ├── BrowseModal.tsx              # File browser/importer
    │       ├── ApprovalLogModal.tsx         # Approval history
    │       ├── BacklogLogModal.tsx          # Backlog log viewer
    │       ├── FileSelector.tsx             # File selection
    │       ├── FolderBrowser.tsx            # Folder navigation
    │       └── ProgressBar.tsx              # Review progress
    │
    └── menu-portal/                # Express dashboard
        ├── Dockerfile              # Node 20 Alpine
        ├── server.js               # Express server + API proxy
        └── public/
            └── index.html          # Portal page (dynamic hostname)
```
