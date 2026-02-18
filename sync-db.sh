#!/bin/bash
# Sync production database to dev MariaDB
# Usage: ./sync-db.sh
#
# Dumps the production MariaDB (docman-mariadb) and imports into
# the dev MariaDB (dms-dev-mariadb). Both must be running.
#
# Passwords are read from environment variables (set via Infisical or .env).
# Required: MYSQL_ROOT_PASSWORD

set -e
cd "$(dirname "$0")"

echo "=== DMS Database Sync: Prod -> Dev ==="
echo ""

# Check for root password
if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
    # Try reading from .env file
    if [ -f .env ]; then
        source <(grep MYSQL_ROOT_PASSWORD .env)
    fi
    if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
        echo "ERROR: MYSQL_ROOT_PASSWORD not set."
        echo "Set it in your environment or .env file."
        exit 1
    fi
fi

# Check that both containers are running
if ! docker ps --format '{{.Names}}' | grep -q '^docman-mariadb$'; then
    echo "ERROR: Production MariaDB (docman-mariadb) is not running."
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q '^dms-dev-mariadb$'; then
    echo "ERROR: Dev MariaDB (dms-dev-mariadb) is not running."
    echo "Start the dev stack first: ./dev.sh up -d"
    exit 1
fi

echo "Source: docman-mariadb (prod, :3306)"
echo "Target: dms-dev-mariadb (dev, :3307)"
echo ""

# Confirm
read -p "This will OVERWRITE the dev database. Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Step 1: Dumping production database..."
docker exec docman-mariadb mysqldump \
    -u root \
    -p"${MYSQL_ROOT_PASSWORD}" \
    --single-transaction \
    --routines \
    --triggers \
    drupal > /tmp/dms-prod-dump.sql

DUMP_SIZE=$(du -h /tmp/dms-prod-dump.sql | cut -f1)
echo "  Dump complete: ${DUMP_SIZE}"

echo ""
echo "Step 2: Importing into dev database..."
docker exec -i dms-dev-mariadb mysql \
    -u root \
    -p"${MYSQL_ROOT_PASSWORD}" \
    drupal < /tmp/dms-prod-dump.sql

echo "  Import complete."

echo ""
echo "Step 3: Cleaning up..."
rm -f /tmp/dms-prod-dump.sql

echo ""
echo "=== Sync complete! Dev database is now a copy of production. ==="
