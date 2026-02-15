#!/bin/bash
# Clean up Docker resources for a specific environment
# Usage: ./scripts/clean.sh [dev|test|prod] [--volumes]

set -e

ENVIRONMENT=${1:-dev}
REMOVE_VOLUMES=false

if [ "$2" = "--volumes" ]; then
    REMOVE_VOLUMES=true
fi

echo "Cleaning up Docker resources for $ENVIRONMENT environment..."

cd "$ENVIRONMENT"

# Stop and remove containers
docker-compose down

if [ "$REMOVE_VOLUMES" = true ]; then
    echo "Removing volumes..."
    docker-compose down -v
    echo "⚠ All data volumes removed"
fi

echo "✓ Cleanup completed for $ENVIRONMENT environment"
