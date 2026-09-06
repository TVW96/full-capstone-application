# Build Frontend Foundation

## What am I advertising ⛩️?

* New, like-new/refurbished, and secondhand manga and books
* Vintage and retro manga-related memorabilia
* Japanese-inspired house and room décor
* Collectible items for readers, fans, and collectors

## Who is the main audience 🐲?

* Teen and young adult audiences ages 13+
* Japanese manga and comic enthusiasts
* Beginning and advanced Japanese-language learners
* Collectors, traders, merchants, and independent sellers

## What is MangaMarketplace 🏠?

MangaMarketplace is a trustworthy, technically focused secondhand marketplace built around manga, books, collectibles, and related merchandise.

The platform gives users a place to upgrade their collections, discover new material, explore manga-related products, and sell or auction items they no longer have space for.

Our primary goal is to create a marketplace centered on the circulation and reuse of secondhand manga. Instead of unwanted volumes sitting unused on a shelf, MangaMarketplace helps them find new homes.

Users can sell individual volumes, combine separate books into complete or partial collections, trade collectible items, or purchase books that fit naturally into an existing collection.

The marketplace should make it easier to:

* Fill missing volumes in an existing manga series
* Build a collection one volume at a time
* Buy complete or partial manga sets
* Resell books that are no longer wanted
* Discover older, uncommon, vintage, or collectible items
* Find manga and Japanese reading material for language study
* Connect buyers, collectors, and sellers through one organized marketplace

The frontend should communicate a balance between **modern e-commerce, secondhand trading, Japanese pop culture, and collector culture** while remaining approachable to users who may simply be looking for their next book.

## Start selling

The `/sell/` page supports single copies and bundles, catalog selection or new
book details, photo uploads, pricing, and review before publication. See
[the selling workflow](docs/selling.md) for API setup, limits, and verification.

## Account API configuration

Copy `.env.example` to `.env` when the backend is not available at the default
local address. `NEXT_PUBLIC_BACKEND_API_URL` is used by browser requests and
`BACKEND_API_URL` by server rendering; both point to the NestJS API, which is
`http://127.0.0.1:3001` in local development. PostgreSQL and Supabase server
credentials must never be added to the frontend environment.

## GitHub Pages deployment

The Pages workflow creates a static export in `out` and deploys it whenever
`main` changes. In the repository's **Settings → Secrets and variables →
Actions → Variables**, add `NEXT_PUBLIC_BACKEND_API_URL` with the public HTTPS
URL of the deployed API. The API must also include the GitHub Pages site origin
in its `CORS_ORIGINS` setting. GitHub Pages hosts only the frontend files; it
does not run the NestJS backend.

## Netlify deployment

Netlify also hosts only the static frontend. Deploy the NestJS API separately,
then add its public HTTPS origin as the `NEXT_PUBLIC_BACKEND_API_URL` Netlify
environment variable before building. The frontend uses that value for browser
requests and static page generation; do not use `localhost` or a Docker service
name.

Configure the API deployment with `DATABASE_TARGET=supabase`, the runtime
`DATABASE_URL`, migration `MIGRATION_DATABASE_URL`,
`DATABASE_SSL_CA_FILE` (or `DATABASE_SSL_CA`), and
`CORS_ORIGINS=https://your-site.netlify.app`. Run the migrations against the
Supabase database before starting the API. Supabase dashboard data is not
available to Netlify directly: the browser reads listings from the NestJS API.
