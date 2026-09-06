### Building and running your application

When you're ready, start your application by running:
`docker compose up --build`.

The default stack uses the local PostgreSQL container. `.env.example` files are
templates only: Docker deliberately excludes them from images, and Compose
does not load them automatically. Put real values in a git-ignored env file
and pass it with `--env-file`.

### Running against Supabase

Create `build-backend-foundation/.env.supabase` from its `.env.example`, set
`DATABASE_TARGET=supabase`, provide the two database URLs and verified CA path,
and set `CORS_ORIGINS` to the deployed frontend origin. Then run from the
repository root:

```bash
docker compose \
	--env-file build-backend-foundation/.env.supabase \
	up --build -d
```

The API and migration container receive those values at runtime; credentials
are never copied into the Docker image. The local PostgreSQL service may still
start because it is part of the shared stack, but the API and migrations use
Supabase when `DATABASE_TARGET=supabase`.

### Deploying your application to the cloud

First, build your image, e.g.: `docker build -t myapp .`.
If your cloud uses a different CPU architecture than your development
machine (e.g., you are on a Mac M1 and your cloud provider is amd64),
you'll want to build the image for that platform, e.g.:
`docker build --platform=linux/amd64 -t myapp .`.

Then, push it to your registry, e.g. `docker push myregistry.com/myapp`.

Consult Docker's [getting started](https://docs.docker.com/go/get-started-sharing/)
docs for more detail on building and pushing.