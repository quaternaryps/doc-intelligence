# Contributing to Doc Intelligence

Thank you for your interest in contributing to the Doc Intelligence container repository! This guide will help you get started.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Container Development](#container-development)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Best Practices](#best-practices)

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- Docker Engine 20.10 or higher
- Docker Compose 2.0 or higher
- Git
- A GitHub account

### Initial Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/doc-intelligence.git
   cd doc-intelligence
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/quaternaryps/doc-intelligence.git
   ```

4. **Validate setup**:
   ```bash
   ./scripts/validate.sh
   ```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

Use descriptive branch names:
- `feature/add-redis-service`
- `fix/postgres-connection-issue`
- `docs/update-readme`

### 2. Make Your Changes

Work in the appropriate environment directory:

```bash
# For application changes
cd dev/deno-app
# or
cd dev/python-app

# Make your changes
# ...

# Test locally
cd ..
docker compose build
docker compose up -d
docker compose logs -f
```

### 3. Test Your Changes

Before committing, ensure:

- Docker images build successfully
- Containers start without errors
- Services are accessible
- Health checks pass

```bash
# Build and test
./scripts/build.sh dev
./scripts/start.sh dev

# Check health
curl http://localhost:8000/health
curl http://localhost:8001/health

# View logs
cd dev
docker compose logs
```

### 4. Commit Your Changes

Use clear, descriptive commit messages:

```bash
git add .
git commit -m "Add Redis service for caching

- Add Redis Dockerfile
- Update docker-compose with Redis service
- Add Redis connection example in Python app
- Update documentation"
```

Commit message format:
- First line: Brief summary (50 chars or less)
- Blank line
- Detailed description with bullet points

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title describing the change
- Description of what was changed and why
- Any testing performed
- Screenshots (if applicable)

## Container Development

### Adding a New Service

1. **Create service directory**:
   ```bash
   mkdir -p dev/new-service
   ```

2. **Create Dockerfile**:
   ```dockerfile
   # dev/new-service/Dockerfile
   FROM base-image:tag
   
   WORKDIR /app
   
   # Install dependencies
   COPY requirements.txt .
   RUN install-command
   
   # Copy application
   COPY . .
   
   EXPOSE port
   
   CMD ["start-command"]
   ```

3. **Update docker-compose.yml**:
   ```yaml
   services:
     new-service:
       build: ./new-service
       container_name: dev-new-service
       restart: unless-stopped
       ports:
         - "PORT:PORT"
       networks:
         - app-network
   ```

4. **Test the service**:
   ```bash
   cd dev
   docker compose build new-service
   docker compose up -d new-service
   docker compose logs -f new-service
   ```

5. **Update documentation** in README.md and relevant docs

### Modifying Existing Services

1. Make changes to Dockerfiles or application code
2. Rebuild the specific service:
   ```bash
   cd dev
   docker compose build service-name
   docker compose up -d service-name
   ```
3. Test thoroughly
4. Update other environments (test/prod) if needed

### Environment Variables

When adding new environment variables:

1. Add to `.env.example`:
   ```bash
   NEW_VARIABLE=default_value
   ```

2. Document in README.md

3. Use in docker-compose.yml:
   ```yaml
   environment:
     NEW_VARIABLE: ${NEW_VARIABLE:-default_value}
   ```

## Testing

### Pre-commit Checks

Before committing, run:

```bash
# Validate configurations
./scripts/validate.sh

# Test dev environment
./scripts/build.sh dev
./scripts/start.sh dev

# Test health endpoints
curl http://localhost:8000/health
curl http://localhost:8001/health

# Clean up
./scripts/stop.sh dev
```

### Testing Across Environments

Test changes in all environments:

```bash
# Dev
./scripts/build.sh dev
./scripts/start.sh dev
# ... test ...
./scripts/stop.sh dev

# Test
./scripts/build.sh test
./scripts/start.sh test
# ... test ...
./scripts/stop.sh test

# Prod
./scripts/build.sh prod
# Configure .env with secure values first
./scripts/start.sh prod
# ... test ...
./scripts/stop.sh prod
```

### Integration Testing

Ensure services can communicate:

```bash
# Test database connectivity
docker exec dev-python-app python -c "import psycopg2; print('OK')"

# Test network connectivity
docker exec dev-deno-app ping postgres

# Test API connectivity
docker exec dev-python-app curl http://deno-app:8000/health
```

## Submitting Changes

### Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code builds successfully in all environments
- [ ] All services start without errors
- [ ] Health checks pass
- [ ] Documentation is updated
- [ ] `.env.example` files are updated if needed
- [ ] Commit messages are clear and descriptive
- [ ] No sensitive data (passwords, keys) in commits
- [ ] Scripts are executable (`chmod +x`)
- [ ] Validation script passes

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation update
- [ ] Configuration change

## Changes Made
- Bullet point list of changes
- ...

## Testing Performed
- How you tested the changes
- Which environments were tested
- Test results

## Screenshots (if applicable)
Add screenshots here

## Additional Notes
Any additional context or information
```

## Best Practices

### Docker Best Practices

1. **Use official base images** when possible
2. **Keep images small** - use alpine variants
3. **Layer caching** - order Dockerfile commands appropriately
4. **Security** - don't run as root, scan for vulnerabilities
5. **Multi-stage builds** for production images

### Code Organization

1. **Separate concerns** - one service per container
2. **Use volumes** for persistent data
3. **Environment variables** for configuration
4. **Named networks** for service communication
5. **Health checks** for all services

### Documentation

1. **Update README** for significant changes
2. **Comment complex configurations**
3. **Document new environment variables**
4. **Include examples** in documentation

### Security

1. **Never commit secrets** - use .env (gitignored)
2. **Use strong passwords** in production
3. **Keep images updated** - rebuild regularly
4. **Scan for vulnerabilities** before pushing
5. **Limit network exposure** - only expose necessary ports

### Git Workflow

1. **Keep commits atomic** - one logical change per commit
2. **Write clear messages** - explain what and why
3. **Rebase before pushing** - keep history clean
4. **Reference issues** - link to related issues/PRs

## Getting Help

If you need help:

1. Check existing documentation
2. Search existing issues
3. Ask in pull request comments
4. Create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment details

## Code Review Process

1. Maintainer reviews your PR
2. Address any feedback
3. Make requested changes
4. Push updates to your branch
5. PR is merged when approved

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes
- Project documentation

Thank you for contributing! 🎉
