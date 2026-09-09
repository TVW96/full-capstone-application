# Docker database modes

The repository-root `compose.yaml` and repository-root `.env` are canonical for
the complete application. The backend-only Compose files remain available for
isolated API development, but they must also be given the root env explicitly.

## Local PostgreSQL

Build the API and local database, apply migrations, and start the API:

```bash
docker compose --env-file ../.env -f compose.yaml -f compose.local.yaml build
docker compose --env-file ../.env -f compose.yaml -f compose.local.yaml up -d postgres
docker compose --env-file ../.env -f compose.yaml -f compose.local.yaml run --rm nestjs npm run migration:run:compiled
docker compose --env-file ../.env -f compose.yaml -f compose.local.yaml up -d nestjs
```

The named `manga-marketplace-data` volume preserves real application data
between container restarts. Removing that volume is intentionally a separate,
explicit operation and creates an empty database after the next migration run.

## Supabase PostgreSQL

Use the repository-root `.env`, select `DATABASE_TARGET=supabase`, and provide
`DATABASE_URL`, `MIGRATION_DATABASE_URL`, and `DATABASE_SSL_CA_FILE`. The
repository includes the public Supabase CA certificate at the example path.
Run these commands from the repository root:

```bash
docker compose build
docker compose run --rm --no-deps migrate
docker compose up -d
```

The standalone migration command skips the local PostgreSQL dependency. The
complete root stack still starts its local PostgreSQL service, but the API and
migration runner connect to Supabase whenever `DATABASE_TARGET=supabase`.

The API is available at <http://localhost:3001>; the frontend runs separately
at <http://localhost:3000>. Set `API_PORT` if port 3001 is already in use.
