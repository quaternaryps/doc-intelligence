# Doc Intelligence - Document Management System

A document management automation platform built on Drupal 7, with AI-powered document processing, review workflows, and a management portal.

## Architecture

| Service | Tech | Port | Description |
|---|---|---|---|
| **MariaDB** | MariaDB 10.3 | 3306 | Database (Drupal content + document metadata) |
| **Drupal** | Drupal 7 + ImageMagick | 80 | CMS with custom docman module |
| **Autoprocessor API** | Deno 1.40, TypeScript | 8000 | Document ingestion, OCR, classification, filing |
| **Autoprocessor Cron** | Deno 1.40, TypeScript | — | Scheduled batch processing |
| **Review UI** | Next.js, React, Tailwind | 3500 | Document review and approval interface |
| **Menu Portal** | Node.js, Express | 5000 | Dashboard / navigation portal |

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2+)
- Git

### 1. Clone the repository

```bash
git clone https://github.com/quaternaryps/doc-intelligence.git
cd doc-intelligence
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your database passwords:

```
MYSQL_ROOT_PASSWORD=choose_a_root_password
MYSQL_PASSWORD=choose_a_drupal_password
```

### 3. Build and start all services

```bash
docker compose up -d --build
```

This builds 4 custom images and pulls MariaDB. First build takes a few minutes.

### 4. Verify everything is running

```bash
docker compose ps
```

You should see 6 containers running:

| Container | URL |
|---|---|
| `doc-intel-mariadb` | `localhost:3306` (MySQL client) |
| `doc-intel-drupal` | http://localhost:80 |
| `doc-intel-autoprocessor-api` | http://localhost:8000 |
| `doc-intel-review-ui` | http://localhost:3500 |
| `doc-intel-menu-portal` | http://localhost:5000 |

### 5. First-time Drupal setup

On first run, visit http://localhost:80 and complete the Drupal installation wizard. Use these database settings:

| Field | Value |
|---|---|
| Database name | `drupal` (or your `MYSQL_DATABASE` value) |
| Database username | `drupaluser` (or your `MYSQL_USER` value) |
| Database password | Your `MYSQL_PASSWORD` value |
| Database host | `mariadb` |
| Database port | `3306` |

## Common Commands

```bash
# Start all services
docker compose up -d

# Rebuild a specific service after code changes
docker compose up -d --build review-ui

# View logs
docker compose logs -f autoprocessor-api

# Stop all services
docker compose down

# Stop and remove all data (fresh start)
docker compose down -v
```

## Project Structure

```
doc-intelligence/
├── docker-compose.yml              # Dev stack (all 6 services)
├── .env.example                    # Environment template
├── docman-docker/                  # Drupal CMS stack
│   ├── Dockerfile                  # drupal:7-apache + ImageMagick
│   ├── settings.php                # Drupal config (reads env vars)
│   ├── drupal-modules/
│   │   ├── docman/                 # Custom document management module
│   │   ├── date-time-field/        # Date/time field widget
│   │   └── entity/                 # Entity API module
│   └── drupal-themes/
│       └── antonelli/              # Custom theme
└── dms-automation/                 # DMS automation services
    ├── dms-autoprocessor/          # Deno document processor
    │   ├── main.ts                 # API server entry point
    │   ├── cron.ts                 # Cron scheduler entry point
    │   └── lib/                    # Processing modules
    │       ├── file-processor.ts   # Core file processing pipeline
    │       ├── filename-parser.ts  # Filename → metadata extraction
    │       ├── file-converter.ts   # PDF/image conversion
    │       ├── ocr-service.ts      # OCR text extraction
    │       ├── ai-classifier.ts    # AI document classification
    │       ├── thumbnail-gen.ts    # Thumbnail generation
    │       ├── mysql-writer.ts     # Database operations
    │       └── ...
    ├── dms-review-ui/              # Next.js review interface
    │   ├── app/                    # Next.js app router pages
    │   └── components/             # React components
    └── menu-portal/                # Express dashboard
        ├── server.js               # Express server
        └── public/index.html       # Portal page
```

## Port Conflicts

If default ports conflict with other services on your machine, override them in `.env`:

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
