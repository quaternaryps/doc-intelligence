# Architecture Overview

This document describes the architecture of the Doc Intelligence container stack.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Doc Intelligence Stack                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐       ┌──────────────────────┐
│   External Users     │       │   Consultants/Devs   │
└──────────┬───────────┘       └──────────┬───────────┘
           │                              │
           │ HTTP                         │ HTTP
           │                              │
┌──────────▼──────────────────────────────▼───────────┐
│              Docker Host Network                     │
│  ┌─────────────────────────────────────────────┐   │
│  │           app-network (bridge)              │   │
│  │                                             │   │
│  │  ┌─────────────────┐  ┌──────────────────┐ │   │
│  │  │  Deno App       │  │  Python App      │ │   │
│  │  │  TypeScript     │  │  Processing      │ │   │
│  │  │  Port: 8000     │  │  Port: 8001      │ │   │
│  │  └────────┬────────┘  └────────┬─────────┘ │   │
│  │           │                    │           │   │
│  │           └──────────┬─────────┘           │   │
│  │                      │                     │   │
│  │           ┌──────────▼──────────┐          │   │
│  │           │   PostgreSQL DB     │          │   │
│  │           │   Port: 5432        │          │   │
│  │           │   Volume: pg-data   │          │   │
│  │           └─────────────────────┘          │   │
│  │                                             │   │
│  │           ┌─────────────────────┐          │   │
│  │           │  Storage Container  │          │   │
│  │           │  Volumes:           │          │   │
│  │           │  - /data            │          │   │
│  │           │  - /json            │          │   │
│  │           └─────────────────────┘          │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Components

### 1. Deno TypeScript Application

**Purpose**: RESTful API service for document intelligence operations

**Technology**: 
- Deno runtime (secure by default)
- TypeScript
- Native HTTP server

**Responsibilities**:
- HTTP API endpoints
- Request routing
- Business logic processing
- Database queries
- File operations

**Exposed Ports**:
- Dev: 8000
- Test: 8100
- Prod: 8200

**Dependencies**:
- PostgreSQL database

### 2. Python Application

**Purpose**: Document processing and analysis service

**Technology**:
- Python 3.11
- Built-in HTTP server
- Data processing libraries

**Responsibilities**:
- Document parsing
- Data analysis
- Background processing
- Report generation

**Exposed Ports**:
- Dev: 8001
- Test: 8101
- Prod: 8201

**Dependencies**:
- PostgreSQL database

### 3. PostgreSQL Database

**Purpose**: Persistent data storage

**Technology**:
- PostgreSQL 16 (Alpine)
- JSONB support for flexible data

**Responsibilities**:
- Store document metadata
- Track processing jobs
- User data
- Application state

**Exposed Ports**:
- Dev: 5432
- Test: 5433
- Prod: 5434

**Schema**:
- `documents` table - Document metadata
- `processing_jobs` table - Job tracking
- Extensible with JSONB fields

**Volumes**:
- Named volume for data persistence
- Survives container restarts

### 4. Storage Container

**Purpose**: File and JSON data persistence

**Technology**:
- Alpine Linux (minimal)
- Mounted volumes

**Responsibilities**:
- Store uploaded files
- Store JSON configurations
- Provide shared storage

**Volumes**:
- `/data` - File storage
- `/json` - JSON data

## Network Architecture

### Docker Networks

Each environment has an isolated bridge network:

- `dev-app-network` - Development environment
- `test-app-network` - Test environment
- `prod-app-network` - Production environment

**Benefits**:
- Service discovery by name
- Network isolation between environments
- Internal communication without exposed ports

### Service Communication

**Internal Communication** (within Docker network):
```
deno-app → postgres:5432
python-app → postgres:5432
deno-app → python-app:8001
python-app → deno-app:8000
```

**External Access** (from host):
```
Host → localhost:8000 → deno-app:8000
Host → localhost:8001 → python-app:8001
Host → localhost:5432 → postgres:5432
```

## Data Flow

### Document Upload Flow

```
1. Client → HTTP POST → Deno App :8000
2. Deno App → Save metadata → PostgreSQL
3. Deno App → Save file → Storage:/data
4. Deno App → Create job → PostgreSQL
5. Deno App → Notify → Python App
6. Python App → Process file ← Storage:/data
7. Python App → Update job → PostgreSQL
8. Python App → Save result → Storage:/json
9. Client ← Response ← Deno App
```

### Database Query Flow

```
1. Client → HTTP GET → Deno/Python App
2. App → SQL Query → PostgreSQL
3. PostgreSQL → Results → App
4. App → JSON Response → Client
```

## Volume Architecture

### Named Volumes

Each environment maintains separate volumes:

**Development**:
- `dev-postgres-data`
- `dev-storage-data`
- `dev-json-data`
- `dev-deno-cache`
- `dev-python-cache`

**Test**:
- `test-postgres-data`
- `test-storage-data`
- `test-json-data`

**Production**:
- `prod-postgres-data`
- `prod-storage-data`
- `prod-json-data`

### Volume Benefits

1. **Persistence**: Data survives container restarts
2. **Isolation**: Each environment has separate data
3. **Performance**: Better I/O than bind mounts
4. **Portability**: Easy backup and restore

## Environment Differences

### Development

**Characteristics**:
- Volume mounts for hot reload
- Debug logging enabled
- Lower security requirements
- Development credentials

**Configuration**:
```yaml
volumes:
  - ./deno-app:/app  # Live code reload
environment:
  ENV: development
  LOG_LEVEL: debug
```

### Test

**Characteristics**:
- Similar to production
- Test data isolation
- Integration testing
- No volume mounts

**Configuration**:
```yaml
# No source mounts
environment:
  ENV: test
  LOG_LEVEL: info
```

### Production

**Characteristics**:
- Resource limits
- Auto-restart always
- Secure credentials
- Optimized images

**Configuration**:
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
restart: always
environment:
  ENV: production
  LOG_LEVEL: warning
```

## Deployment Architecture

### Single Host Deployment

```
┌─────────────────────────────────────┐
│         Docker Host                 │
│  ┌──────────┬──────────┬─────────┐ │
│  │   Dev    │   Test   │  Prod   │ │
│  │  :8000   │  :8100   │  :8200  │ │
│  │  :8001   │  :8101   │  :8201  │ │
│  │  :5432   │  :5433   │  :5434  │ │
│  └──────────┴──────────┴─────────┘ │
└─────────────────────────────────────┘
```

### Multi-Host Deployment

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Dev Host    │  │  Test Host   │  │  Prod Host   │
│  :8000       │  │  :8100       │  │  :8200       │
│  :8001       │  │  :8101       │  │  :8201       │
│  :5432       │  │  :5433       │  │  :5434       │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Container Registry Flow

### Build → Test → Deploy

```
Developer Workflow:
1. Code Changes → dev/
2. Test Locally → docker compose up
3. Build Images → ./scripts/build.sh test
4. Push to Registry → ./scripts/push.sh
5. CI/CD Pipeline → Automated Tests
6. Deploy to Test → Pull from registry
7. Manual Testing
8. Promote to Prod → ./scripts/push.sh prod
9. Deploy to Prod → Pull from registry

Consultant Workflow:
1. Pull from Registry → ./scripts/pull.sh
2. Start Services → docker compose up
3. Review & Test
4. Provide Feedback
```

## Security Architecture

### Network Security

- **Isolation**: Services on private bridge network
- **Exposure**: Only necessary ports exposed to host
- **Firewall**: Host firewall controls external access

### Application Security

- **Non-root**: Python app runs as non-root user
- **Secrets**: Environment variables, never in code
- **Updates**: Regular base image updates

### Data Security

- **Encryption**: Use TLS for production (external proxy)
- **Backups**: Regular volume backups
- **Access Control**: Database user permissions

## Scalability Considerations

### Horizontal Scaling

```
┌─────────────────────────────────────────┐
│           Load Balancer                 │
└──────────┬──────────────────────────────┘
           │
    ┌──────┴──────┬──────────────┐
    │             │              │
┌───▼───┐    ┌───▼───┐     ┌───▼───┐
│Deno-1 │    │Deno-2 │     │Deno-3 │
└───┬───┘    └───┬───┘     └───┬───┘
    │             │              │
    └──────┬──────┴──────────────┘
           │
      ┌────▼─────┐
      │PostgreSQL│
      └──────────┘
```

### Vertical Scaling

Adjust resource limits in docker-compose.yml:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 1024M
```

## Monitoring & Logging

### Health Checks

Each service provides health endpoints:
- `http://service:port/health`

Docker uses these for:
- Container health status
- Dependency ordering
- Auto-restart decisions

### Logging

```
Application Logs → stdout/stderr → Docker logs
                                        ↓
                                  docker compose logs
                                        ↓
                            External logging system (optional)
```

## Future Enhancements

Potential architectural improvements:

1. **Message Queue** - Add Redis/RabbitMQ for async processing
2. **Caching** - Redis for application caching
3. **Object Storage** - S3-compatible storage
4. **Reverse Proxy** - Nginx/Traefik for routing
5. **Service Mesh** - For microservices communication
6. **Monitoring** - Prometheus + Grafana
7. **Log Aggregation** - ELK stack or Loki

## References

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Networking](https://docs.docker.com/network/)
- [Docker Volumes](https://docs.docker.com/storage/volumes/)
- [PostgreSQL Docker](https://hub.docker.com/_/postgres)
- [Deno Manual](https://deno.land/manual)
