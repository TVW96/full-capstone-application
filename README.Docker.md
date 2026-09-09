### Building and running your application

Copy the repository-root `.env.example` to the repository-root `.env`, then
start the complete application from the repository root:

```bash
docker compose up --build
```

Only nginx is published (`http://localhost:3000`). Browser requests to
`/api/*` are forwarded internally to `nestjs:3001`; the backend port is not
published separately.

The root `.env` is the only environment file. Compose loads it for variable
interpolation and passes only the relevant values to each application or build
runner (server-only secrets are not passed to the frontend). To verify each
application build separately:

```bash
docker compose run --rm --build frontend-build
docker compose run --rm --build backend-build
```

### Running against Supabase

In the root `.env`, set `DATABASE_TARGET=supabase`, provide the two database
URLs and Supabase values, and set `CORS_ORIGINS` and `FRONTEND_URL` to the
deployed frontend origin. Then run from the repository root:

```bash
docker compose up --build -d
```

The API and migration container receive those values at runtime; credentials
are never copied into the Docker image. The local PostgreSQL service may still
start because it is part of the shared stack, but the API and migrations use
Supabase when `DATABASE_TARGET=supabase`.

### Deploying your application to the cloud

Deploy the root Compose application to a Docker-capable host and expose only
the `nextjs` service publicly. Terminate HTTPS at the hosting platform or its
load balancer. If the Netlify site remains enabled, set its `UNIFIED_APP_URL`
environment variable to this Docker application's public HTTPS origin.

Consult Docker's [getting started](https://docs.docker.com/go/get-started-sharing/)
docs for more detail on building and pushing.
