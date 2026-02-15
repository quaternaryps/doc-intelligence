#!/bin/bash
# Stop containers for a specific environment
# Usage: ./scripts/stop.sh [dev|test|prod]

set -e

ENVIRONMENT=${1:-dev}

echo "Stopping containers for $ENVIRONMENT environment..."

cd "$ENVIRONMENT"

# Stop containers
docker compose down

echo "✓ Containers stopped for $ENVIRONMENT environment"
