# Development Guide

This guide provides detailed information for developers working with the Doc Intelligence container stack.

## Development Workflow

### Initial Setup

```bash
# Clone repository
git clone https://github.com/quaternaryps/doc-intelligence.git
cd doc-intelligence

# Set up development environment
cd dev
cp .env.example .env
# Edit .env with your preferences

# Build and start
docker-compose build
docker-compose up -d

# View logs
docker-compose logs -f
```

### Making Changes

#### Deno Application Changes

```bash
# Edit files in dev/deno-app/
# Changes are automatically reflected via volume mounts

# Restart to pick up configuration changes
cd dev
docker-compose restart deno-app

# View logs
docker-compose logs -f deno-app
```

#### Python Application Changes

```bash
# Edit files in dev/python-app/

# If you change requirements.txt:
docker-compose build python-app
docker-compose up -d python-app

# Otherwise, just restart
docker-compose restart python-app

# View logs
docker-compose logs -f python-app
```

#### Database Schema Changes

```bash
# Edit dev/postgres/init-scripts/01-init.sh

# Recreate database
docker-compose down
docker volume rm dev-postgres-data
docker-compose up -d postgres

# Or apply changes manually
docker exec -it dev-postgres psql -U appuser appdb
# Run your SQL commands
```

### Running Commands Inside Containers

```bash
# Deno container
docker exec -it dev-deno-app deno --version
docker exec -it dev-deno-app deno run --allow-net script.ts

# Python container
docker exec -it dev-python-app python --version
docker exec -it dev-python-app pip list

# PostgreSQL
docker exec -it dev-postgres psql -U appuser appdb
```

### Debugging

#### Deno Debugging

Add debugging to your Deno app:

```typescript
// main.ts
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const PORT = 8000;

const handler = async (req: Request): Promise<Response> => {
  // Add console.log for debugging
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Your logic here
};

await serve(handler, { port: PORT });
```

View logs:
```bash
docker-compose logs -f deno-app
```

#### Python Debugging

Use Python's logging module:

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

logger.debug("Debug message")
logger.info("Info message")
logger.error("Error message")
```

#### Interactive Shell

```bash
# Python shell in container
docker exec -it dev-python-app python

# Bash shell
docker exec -it dev-python-app /bin/bash

# Deno REPL
docker exec -it dev-deno-app deno
```

## Testing

### Manual Testing

```bash
# Test Deno app
curl http://localhost:8000/health
curl http://localhost:8000/

# Test Python app
curl http://localhost:8001/health
curl http://localhost:8001/

# Test database connection
docker exec dev-postgres pg_isready -U appuser
docker exec dev-postgres psql -U appuser appdb -c "SELECT version();"
```

### Adding Automated Tests

#### Deno Tests

Create `dev/deno-app/main_test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

Deno.test("health endpoint returns 200", async () => {
  const response = await fetch("http://localhost:8000/health");
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.status, "healthy");
});
```

Run tests:
```bash
docker exec dev-deno-app deno test --allow-net
```

#### Python Tests

Create `dev/python-app/test_main.py`:

```python
import unittest
import requests

class TestAPI(unittest.TestCase):
    def test_health_endpoint(self):
        response = requests.get('http://localhost:8001/health')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'healthy')

if __name__ == '__main__':
    unittest.main()
```

Add to requirements.txt:
```
pytest>=7.4.0
```

Run tests:
```bash
docker exec dev-python-app pytest
```

## Adding New Services

### 1. Create Service Directory

```bash
mkdir -p dev/new-service
```

### 2. Create Dockerfile

```dockerfile
# dev/new-service/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### 3. Update docker-compose.yml

```yaml
# dev/docker-compose.yml
services:
  # ... existing services ...
  
  new-service:
    build: ./new-service
    container_name: dev-new-service
    restart: unless-stopped
    environment:
      NODE_ENV: development
    volumes:
      - ./new-service:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    networks:
      - app-network
```

### 4. Build and Start

```bash
cd dev
docker-compose up -d new-service
docker-compose logs -f new-service
```

## Environment Variables

### Adding New Variables

1. Add to `.env.example`:
```bash
# dev/.env.example
NEW_VARIABLE=default_value
```

2. Use in docker-compose.yml:
```yaml
environment:
  NEW_VARIABLE: ${NEW_VARIABLE:-default_value}
```

3. Access in application:
```typescript
// Deno
const newVar = Deno.env.get("NEW_VARIABLE");

// Python
import os
new_var = os.getenv("NEW_VARIABLE")
```

## Database Management

### Migrations

Create a migrations directory:

```bash
mkdir -p dev/postgres/migrations
```

Create migration files:

```sql
-- dev/postgres/migrations/001_add_users_table.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Run migrations:

```bash
# Manually
for file in dev/postgres/migrations/*.sql; do
    docker exec -i dev-postgres psql -U appuser appdb < "$file"
done

# Or create a script
# scripts/migrate.sh
```

### Database Backups

```bash
# Backup
docker exec dev-postgres pg_dump -U appuser appdb > backup-$(date +%Y%m%d).sql

# Restore
cat backup-20240215.sql | docker exec -i dev-postgres psql -U appuser appdb
```

### Database Tools

```bash
# psql
docker exec -it dev-postgres psql -U appuser appdb

# Common commands:
# \dt - list tables
# \d table_name - describe table
# \q - quit
```

## Performance Optimization

### Container Resources

Add resource limits in docker-compose.yml:

```yaml
services:
  deno-app:
    # ... other config ...
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

### Build Cache

Use multi-stage builds:

```dockerfile
# Development stage
FROM denoland/deno:latest AS development
WORKDIR /app
COPY . .
CMD ["deno", "run", "--allow-net", "main.ts"]

# Production stage
FROM denoland/deno:latest AS production
WORKDIR /app
COPY --from=development /app .
RUN deno cache main.ts
CMD ["deno", "run", "--allow-net", "main.ts"]
```

### Volume Performance

For better performance on macOS/Windows:

```yaml
volumes:
  - ./app:/app:cached  # Cached for better performance
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs [service-name]

# Check container status
docker-compose ps

# Inspect container
docker inspect dev-[service-name]

# Remove and recreate
docker-compose down
docker-compose up -d
```

### Network Issues

```bash
# List networks
docker network ls

# Inspect network
docker network inspect dev-app-network

# Test connectivity
docker exec dev-deno-app ping postgres
docker exec dev-python-app curl http://deno-app:8000/health
```

### Volume Issues

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect dev-postgres-data

# Remove volume (WARNING: deletes data)
docker volume rm dev-postgres-data
```

### Port Already in Use

```bash
# Find what's using the port
lsof -i :8000
# or on Linux
netstat -tulpn | grep 8000

# Kill the process or change port in docker-compose.yml
```

## Code Quality

### Linting

#### Deno
```bash
docker exec dev-deno-app deno lint
docker exec dev-deno-app deno fmt --check
```

#### Python
Add to requirements.txt:
```
black>=23.0.0
flake8>=6.0.0
```

Run linters:
```bash
docker exec dev-python-app black . --check
docker exec dev-python-app flake8 .
```

### Formatting

```bash
# Deno
docker exec dev-deno-app deno fmt

# Python
docker exec dev-python-app black .
```

## Best Practices

1. **Use Volume Mounts in Dev**
   - Enables hot reloading
   - Faster development cycle

2. **Keep Containers Small**
   - Use slim/alpine base images
   - Multi-stage builds
   - .dockerignore file

3. **Environment Parity**
   - Keep dev/test/prod similar
   - Use same base images
   - Test in environment similar to production

4. **Version Control**
   - Commit Dockerfiles
   - Don't commit .env files
   - Use .gitignore properly

5. **Documentation**
   - Document all services
   - Keep README updated
   - Comment complex configurations

## Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Deno Manual](https://deno.land/manual)
- [Python Docker Guide](https://docs.python.org/3/library/venv.html)
- [PostgreSQL Docker](https://hub.docker.com/_/postgres)
