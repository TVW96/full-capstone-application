# Inspection-controlled marketplace transactions

This implementation uses Stripe Connect **separate charges and transfers**.
The buyer pays the marketplace through Stripe-hosted Checkout. No transfer to
the seller is created until operations has recorded both a successful physical
verification and outbound carrier handoff.

This is deliberately described as delayed seller payment, not legal escrow.
Stripe says it is not an escrow provider. The business model, customer
contracts, states served, goods, average order value, refund rules, and typical
payout delay require written Stripe underwriting approval and qualified
payments counsel before any live transaction.

## Funds and item flow

```text
buyer -> Stripe platform charge
seller -> assigned verification hub -> buyer
Stripe platform balance -> seller connected balance (only after hub ships)
```

The release predicate enforced by the backend is:

```text
payment confirmed
AND one onboarded seller owns every listing in the checkout
AND physical verification passed
AND outbound carrier/tracking recorded
AND seller transfers and payouts are enabled
AND charge is not refunded or disputed
AND no transfer already exists
```

The Stripe Transfer moves the seller net amount to the seller's connected
Stripe balance. A later Stripe Payout moves available funds to the seller's
bank; those are distinct events.

## Order states

The normal path is:

```text
awaiting_location
  -> awaiting_seller_shipment
  -> inbound_in_transit
  -> under_verification
  -> verified
  -> outbound_shipped
  -> transfer_processing
  -> completed
```

A failed inspection follows:

```text
under_verification
  -> verification_failed
  -> refund_pending
  -> refunded | refund_failed
```

Disputes and transfer reversals are separate terminal-review states. Every
transition writes an append-only `order_events` row. Signed Stripe events are
deduplicated in `stripe_webhook_events` so retries cannot repeat fulfillment.

## Required configuration

Use the repository-root `.env`; it is git-ignored. Never put a secret key in a
browser variable, source file, ticket, chat, or commit.

- `STRIPE_SECRET_KEY`: server-only **test key** until live launch is approved.
- `STRIPE_WEBHOOK_SECRET`: endpoint signing secret (`whsec_...`), which is not
  the API key.
- `STRIPE_LIVE_MODE_ENABLED`: leave `false` during development and launch
  review. A live key is rejected unless this is explicitly `true` and
  `NODE_ENV=production`; signed webhook event mode must also match the key.
- `STRIPE_CONNECT_RETURN_URL`: HTTPS seller-onboarding return URL.
- `STRIPE_CONNECT_REFRESH_URL`: HTTPS URL used when an onboarding link expires.
- `MARKETPLACE_FEE_BPS`: integer fee retained from merchandise, in basis points
  (`1000` means 10%). It is required in production and capped at 50% by code.
- `DEFAULT_VERIFICATION_LOCATION_CODE`: optional active hub code. When empty,
  paid orders wait in the staff assignment queue.
- `FRONTEND_URL`: deployed frontend origin.
- `STRIPE_ALLOWED_SHIPPING_COUNTRIES`: comma-separated ISO country codes.
- `STRIPE_STANDARD_SHIPPING_RATE_ID` and
  `STRIPE_EXPRESS_SHIPPING_RATE_ID`: reviewed production shipping rates.
- `STRIPE_AUTOMATIC_TAX=true`: only after tax registrations and product tax
  treatment are configured.

No Stripe publishable key is needed by the current frontend. Both Checkout and
Connect onboarding are server-created hosted redirects.

Production intentionally refuses checkout without fee and Shipping Rate
configuration. Development supplies fixed test rates only.

## Initial setup

1. Enable Stripe Connect and confirm with Stripe that the account is approved
   for a marketplace with seller-to-hub-to-buyer shipping and delayed transfers.
2. Configure only test-mode API and webhook secrets.
3. Apply the new schema:

   ```bash
   npm run migration:run:local
   # or
   npm run migration:run:supabase
   ```

4. Create a normal application account for the first trusted operator, then
   promote it out of band in PostgreSQL:

   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'operator@example.com';
   ```

   Never expose a public role-promotion endpoint.

5. Sign in as that operator, open `/operations`, and create the first physical
   verification location. Set its code as
   `DEFAULT_VERIFICATION_LOCATION_CODE` if all launch orders use it.
6. Each seller opens `/account/payouts` and completes Stripe-hosted onboarding.
   Listings cannot be published or purchased until Stripe reports submitted
   details plus active transfer and payout capability.
7. Exercise the full success, failed-inspection/refund, duplicate-webhook,
   dispute, and transfer-retry paths in test mode before requesting live access.

## Webhooks

Register this public HTTPS endpoint:

`POST https://YOUR-API-HOST/payments/webhook`

Subscribe to platform events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`
- `refund.created`
- `refund.updated`
- `refund.failed`
- `transfer.reversed`

Subscribe to Connect events for `account.updated`. Ensure the endpoint receives
connected-account events, not only the platform's own account events.

For local testing, forward events with the Stripe CLI to
`http://127.0.0.1:3001/payments/webhook` and put the CLI-provided signing
secret in `STRIPE_WEBHOOK_SECRET`.

The redirect success page is not proof of payment. It calls the authenticated
buyer status endpoint and clears the cart only after the signed webhook creates
an order belonging to that buyer.

## Application endpoints

Buyer and checkout:

- `POST /payments/checkout-session` — authenticated; reserves active listings
  and opens Stripe Checkout. The launch version accepts one seller per checkout.
- `GET /payments/buyer/orders`
- `GET /payments/buyer/checkout/:sessionId`

Seller:

- `POST /payments/seller/onboarding-link`
- `GET /payments/seller/payment-status`
- `GET /payments/seller/orders`
- `POST /payments/seller/orders/:orderId/inbound-shipment`

Staff (requires a signed-in `operations` or `admin` user):

- `GET|POST /payments/operations/locations`
- `GET /payments/operations/orders?status=...`
- `POST /payments/operations/orders/:orderId/location`
- `POST /payments/operations/orders/:orderId/received`
- `POST /payments/operations/orders/:orderId/verification`
- `POST /payments/operations/orders/:orderId/outbound-shipment`
- `POST /payments/operations/orders/:orderId/release-seller-funds`
- `POST /payments/operations/orders/:orderId/refund`

The release and refund calls use stable Stripe idempotency keys. A failed API
call leaves an explicit retry state rather than silently advancing the order.
A transfer stuck in `transfer_processing` can be reconciled through the same
release endpoint after five minutes; the same idempotency key recovers the
original Stripe result rather than creating a second transfer. Once a transfer
has been attempted, the refund endpoint stays blocked until that attempt is
reconciled.

## Accounting and operating policy still required

The seller gross/net ledger covers merchandise only. `amount_total` also
contains buyer shipping and possibly tax. Before live use, document who pays
both shipping legs, Stripe processing fees, failed-inspection shipping,
returns, and chargebacks. Reconcile daily among Stripe balances, the bank
account, and the per-order ledger. `transfer_group` associates records but does
not segregate funds by order. Configure the platform payout schedule and a
minimum operating/refund reserve with Stripe so automatic platform payouts do
not leave transfers, refunds, or disputes underfunded.

This code does not yet purchase labels, verify carrier acceptance directly,
store inspection photos, implement dual approval, maintain a rolling reserve,
or run a scheduled Stripe reconciliation worker. The prototype frontend also
stores its bearer session in browser storage; replace that with a same-origin,
secure `HttpOnly` cookie design with CSRF/origin controls before production.
Those controls should be added before meaningful live volume. Refunds after a
seller transfer require a transfer reversal and manual reconciliation; the API
intentionally refuses to pretend that reversal and refund are atomic.

## Legal launch gate

The marketplace should not self-custody buyer money in its operating bank
account. Before live mode, counsel should approve the state-by-state money
transmission/escrow analysis, seller appointment and clawback language,
consumer refund and dispute terms, sanctions/KYC responsibilities, tax
reporting, privacy retention, abandoned-property treatment, and insurance for
goods held at verification locations.
