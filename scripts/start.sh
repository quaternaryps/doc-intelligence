#!/bin/bash
# Start containers for a specific environment
# Usage: ./scripts/start.sh [dev|test|prod]

set -e

ENVIRONMENT=${1:-dev}

echo "Starting containers for $ENVIRONMENT environment..."

cd "$ENVIRONMENT"

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠ Please edit .env with your configuration"
fi

# Start containers
docker-compose up -d

echo "✓ Containers started for $ENVIRONMENT environment"
echo ""
echo "Service URLs:"
echo "  - Deno App: http://localhost:$(docker-compose port deno-app 8000 | cut -d: -f2)"
echo "  - Python App: http://localhost:$(docker-compose port python-app 8001 | cut -d: -f2)"
echo "  - PostgreSQL: localhost:$(docker-compose port postgres 5432 | cut -d: -f2)"
echo ""
echo "Use 'docker-compose logs -f' to view logs"
