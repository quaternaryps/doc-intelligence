#!/bin/bash
# Build all Docker images for a specific environment
# Usage: ./scripts/build.sh [dev|test|prod]

set -e

ENVIRONMENT=${1:-dev}

echo "Building Docker images for $ENVIRONMENT environment..."

cd "$ENVIRONMENT"

# Build all images
docker compose build --parallel

echo "✓ Build completed for $ENVIRONMENT environment"

# Tag images if not dev
if [ "$ENVIRONMENT" != "dev" ]; then
    echo "Tagging images as $ENVIRONMENT..."
    docker tag doc-intelligence/postgres:$ENVIRONMENT doc-intelligence/postgres:latest-$ENVIRONMENT
    docker tag doc-intelligence/deno-app:$ENVIRONMENT doc-intelligence/deno-app:latest-$ENVIRONMENT
    docker tag doc-intelligence/python-app:$ENVIRONMENT doc-intelligence/python-app:latest-$ENVIRONMENT
    echo "✓ Images tagged"
fi

echo "Done!"
