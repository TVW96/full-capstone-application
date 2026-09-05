# Start selling

`/sell/` uses the existing account session and a three-step form: copies and
photos, listing details, then review and publish. Anonymous visitors go to
`/sell/signup-prompt/`. An account-service outage shows a retry state rather
than claiming the visitor is signed out.

A listing can include 1–8 physical copies. Each copy references an existing
catalog release or supplies a new title, with condition and optional notes.
Photos support selection, drag/drop, removal, and choosing the cover. Limits
are at least one photo per copy, eight photos per listing, 8 MiB per image, and
32 MiB total. The server decodes images and accepts at most 25 megapixels.
Prices are USD, positive, with at most two decimal places.

The form sends one authenticated multipart request to `POST /sell/listings`.
It uses `NEXT_PUBLIC_BACKEND_API_URL`, like the existing account client. Deploy
the matching backend changes before using publication. Supabase Storage and
database credentials stay on the backend. The frontend remains compatible
with the existing static export / GitHub Pages deployment.

The backend creates/reuses catalog metadata, creates seller-owned inventory,
creates the active listing and its listing-item junctions, and publishes image
relationships in one database transaction. A submission UUID makes repeat
requests return the same listing. Network/ambiguous server failures retain the
submission and lock edits until a retry confirms the result. Definitive input
errors allow editing. An expired session can be renewed in another tab.

Work is held in this page’s memory, including local photo previews; there is
no saved-draft claim. Refreshing or leaving before publication can lose it.
The browser warns on unload. Successful publication shows the persisted
listing reference and links to the marketplace. Shop cards display each
copy’s uploaded cover using the compatibility `sellerPhotoPath` field.

## Verification

- `npm run build` verifies the static export and TypeScript.
- `npm run lint` checks frontend source.
- Backend tests cover authenticated ownership, bundles, catalog reuse, photo
  relationships, retry deduplication, validation, rollback cleanup, and real
  image decoding with mocked object storage.
- Browser checks use mocked account/catalog/publication responses, exercise
  missing-photo validation, unsupported files, single copies, mixed-catalog
  bundles, publication, network-failure retries, and anonymous access. Layouts
  were checked at 320, 390, 768, and 1440px, including light and dark themes.
  They do not publish test listings into the
  configured database or upload to the real Supabase bucket.
