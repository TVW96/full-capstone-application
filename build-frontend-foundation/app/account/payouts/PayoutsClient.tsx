"use client";

import { readSession } from "@/app/account/_lib/client-api";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import styles from "./payouts.module.css";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:3001"
).replace(/\/$/, "");

type PaymentStatus = {
  connected: boolean;
  detailsSubmitted: boolean;
  transfersEnabled: boolean;
  payoutsEnabled: boolean;
  ready: boolean;
  requirementsDue: string[];
};

type Address = {
  line1: string;
  line2?: string | null;
  city: string;
  administrativeArea: string;
  postalCode: string;
  country: string;
};

type SellerOrder = {
  orderId: string;
  status: string;
  transferStatus: string;
  currency: string;
  sellerGrossAmount: number;
  platformFeeAmount: number;
  sellerNetAmount: number;
  createdAt: string;
  transferredAt: string | null;
  items: Array<{ listingId: string; title: string; unitAmount: number }>;
  verificationLocation: {
    code: string;
    name: string;
    address: Address;
  } | null;
  inboundShipment: {
    carrier: string;
    trackingNumber: string;
    shippedAt: string;
    receivedAt: string | null;
  } | null;
  outboundShipment: {
    carrier: string;
    trackingNumber: string;
    shippedAt: string;
  } | null;
};

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

async function authorizedFetch(path: string, init: RequestInit = {}) {
  const session = readSession();
  if (!session) throw new Error("Sign in to manage seller payments.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${apiBaseUrl}${path}`, { ...init, headers, cache: "no-store" });
}

function ShipmentForm({
  onSaved,
  orderId,
}: {
  onSaved: () => Promise<void>;
  orderId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await authorizedFetch(
        `/payments/seller/orders/${encodeURIComponent(orderId)}/inbound-shipment`,
        {
          method: "POST",
          body: JSON.stringify({
            carrier: String(data.get("carrier") ?? ""),
            trackingNumber: String(data.get("trackingNumber") ?? ""),
          }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string | string[];
        };
        throw new Error(
          Array.isArray(body.message)
            ? body.message.join(" ")
            : body.message || "Tracking could not be saved.",
        );
      }
      await onSaved();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Tracking could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.shipmentForm} onSubmit={submit}>
      <label>
        Carrier
        <input maxLength={80} name="carrier" placeholder="USPS" required />
      </label>
      <label>
        Tracking number
        <input
          maxLength={120}
          name="trackingNumber"
          placeholder="9400…"
          required
        />
      </label>
      <button disabled={busy} type="submit">
        {busy ? "Saving…" : "Confirm shipment to hub"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

export default function PayoutsClient() {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    await Promise.resolve();
    setError("");
    try {
      const [statusResponse, ordersResponse] = await Promise.all([
        authorizedFetch("/payments/seller/payment-status"),
        authorizedFetch("/payments/seller/orders"),
      ]);
      if (!statusResponse.ok || !ordersResponse.ok) {
        throw new Error("Seller payment details are temporarily unavailable.");
      }
      setPaymentStatus((await statusResponse.json()) as PaymentStatus);
      setOrders((await ordersResponse.json()) as SellerOrder[]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Seller payment details are temporarily unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const startOnboarding = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await authorizedFetch(
        "/payments/seller/onboarding-link",
        { method: "POST" },
      );
      const body = (await response.json().catch(() => ({}))) as {
        url?: string;
        message?: string | string[];
      };
      if (!response.ok || !body.url) {
        throw new Error(
          Array.isArray(body.message)
            ? body.message.join(" ")
            : body.message || "Stripe onboarding could not be started.",
        );
      }
      window.location.assign(body.url);
    } catch (onboardingError) {
      setError(
        onboardingError instanceof Error
          ? onboardingError.message
          : "Stripe onboarding could not be started.",
      );
      setBusy(false);
    }
  };

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <p>Seller operations</p>
        <h1>Payments and verification orders</h1>
        <span>
          Buyer payment remains in the marketplace&apos;s Stripe balance until the
          item passes verification and the outbound carrier accepts it.
        </span>
      </header>

      <div className={styles.content}>
        <Link className={styles.back} href="/account">
          ← Back to account
        </Link>
        {error && <p className={styles.error} role="alert">{error}</p>}

        <section className={styles.connection}>
          <div>
            <p>Stripe Connect</p>
            <h2>
              {paymentStatus?.ready
                ? "Ready to receive seller funds"
                : "Complete payout onboarding"}
            </h2>
            <span>
              Bank and identity details go directly to Stripe. The marketplace
              stores only the connected-account reference and readiness flags.
            </span>
          </div>
          <button disabled={busy || loading} onClick={startOnboarding} type="button">
            {busy
              ? "Opening Stripe…"
              : paymentStatus?.connected
                ? "Continue Stripe onboarding"
                : "Start Stripe onboarding"}
          </button>
        </section>

        <section className={styles.orders}>
          <div className={styles.heading}>
            <div>
              <p>Sold listings</p>
              <h2>Verification queue</h2>
            </div>
            <button disabled={loading} onClick={() => void load()} type="button">
              Refresh
            </button>
          </div>

          {loading ? (
            <p>Loading seller orders…</p>
          ) : orders.length === 0 ? (
            <p>No sold listings are waiting for action.</p>
          ) : (
            <div className={styles.orderGrid}>
              {orders.map((order) => (
                <article className={styles.orderCard} key={order.orderId}>
                  <header>
                    <div>
                      <p>{new Date(order.createdAt).toLocaleDateString()}</p>
                      <h3>{order.items.map((item) => item.title).join(", ")}</h3>
                    </div>
                    <span>{statusLabel(order.status)}</span>
                  </header>
                  <dl>
                    <div>
                      <dt>Gross</dt>
                      <dd>{money(order.sellerGrossAmount, order.currency)}</dd>
                    </div>
                    <div>
                      <dt>Marketplace fee</dt>
                      <dd>{money(order.platformFeeAmount, order.currency)}</dd>
                    </div>
                    <div>
                      <dt>Seller net</dt>
                      <dd>{money(order.sellerNetAmount, order.currency)}</dd>
                    </div>
                    <div>
                      <dt>Transfer</dt>
                      <dd>{statusLabel(order.transferStatus)}</dd>
                    </div>
                  </dl>

                  {order.verificationLocation && (
                    <address>
                      <strong>Ship to {order.verificationLocation.name}</strong>
                      <br />
                      {order.verificationLocation.address.line1}
                      {order.verificationLocation.address.line2 && (
                        <>, {order.verificationLocation.address.line2}</>
                      )}
                      <br />
                      {order.verificationLocation.address.city},{" "}
                      {order.verificationLocation.address.administrativeArea}{" "}
                      {order.verificationLocation.address.postalCode}
                      <br />
                      {order.verificationLocation.address.country}
                    </address>
                  )}

                  {order.status === "awaiting_seller_shipment" && (
                    <ShipmentForm onSaved={load} orderId={order.orderId} />
                  )}
                  {order.inboundShipment && (
                    <p className={styles.tracking}>
                      Inbound: {order.inboundShipment.carrier} ·{" "}
                      {order.inboundShipment.trackingNumber}
                    </p>
                  )}
                  {order.outboundShipment && (
                    <p className={styles.tracking}>
                      Outbound: {order.outboundShipment.carrier} ·{" "}
                      {order.outboundShipment.trackingNumber}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
