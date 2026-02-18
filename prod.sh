#!/bin/bash
# DMS Production Server Stack
# Usage: ./prod.sh up -d --build
#        ./prod.sh down
#        ./prod.sh logs -f autoprocessor-api
#        ./prod.sh ps
#
# Secrets are injected via Infisical (requires INFISICAL_CLIENT_ID and
# INFISICAL_CLIENT_SECRET in your environment).
#
# If Infisical is not installed, use a .env file instead:
#   cp .env.example .env && edit .env
#   docker compose -f docker-compose.yml -f docker-compose.server.yml -p dms-prod up -d --build

set -e
cd "$(dirname "$0")"

COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.server.yml -p dms-prod"

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
        infisical run --env=prod -- $COMPOSE_CMD "$@"
    fi
else
    echo "Infisical CLI not found. Using .env file for secrets."
    echo "(Install Infisical: https://infisical.com/docs/cli/overview)"
    echo ""
    $COMPOSE_CMD "$@"
fi
