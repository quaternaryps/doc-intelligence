# Doc Intelligence - Docker Container Repository

A Docker-based container repository for managing office automation application components across Development, Test, and Production environments.

## 🏗️ Architecture

This repository contains Docker configurations for the following components:

- **Deno TypeScript Application** - Modern JavaScript/TypeScript runtime for web services
- **Python Application** - Python-based processing services
- **PostgreSQL Database** - Relational database for data persistence
- **Persistent Storage** - Volume management for JSON and file storage

## 📁 Repository Structure

```
doc-intelligence/
├── dev/                    # Development environment
│   ├── deno-app/          # Deno TypeScript service
│   ├── python-app/        # Python service
│   ├── postgres/          # PostgreSQL database
│   ├── storage/           # Persistent storage
│   └── docker compose.yml
├── test/                   # Test environment
│   └── docker compose.yml
├── prod/                   # Production environment
│   └── docker compose.yml
├── scripts/               # Management scripts
└── docs/                  # Additional documentation
```

## 🚀 Quick Start

**New to this project?** Check out the [Quick Start Guide](docs/QUICKSTART.md) for a streamlined onboarding experience.

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/quaternaryps/doc-intelligence.git
cd doc-intelligence
```

### 2. Choose Your Environment

#### Development Environment

```bash
# Build images
./scripts/build.sh dev

# Start services
./scripts/start.sh dev

# View logs
cd dev && docker compose logs -f
```

Access services at:
- Deno App: http://localhost:8000
- Python App: http://localhost:8001
- PostgreSQL: localhost:5432

#### Test Environment

```bash
# Build images
./scripts/build.sh test

# Start services
./scripts/start.sh test
```

Access services at:
- Deno App: http://localhost:8100
- Python App: http://localhost:8101
- PostgreSQL: localhost:5433

#### Production Environment

```bash
# Build images
./scripts/build.sh prod

# Configure environment (IMPORTANT: Set secure passwords!)
cd prod
cp .env.example .env
nano .env  # Edit with your configuration

# Start services
./scripts/start.sh prod
```

Access services at:
- Deno App: http://localhost:8200
- Python App: http://localhost:8201
- PostgreSQL: localhost:5434

## 🔧 Configuration

### Environment Variables

Each environment has a `.env.example` file. Copy it to `.env` and customize:

```bash
cd [dev|test|prod]
cp .env.example .env
# Edit .env with your values
```

**Key Variables:**
- `POSTGRES_DB` - Database name
- `POSTGRES_USER` - Database user
- `POSTGRES_PASSWORD` - Database password (use strong passwords in prod!)
- `ENV` - Environment name (development/test/production)
- `LOG_LEVEL` - Logging level

### Customizing Applications

#### Deno Application

Edit `dev/deno-app/main.ts` and `dev/deno-app/deno.json` for your application logic.

#### Python Application

Edit `dev/python-app/main.py` and add dependencies to `dev/python-app/requirements.txt`.

#### Database Schema

Modify `dev/postgres/init-scripts/01-init.sh` to customize your database schema.

## 📦 Container Registry Workflow

### Building and Tagging Images

```bash
# Build for a specific environment
./scripts/build.sh [dev|test|prod]
```

### Pushing to Registry

Set up authentication to your container registry (e.g., GitHub Container Registry, Docker Hub):

```bash
# Login to registry (example with GitHub Container Registry)
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push images
./scripts/push.sh ghcr.io/quaternaryps prod
```

### Pulling from Registry

Consultants and team members can pull pre-built images:

```bash
# Login to registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull images
./scripts/pull.sh ghcr.io/quaternaryps prod

# Start using pulled images
cd prod
docker compose up -d
```

## 🔄 Workflow: Dev → Test → Prod

### 1. Development Phase

```bash
# Develop and test locally
cd dev
docker compose up -d

# Make changes to application code
# Test changes

# Rebuild when ready
docker compose build
```

### 2. Promote to Test

```bash
# Build test images (uses dev Dockerfiles)
./scripts/build.sh test

# Start test environment
./scripts/start.sh test

# Run integration tests
# Get team feedback
```

### 3. Deploy to Production

```bash
# Build production images
./scripts/build.sh prod

# Push to registry for team access
./scripts/push.sh ghcr.io/quaternaryps prod

# Start production environment
./scripts/start.sh prod
```

## 🛠️ Management Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `build.sh` | Build Docker images | `./scripts/build.sh [env]` |
| `start.sh` | Start containers | `./scripts/start.sh [env]` |
| `stop.sh` | Stop containers | `./scripts/stop.sh [env]` |
| `push.sh` | Push to registry | `./scripts/push.sh [registry] [env]` |
| `pull.sh` | Pull from registry | `./scripts/pull.sh [registry] [env]` |
| `clean.sh` | Clean up resources | `./scripts/clean.sh [env] [--volumes]` |

## 📊 Service Health Checks

Check service health:

```bash
# Deno App
curl http://localhost:8000/health

# Python App
curl http://localhost:8001/health

# PostgreSQL
docker exec [env]-postgres pg_isready -U appuser
```

## 🗄️ Data Persistence

Data is persisted in named Docker volumes:

- `[env]-postgres-data` - Database data
- `[env]-storage-data` - File storage
- `[env]-json-data` - JSON data

### Backup Data

```bash
# Backup PostgreSQL
docker exec [env]-postgres pg_dump -U appuser appdb > backup.sql

# Backup volumes
docker run --rm -v [env]-storage-data:/data -v $(pwd):/backup alpine tar czf /backup/storage-backup.tar.gz /data
```

### Restore Data

```bash
# Restore PostgreSQL
cat backup.sql | docker exec -i [env]-postgres psql -U appuser appdb

# Restore volumes
docker run --rm -v [env]-storage-data:/data -v $(pwd):/backup alpine tar xzf /backup/storage-backup.tar.gz -C /
```

## 🔒 Security Best Practices

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Use strong passwords** in production
3. **Rotate secrets** regularly
4. **Limit network exposure** - Use reverse proxy in production
5. **Keep images updated** - Rebuild regularly with latest base images
6. **Scan for vulnerabilities** - Use `docker scan` or similar tools

## 👥 Team Collaboration

### For Consultants: Pulling and Running

```bash
# 1. Clone repository
git clone https://github.com/quaternaryps/doc-intelligence.git
cd doc-intelligence

# 2. Login to container registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# 3. Pull images for desired environment
./scripts/pull.sh ghcr.io/quaternaryps test

# 4. Configure environment
cd test
cp .env.example .env
# Edit .env as needed

# 5. Start services
docker compose up -d

# 6. View logs
docker compose logs -f
```

### Sharing Changes

```bash
# 1. Make and test changes in dev
cd dev
# ... make changes ...
docker compose build
docker compose up -d

# 2. Build and tag for test
cd ..
./scripts/build.sh test

# 3. Push to registry
./scripts/push.sh ghcr.io/quaternaryps test

# 4. Notify team
# Team members can now pull and test
```

## 📝 Viewing Logs

```bash
# All services
cd [env]
docker compose logs -f

# Specific service
docker compose logs -f deno-app

# Last N lines
docker compose logs --tail=100 python-app
```

## 🧹 Cleanup

```bash
# Stop containers (keep data)
./scripts/stop.sh [env]

# Stop and remove containers (keep data)
./scripts/clean.sh [env]

# Stop and remove everything including data
./scripts/clean.sh [env] --volumes
```

## 🐛 Troubleshooting

### Containers won't start

```bash
# Check logs
cd [env]
docker compose logs

# Check service status
docker compose ps

# Restart specific service
docker compose restart [service-name]
```

### Port conflicts

Edit the docker compose.yml file to change port mappings:

```yaml
ports:
  - "NEW_PORT:CONTAINER_PORT"
```

### Database connection issues

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check connection
docker exec [env]-postgres pg_isready -U appuser

# View database logs
docker compose logs postgres
```

## 📚 Documentation

### Getting Started
- **[Quick Start Guide](docs/QUICKSTART.md)** - Fast onboarding for consultants and new team members
- **[Development Guide](docs/DEVELOPMENT.md)** - Detailed development workflow and best practices
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to this project

### Technical Documentation
- **[Architecture Overview](docs/ARCHITECTURE.md)** - System architecture and component design
- **[Registry Setup](docs/REGISTRY_SETUP.md)** - Container registry configuration and workflow

### External Resources
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Deno Documentation](https://deno.land/manual)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 🤝 Contributing

We welcome contributions from team members and consultants! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting pull requests.

**Quick contribution steps**:
1. Create a feature branch
2. Make changes in `dev/` environment
3. Test thoroughly with `./scripts/validate.sh`
4. Build and test in `test/` environment
5. Submit pull request with clear description

## 📄 License

[Add your license here]

## 📧 Support

For questions or issues, please contact the repository maintainer or open an issue on GitHub.

---

**Repository**: https://github.com/quaternaryps/doc-intelligence
**Maintained by**: Quaternary PS Team