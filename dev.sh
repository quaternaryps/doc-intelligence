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
    if [ -z "$INFISICAL_UNIVERSAL_AUTH_CLIENT_ID" ] || [ -z "$INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET" ]; then
        echo "WARNING: Infisical CLI found but credentials not set."
        echo "Expected: INFISICAL_UNIVERSAL_AUTH_CLIENT_ID and INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET"
        echo "Falling back to .env file."
        echo ""
        $COMPOSE_CMD "$@"
    else
        export INFISICAL_TOKEN=$(infisical login \
            --method=universal-auth \
            --client-id="$INFISICAL_UNIVERSAL_AUTH_CLIENT_ID" \
            --client-secret="$INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET" \
            --silent --plain)
        infisical run --env=dev --projectId="be6cf11e-7475-4183-88de-85c7363dc034" -- $COMPOSE_CMD "$@"
    fi
else
    echo "Infisical CLI not found. Using .env file for secrets."
    echo ""
    $COMPOSE_CMD "$@"
fi
