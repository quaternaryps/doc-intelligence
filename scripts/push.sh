#!/bin/bash
# Push Docker images to registry
# Usage: ./scripts/push.sh [registry-url] [environment]
# Example: ./scripts/push.sh ghcr.io/quaternaryps prod

set -e

REGISTRY=${1}
ENVIRONMENT=${2:-prod}

if [ -z "$REGISTRY" ]; then
    echo "Error: Registry URL required"
    echo "Usage: ./scripts/push.sh [registry-url] [environment]"
    echo "Example: ./scripts/push.sh ghcr.io/quaternaryps prod"
    exit 1
fi

echo "Pushing images to $REGISTRY for $ENVIRONMENT environment..."

# Tag and push images
IMAGES=("postgres" "deno-app" "python-app")

for IMAGE in "${IMAGES[@]}"; do
    LOCAL_TAG="doc-intelligence/$IMAGE:$ENVIRONMENT"
    REMOTE_TAG="$REGISTRY/doc-intelligence-$IMAGE:$ENVIRONMENT"
    
    echo "Tagging $LOCAL_TAG as $REMOTE_TAG..."
    docker tag "$LOCAL_TAG" "$REMOTE_TAG"
    
    echo "Pushing $REMOTE_TAG..."
    docker push "$REMOTE_TAG"
    
    # Also push as latest for the environment
    LATEST_TAG="$REGISTRY/doc-intelligence-$IMAGE:latest-$ENVIRONMENT"
    docker tag "$LOCAL_TAG" "$LATEST_TAG"
    docker push "$LATEST_TAG"
done

echo "✓ All images pushed successfully"
echo ""
echo "Images available at:"
for IMAGE in "${IMAGES[@]}"; do
    echo "  - $REGISTRY/doc-intelligence-$IMAGE:$ENVIRONMENT"
done
