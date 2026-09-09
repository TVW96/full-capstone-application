# Manga Marketplace capstone

This repository contains a statically exported Next.js frontend and a NestJS
API backed by either local PostgreSQL or Supabase PostgreSQL.

The Stripe Connect seller onboarding, verification-hub workflow, refund path,
seller release gate, and live-launch checklist are documented in
[`build-backend-foundation/docs/payments-and-shipping.md`](build-backend-foundation/docs/payments-and-shipping.md).

## One environment file

The root [`.env.example`](.env.example) is the only environment template. Copy
it once and keep all local, Compose, frontend-build, and backend-build settings
in the resulting git-ignored root file:

```bash
cp .env.example .env
```

For local PostgreSQL, leave `DATABASE_TARGET=local`. To use Supabase, set:

```dotenv
DATABASE_TARGET=supabase
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:5432/postgres
MIGRATION_DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
```

Use the session pooler URL on port 5432 for a persistent API host that cannot
reach Supabase over IPv6. Use the direct URL for migrations when the migration
host supports IPv6. Percent-encode reserved characters in the database
password. The included Supabase CA is selected by `DATABASE_SSL_CA_FILE`.

The complete application uses the root file automatically:

```bash
docker compose up --build
```

Nginx is the only public application entrypoint. The frontend calls `/api`, and
nginx forwards that path to `nestjs:3001` over the private Compose network. The
NestJS port is not published separately.

The two isolated Compose build checks use that same file:

```bash
docker compose run --rm --build frontend-build
docker compose run --rm --build backend-build
```

## Netlify

The production runtime is the unified Docker application. Netlify can continue
serving the static frontend at `https://manga-marketplace.netlify.app`; its
`/api/*` requests are proxied to the public HTTPS origin of the Docker app.

Set this environment variable in the Netlify dashboard:

```dotenv
UNIFIED_APP_URL=https://your-docker-app.example
```

Do not set it to the Netlify URL or include a path. `netlify.toml` supplies
`NEXT_PUBLIC_BACKEND_API_URL=/api`, and the build generates the corresponding
Netlify proxy rule without exposing database credentials.

The single Netlify dashboard build command is:

```text
npm run build:netlify
```

The repository's `netlify.toml` sets the base directory to
`build-frontend-foundation` and the publish directory to `out`. The build fails
clearly until `UNIFIED_APP_URL` contains the deployed Docker app's HTTPS origin.
