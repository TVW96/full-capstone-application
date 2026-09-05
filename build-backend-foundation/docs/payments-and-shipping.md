# Stripe payments and shipping setup

The backend creates Stripe Checkout Sessions from active database listings. It never accepts prices from the browser. Creating a session reserves each unique secondhand listing for 30 minutes; a signed `checkout.session.expired` event releases it, while a paid event creates an order and marks its inventory sold.

## Required configuration

Copy the Stripe entries from `.env.example` into the deployment environment and set:

- `STRIPE_SECRET_KEY` to a restricted test or live secret key.
- `STRIPE_WEBHOOK_SECRET` to the signing secret for the backend webhook endpoint.
- `FRONTEND_URL` to the deployed frontend origin, including any required base path.
- `STRIPE_ALLOWED_SHIPPING_COUNTRIES` to the supported ISO country codes.
- `STRIPE_STANDARD_SHIPPING_RATE_ID` and `STRIPE_EXPRESS_SHIPPING_RATE_ID` to active rates created and reviewed in Stripe.
- `STRIPE_AUTOMATIC_TAX=true` only after Stripe Tax registrations and product tax behavior are configured.

Production intentionally refuses to create a Checkout Session without both Stripe Shipping Rate IDs. Development uses clearly labeled fixed test rates so the flow can be exercised before carrier operations are connected.

## Webhook

Register this public HTTPS endpoint in Stripe:

`POST https://YOUR-API-HOST/payments/webhook`

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`

For local testing, forward events with the Stripe CLI to `http://127.0.0.1:3001/payments/webhook` and use the CLI-provided signing secret as `STRIPE_WEBHOOK_SECRET`.

## Database

Run `npm run migration:run:supabase` for Supabase or `npm run migration:run:local` for local PostgreSQL. The migrations create order records, listing reservations, and row-level-security lockdown for payment and delivery data.

## Shipping verification boundary

Stripe Checkout collects a structured address and limits destinations to configured countries. Stripe Shipping Rate IDs make the available methods server-controlled. This does not prove carrier deliverability or purchase a label. Connect a carrier/rating provider before promising live carrier rates, deliverability verification, or automatic label generation.
