#!/bin/bash
# DMS Dev Stack Manager (Infisical-powered)
# Usage: ./dev.sh -d --build
#        ./dev.sh down
#        ./dev.sh logs -f autoprocessor-api
#        ./dev.sh ps
#
# Requires: INFISICAL_CLIENT_ID and INFISICAL_CLIENT_SECRET in your environment

set -e
cd "$(dirname "$0")"

if [ -z "$INFISICAL_CLIENT_ID" ] || [ -z "$INFISICAL_CLIENT_SECRET" ]; then
    echo "ERROR: INFISICAL_CLIENT_ID and INFISICAL_CLIENT_SECRET must be set."
    echo "Add them to your ~/.bashrc or ~/.zshrc:"
    echo '  export INFISICAL_CLIENT_ID="your-client-id"'
    echo '  export INFISICAL_CLIENT_SECRET="your-client-secret"'
    exit 1
fi

export INFISICAL_TOKEN=$(infisical login \
  --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" \
  --client-secret="$INFISICAL_CLIENT_SECRET" \
  --silent --plain)

infisical run --env=dev -- docker compose up "$@"
