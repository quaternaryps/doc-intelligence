#!/bin/bash
# DMS Dev Server Stack
# Usage: ./dev.sh up -d --build
#        ./dev.sh down
#        ./dev.sh logs -f autoprocessor-api
#        ./dev.sh ps
#
# Runs its own MariaDB on :3307 with shifted ports to avoid prod conflicts.
# Secrets are injected via Infisical or .env file.

set -e
cd "$(dirname "$0")"

COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.dev-server.yml -p dms-dev"

# Check if Infisical is available
if command -v infisical &> /dev/null; then
    if [ -z "$INFISICAL_CLIENT_ID" ] || [ -z "$INFISICAL_CLIENT_SECRET" ]; then
        echo "WARNING: Infisical CLI found but INFISICAL_CLIENT_ID / INFISICAL_CLIENT_SECRET not set."
        echo "Falling back to .env file."
        echo ""
        $COMPOSE_CMD "$@"
    else
        export INFISICAL_TOKEN=$(infisical login \
            --method=universal-auth \
            --client-id="$INFISICAL_CLIENT_ID" \
            --client-secret="$INFISICAL_CLIENT_SECRET" \
            --silent --plain)
        infisical run --env=dev -- $COMPOSE_CMD "$@"
    fi
else
    echo "Infisical CLI not found. Using .env file for secrets."
    echo ""
    $COMPOSE_CMD "$@"
fi
