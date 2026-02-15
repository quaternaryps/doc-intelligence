#!/bin/bash
# Pull Docker images from registry
# Usage: ./scripts/pull.sh [registry-url] [environment]
# Example: ./scripts/pull.sh ghcr.io/quaternaryps prod

set -e

REGISTRY=${1}
ENVIRONMENT=${2:-prod}

if [ -z "$REGISTRY" ]; then
    echo "Error: Registry URL required"
    echo "Usage: ./scripts/pull.sh [registry-url] [environment]"
    echo "Example: ./scripts/pull.sh ghcr.io/quaternaryps prod"
    exit 1
fi

echo "Pulling images from $REGISTRY for $ENVIRONMENT environment..."

# Pull images
IMAGES=("postgres" "deno-app" "python-app")

for IMAGE in "${IMAGES[@]}"; do
    REMOTE_TAG="$REGISTRY/doc-intelligence-$IMAGE:$ENVIRONMENT"
    
    echo "Pulling $REMOTE_TAG..."
    docker pull "$REMOTE_TAG"
    
    # Tag as local image
    LOCAL_TAG="doc-intelligence/$IMAGE:$ENVIRONMENT"
    docker tag "$REMOTE_TAG" "$LOCAL_TAG"
done

echo "✓ All images pulled successfully"
echo ""
echo "Local images:"
for IMAGE in "${IMAGES[@]}"; do
    echo "  - doc-intelligence/$IMAGE:$ENVIRONMENT"
done
