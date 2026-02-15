#!/bin/bash
# Validation script to check the repository setup
# Usage: ./scripts/validate.sh

set -e

echo "🔍 Validating Doc Intelligence repository setup..."
echo ""

# Check Docker is installed
echo "Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo "✓ Docker is installed: $DOCKER_VERSION"
else
    echo "✗ Docker is not installed"
    exit 1
fi

# Check Docker Compose (modern syntax)
echo "Checking Docker Compose..."
if docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    echo "✓ Docker Compose is available: $COMPOSE_VERSION"
else
    echo "✗ Docker Compose is not available"
    exit 1
fi

echo ""
echo "Validating Docker Compose configurations..."

# Validate dev environment
echo -n "  Dev environment... "
cd dev
if docker compose config --quiet; then
    echo "✓"
else
    echo "✗"
    exit 1
fi
cd ..

# Validate test environment
echo -n "  Test environment... "
cd test
if docker compose config --quiet > /dev/null 2>&1; then
    echo "✓"
else
    # Check if it's just warnings (expected for missing .env)
    docker compose config > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✓ (with warnings - expected for missing .env)"
    else
        echo "✗"
        exit 1
    fi
fi
cd ..

# Validate prod environment
echo -n "  Prod environment... "
cd prod
if docker compose config --quiet > /dev/null 2>&1; then
    echo "✓"
else
    # Check if it's just warnings (expected for missing .env)
    docker compose config > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✓ (with warnings - expected for missing .env)"
    else
        echo "✗"
        exit 1
    fi
fi
cd ..

echo ""
echo "Checking required files..."

REQUIRED_FILES=(
    ".gitignore"
    ".dockerignore"
    "README.md"
    "dev/docker-compose.yml"
    "test/docker-compose.yml"
    "prod/docker-compose.yml"
    "dev/deno-app/Dockerfile"
    "dev/python-app/Dockerfile"
    "dev/postgres/Dockerfile"
    "scripts/build.sh"
    "scripts/start.sh"
    "scripts/stop.sh"
    "scripts/push.sh"
    "scripts/pull.sh"
    "scripts/clean.sh"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file (missing)"
        exit 1
    fi
done

echo ""
echo "Checking script permissions..."

SCRIPTS=(
    "scripts/build.sh"
    "scripts/start.sh"
    "scripts/stop.sh"
    "scripts/push.sh"
    "scripts/pull.sh"
    "scripts/clean.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -x "$script" ]; then
        echo "  ✓ $script is executable"
    else
        echo "  ✗ $script is not executable"
        exit 1
    fi
done

echo ""
echo "✅ All validation checks passed!"
echo ""
echo "Next steps:"
echo "  1. Build images: ./scripts/build.sh dev"
echo "  2. Start services: ./scripts/start.sh dev"
echo "  3. View logs: cd dev && docker compose logs -f"
echo "  4. Access services:"
echo "     - Deno App: http://localhost:8000"
echo "     - Python App: http://localhost:8001"
echo "     - PostgreSQL: localhost:5432"
