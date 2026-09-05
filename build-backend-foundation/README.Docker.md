# Docker database modes

The base Compose file contains only the API. A local override adds PostgreSQL
and the health-gated dependency, while Supabase mode leaves the API independent
of a local database container.

## Local PostgreSQL

Build the API and local database, apply migrations, and start the API:

```bash
docker compose -f compose.yaml -f compose.local.yaml build
docker compose -f compose.yaml -f compose.local.yaml up -d postgres
docker compose -f compose.yaml -f compose.local.yaml run --rm nestjs npm run migration:run:compiled
docker compose -f compose.yaml -f compose.local.yaml up -d nestjs
```

The named `manga-marketplace-data` volume preserves data between container
restarts. Removing that volume is intentionally a separate, explicit operation.

## Supabase PostgreSQL

Copy `.env.example` to the git-ignored `.env.supabase` file, select
`DATABASE_TARGET=supabase`, and provide `DATABASE_URL`,
`MIGRATION_DATABASE_URL`, and `DATABASE_SSL_CA_FILE`. The repository includes
the public Supabase CA certificate at the example path. Then run:

```bash
docker compose --env-file .env.supabase -f compose.yaml -f compose.supabase.yaml build
docker compose --env-file .env.supabase -f compose.yaml -f compose.supabase.yaml run --rm nestjs npm run migration:run:compiled
docker compose --env-file .env.supabase -f compose.yaml -f compose.supabase.yaml up -d
```

The cloud command does not create or wait for a local PostgreSQL container.

The API is available at <http://localhost:3001>; the frontend runs separately
at <http://localhost:3000>. Set `API_PORT` if port 3001 is already in use.
