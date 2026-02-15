# Quick Start Guide for Consultants

This guide helps distributed consultants quickly get up and running with the Doc Intelligence container stack.

## Prerequisites

Install these tools before starting:

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
  - Download: https://www.docker.com/products/docker-desktop
  - Minimum version: 20.10+
- **Git**
  - Download: https://git-scm.com/downloads

## Quick Start (5 Minutes)

### 1. Clone the Repository

```bash
git clone https://github.com/quaternaryps/doc-intelligence.git
cd doc-intelligence
```

### 2. Validate Setup

```bash
./scripts/validate.sh
```

This checks that Docker is installed and all configurations are valid.

### 3. Start Development Environment

```bash
./scripts/start.sh dev
```

This will:
- Create a `.env` file from the example
- Build all Docker images
- Start all services
- Display service URLs

### 4. Access Services

Open your browser and navigate to:

- **Deno App**: http://localhost:8000
- **Python App**: http://localhost:8001
- **Database**: localhost:5432 (use a PostgreSQL client)

Test health endpoints:
```bash
curl http://localhost:8000/health
curl http://localhost:8001/health
```

### 5. View Logs

```bash
cd dev
docker compose logs -f
```

Press `Ctrl+C` to stop viewing logs.

## Common Tasks

### Pull Pre-built Images from Registry

If images are already built and pushed to a registry:

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Pull images
./scripts/pull.sh ghcr.io/quaternaryps test

# Start services
cd test
docker compose up -d
```

### Stop Services

```bash
./scripts/stop.sh dev
```

### Restart Services

```bash
cd dev
docker compose restart
```

### Rebuild After Code Changes

```bash
cd dev
docker compose build
docker compose up -d
```

### Clean Up (Remove All Data)

```bash
./scripts/clean.sh dev --volumes
```

**⚠️ Warning**: This deletes all data including database!

## Working with Different Environments

### Development (dev)

For local development and testing:

```bash
./scripts/start.sh dev
# Services run on ports 8000, 8001, 5432
```

### Test (test)

For integration testing:

```bash
./scripts/start.sh test
# Services run on ports 8100, 8101, 5433
```

### Production (prod)

For production deployment:

```bash
# IMPORTANT: Set secure passwords first!
cd prod
cp .env.example .env
nano .env  # Edit with secure values

./scripts/start.sh prod
# Services run on ports 8200, 8201, 5434
```

## Environment Comparison

| Feature | Dev | Test | Prod |
|---------|-----|------|------|
| Deno App Port | 8000 | 8100 | 8200 |
| Python App Port | 8001 | 8101 | 8201 |
| PostgreSQL Port | 5432 | 5433 | 5434 |
| Hot Reload | ✓ | ✗ | ✗ |
| Resource Limits | ✗ | ✗ | ✓ |
| Auto-restart | unless-stopped | unless-stopped | always |

## Accessing Services

### Web Services

- **Deno App**: RESTful API service
  - Health: `http://localhost:8000/health`
  - Root: `http://localhost:8000/`
  
- **Python App**: Processing service
  - Health: `http://localhost:8001/health`
  - Root: `http://localhost:8001/`

### Database

Connect to PostgreSQL:

```bash
# Using docker exec
docker exec -it dev-postgres psql -U appuser appdb

# Using local psql client
psql -h localhost -p 5432 -U appuser -d appdb

# Default credentials (dev):
# Username: appuser
# Password: devpassword
# Database: appdb
```

### File Storage

Access persistent storage:

```bash
# View storage container files
docker exec dev-storage ls -la /data
docker exec dev-storage ls -la /json
```

## Troubleshooting

### Containers won't start

```bash
# Check what's wrong
cd dev
docker compose ps
docker compose logs

# Restart specific service
docker compose restart deno-app
```

### Port already in use

```bash
# Find what's using the port
lsof -i :8000

# Stop the conflicting service or change ports in docker-compose.yml
```

### Out of disk space

```bash
# Clean up old containers and images
docker system prune -a

# Remove unused volumes
docker volume prune
```

### Database connection failed

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# View PostgreSQL logs
docker compose logs postgres

# Restart database
docker compose restart postgres
```

### "Command not found" errors

Make sure you're in the correct directory:

```bash
cd /path/to/doc-intelligence
./scripts/validate.sh
```

## Making Changes

### Edit Application Code

1. Navigate to the service directory:
   ```bash
   cd dev/deno-app  # or dev/python-app
   ```

2. Edit files with your preferred editor:
   ```bash
   code main.ts  # VS Code
   nano main.ts  # Terminal editor
   ```

3. Rebuild and restart:
   ```bash
   cd ..
   docker compose build deno-app
   docker compose up -d deno-app
   ```

4. View logs:
   ```bash
   docker compose logs -f deno-app
   ```

### Add Dependencies

**Deno (TypeScript)**:
```typescript
// Just import directly in your code
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
```

**Python**:
```bash
# Edit requirements.txt
cd dev/python-app
echo "requests>=2.31.0" >> requirements.txt

# Rebuild
cd ..
docker compose build python-app
docker compose up -d python-app
```

### Database Migrations

```bash
# Access database
docker exec -it dev-postgres psql -U appuser appdb

# Run SQL commands
CREATE TABLE my_table (id SERIAL PRIMARY KEY, name VARCHAR(100));
\q
```

## Sharing Your Work

### Build and Tag Images

```bash
./scripts/build.sh test
```

### Push to Registry

```bash
# Login (ask your team lead for credentials)
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push images
./scripts/push.sh ghcr.io/quaternaryps test
```

### Notify Team

Let your team know via Slack/email that new images are available:

```
New images pushed to registry:
- ghcr.io/quaternaryps/doc-intelligence-deno-app:test
- ghcr.io/quaternaryps/doc-intelligence-python-app:test
- ghcr.io/quaternaryps/doc-intelligence-postgres:test

Changes:
- Added feature X
- Fixed bug Y
```

## Useful Commands Cheat Sheet

```bash
# Start services
./scripts/start.sh dev

# Stop services
./scripts/stop.sh dev

# View logs
cd dev && docker compose logs -f

# Rebuild specific service
cd dev && docker compose build deno-app

# Restart specific service
cd dev && docker compose restart deno-app

# Access database
docker exec -it dev-postgres psql -U appuser appdb

# Access container shell
docker exec -it dev-deno-app sh
docker exec -it dev-python-app /bin/bash

# Check service health
curl http://localhost:8000/health

# List running containers
docker compose ps

# List all volumes
docker volume ls

# View container resource usage
docker stats

# Clean everything
./scripts/clean.sh dev --volumes
```

## Getting Help

1. **Check logs**: Most issues are visible in logs
   ```bash
   docker compose logs [service-name]
   ```

2. **Read the README**: Full documentation in [README.md](../README.md)

3. **Ask the team**: Contact your team lead or post in the team chat

4. **Create an issue**: For bugs or feature requests on GitHub

## Best Practices

1. **Always pull latest** before starting work:
   ```bash
   git pull origin main
   ```

2. **Test locally** before pushing changes

3. **Use descriptive commit messages**

4. **Keep secrets secure** - never commit `.env` files

5. **Clean up regularly** to save disk space:
   ```bash
   docker system prune
   ```

6. **Check health endpoints** before reporting issues

7. **Read logs** - they usually explain what went wrong

## Next Steps

- Read the full [README.md](../README.md)
- Review [DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed development guide
- Check [REGISTRY_SETUP.md](docs/REGISTRY_SETUP.md) for registry workflows
- See [CONTRIBUTING.md](../CONTRIBUTING.md) if making changes

---

**Need Help?** Contact your team lead or check the project documentation.

**Happy Coding!** 🚀
