# Container Registry Setup Guide

This guide explains how to set up and use a container registry for sharing Docker images with your team.

## Supported Registries

- GitHub Container Registry (ghcr.io) - Recommended for GitHub-hosted projects
- Docker Hub (docker.io)
- Amazon ECR
- Azure Container Registry
- Google Container Registry

## GitHub Container Registry Setup

### 1. Create a Personal Access Token (PAT)

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Give it a name like "doc-intelligence-registry"
4. Select scopes:
   - `write:packages` - Upload packages
   - `read:packages` - Download packages
   - `delete:packages` - Delete packages (optional)
5. Click "Generate token"
6. **Save the token securely** - you won't see it again!

### 2. Login to Registry

```bash
# Set your token as an environment variable
export GITHUB_TOKEN=ghp_your_token_here

# Login
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 3. Configure Repository Access

The registry URL format:
```
ghcr.io/quaternaryps/doc-intelligence-[component]:[tag]
```

Example images:
- `ghcr.io/quaternaryps/doc-intelligence-postgres:prod`
- `ghcr.io/quaternaryps/doc-intelligence-deno-app:test`
- `ghcr.io/quaternaryps/doc-intelligence-python-app:dev`

## Docker Hub Setup

### 1. Create Docker Hub Account

Sign up at https://hub.docker.com

### 2. Create Repository

1. Go to Repositories → Create Repository
2. Name it `doc-intelligence-postgres`, etc.
3. Choose public or private

### 3. Login

```bash
docker login
# Enter username and password
```

### 4. Configure Registry URL

```bash
# Push to Docker Hub
./scripts/push.sh YOUR_DOCKERHUB_USERNAME prod
```

## Pushing Images

```bash
# Build images first
./scripts/build.sh prod

# Push to registry
./scripts/push.sh ghcr.io/quaternaryps prod

# Or to Docker Hub
./scripts/push.sh yourusername prod
```

## Pulling Images (For Team Members)

```bash
# Login to registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull images
./scripts/pull.sh ghcr.io/quaternaryps prod

# Or pull manually
docker pull ghcr.io/quaternaryps/doc-intelligence-postgres:prod
docker pull ghcr.io/quaternaryps/doc-intelligence-deno-app:prod
docker pull ghcr.io/quaternaryps/doc-intelligence-python-app:prod
```

## Automation with GitHub Actions

Create `.github/workflows/docker-publish.yml`:

```yaml
name: Docker Build and Push

on:
  push:
    branches:
      - main
      - develop
  release:
    types: [published]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: quaternaryps/doc-intelligence

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Log in to Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push images
        run: |
          # Determine environment
          if [ "${{ github.ref }}" == "refs/heads/main" ]; then
            ENV=prod
          elif [ "${{ github.ref }}" == "refs/heads/develop" ]; then
            ENV=test
          else
            ENV=dev
          fi
          
          # Build
          ./scripts/build.sh $ENV
          
          # Push
          ./scripts/push.sh ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }} $ENV
```

## Managing Package Visibility

### GitHub Container Registry

1. Go to your GitHub profile → Packages
2. Find the package
3. Click Settings
4. Change visibility (Public/Private)
5. Manage access (add teams/users)

### Granting Team Access

```bash
# For consultants, share:
# 1. Registry URL
# 2. Access token or credentials
# 3. Instructions from README
```

## Best Practices

1. **Use Tags Wisely**
   - Use environment tags: `dev`, `test`, `prod`
   - Use version tags: `v1.0.0`, `v1.1.0`
   - Use `latest-[env]` for most recent in each environment

2. **Security**
   - Keep access tokens secure
   - Use read-only tokens for pulling
   - Rotate tokens regularly
   - Use private registries for sensitive code

3. **Documentation**
   - Document all available images
   - Tag images with commit SHA for traceability
   - Maintain a CHANGELOG

4. **Cleanup**
   - Regularly remove old/unused images
   - Set up automatic cleanup policies
   - Keep storage costs in check

## Troubleshooting

### Authentication Failed

```bash
# Clear credentials
docker logout ghcr.io

# Login again
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

### Image Not Found

```bash
# Check image exists
docker pull ghcr.io/quaternaryps/doc-intelligence-postgres:prod

# List all tags
# Visit: https://github.com/quaternaryps/doc-intelligence/pkgs/container/doc-intelligence-postgres
```

### Rate Limits (Docker Hub)

Consider:
- Using GitHub Container Registry (no rate limits)
- Authenticating to Docker Hub (higher limits)
- Using a paid Docker Hub account

## Alternative: Private Registry

Set up your own registry:

```bash
# Run a local registry
docker run -d -p 5000:5000 --name registry registry:2

# Tag and push
docker tag doc-intelligence/postgres:prod localhost:5000/postgres:prod
docker push localhost:5000/postgres:prod

# Pull
docker pull localhost:5000/postgres:prod
```

For production, use:
- [Harbor](https://goharbor.io/)
- [GitLab Container Registry](https://docs.gitlab.com/ee/user/packages/container_registry/)
- Cloud provider registries (AWS ECR, Azure ACR, GCP GCR)
