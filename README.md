# Calmis

Calmis is a lab report ingestion API and parser for HL7-style hematology analyzer output.
It can:

- Parse raw analyzer text payloads
- Validate and flag abnormal values
- Store parsed reports in PostgreSQL via Prisma
- Expose report query endpoints through Express

## Tech Stack

- Bun (runtime and package manager)
- TypeScript
- Express 5
- Prisma 7
- PostgreSQL 16 (via Docker Compose)

## Prerequisites

- Bun 1.3+
- Docker Desktop (or Docker Engine)
- Node.js 18+ (recommended for Prisma CLI compatibility)

## 1) Install Dependencies

```bash
bun install
```

## 2) Configure Environment

This project already includes a `.env` file. Ensure these values are correct for your machine:

```env
DATABASE_URL="postgresql://admin:admin@localhost:5555/hospital_lab_db"
API_PORT=3000
NODE_ENV=development
LOG_LEVEL=INFO
LOG_DIR=./logs
```

If you change database credentials in Docker, update `DATABASE_URL` accordingly.

## 3) Start PostgreSQL

```bash
docker compose up -d
```

This starts:

- Postgres container: `calmis_pg`
- Port mapping: `localhost:5555 -> container:5432`
- Database: `hospital_lab_db`

## 4) Prepare Database (Prisma)

Run these in order:

```bash
bun run db:generate
bun run db:migrate
```

Optional utilities:

```bash
bun run db:studio
bun run db:validate
```

## 5) Run the API

```bash
bun run start:dev
```

API base URL:

```text
http://localhost:3000/api/v1
```

Health check:

```bash
curl http://localhost:3000/api/v1/health
```

## 6) Parse Local Sample Without API (optional)

To parse `data/raw.txt` directly from the CLI:

```bash
bun run index.ts
```

## API Endpoints

Base prefix: `/api/v1`

- `GET /health`
- `POST /reports/parse`
- `GET /reports`
- `GET /reports/:reportId`
- `GET /reports/:reportId/results`
- `GET /reports/:reportId/abnormal`
- `GET /reports/search`
- `POST /reports/:reportId/validate`
- `DELETE /reports/:reportId`
- `GET /reference-ranges/:testCode`

## Parse Report Example

### Option A: Send plain text body

```bash
curl -X POST http://localhost:3000/api/v1/reports/parse \
	-H "Content-Type: text/plain" \
	-H "x-analyzer-id: XN-330" \
	--data-binary @data/raw.txt
```

### Option B: Send JSON body

```bash
curl -X POST http://localhost:3000/api/v1/reports/parse \
	-H "Content-Type: application/json" \
	-d "{\"analyzerId\":\"XN-330\",\"rawData\":\"H|...\"}"
```

## Common Commands

```bash
# Start database
docker compose up -d

# Stop database
docker compose down

# Start API
bun run start:dev

# Parse sample from file
bun run index.ts

# Prisma migration flow
bun run db:generate
bun run db:migrate
```

## Troubleshooting

### Prisma cannot connect to database

- Check Docker container is running: `docker ps`
- Confirm `DATABASE_URL` in `.env`
- Confirm Postgres port `5555` is free

### API starts but requests fail

- Check API logs in `logs/`
- Confirm JSON/text payload format for `/reports/parse`
- Verify database migration was applied

### Port conflicts

- Change `API_PORT` in `.env` if port `3000` is occupied
- Change Docker port mapping in `docker-compose.yml` if `5555` is occupied

## Project Structure

```text
api/report.ts             # Express API server
services/labornak.ts      # HL7 parser
services/queryService.ts  # Database service (Prisma)
prisma/schema.prisma      # Database schema
data/raw.txt              # Sample raw analyzer payload
```
