"use client";

import { readSession } from "@/app/account/_lib/client-api";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import styles from "./operations.module.css";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:3001"
).replace(/\/$/, "");

type Location = {
  verificationLocationId: string;
  code: string;
  name: string;
  active: boolean;
};

type OperationsOrder = {
  orderId: string;
  status: string;
  transferStatus: string;
  amountTotal: number;
  sellerNetAmount: number;
  currency: string;
  createdAt: string;
  items: Array<{ title: string }>;
  seller: { email: string; payoutReady: boolean } | null;
  buyer: { email: string | null };
  verificationLocation: { code: string; name: string } | null;
  inboundShipment: { carrier: string; trackingNumber: string } | null;
  outboundShipment: { carrier: string; trackingNumber: string } | null;
  verificationFailureReason: string | null;
  transferFailureReason: string | null;
  refundFailureReason: string | null;
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

async function operationsFetch(path: string, init: RequestInit = {}) {
  const session = readSession();
  if (!session) throw new Error("Sign in with an operations account.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  return fetch(`${apiBaseUrl}${path}`, { ...init, headers, cache: "no-store" });
}

async function responseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    message?: string | string[];
  };
  return Array.isArray(body.message)
    ? body.message.join(" ")
    : body.message || "The operation could not be completed.";
}

export default function OperationsClient() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [orders, setOrders] = useState<OperationsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    await Promise.resolve();
    try {
      const [locationResponse, orderResponse] = await Promise.all([
        operationsFetch("/payments/operations/locations"),
        operationsFetch("/payments/operations/orders"),
      ]);
      if (!locationResponse.ok) throw new Error(await responseError(locationResponse));
      if (!orderResponse.ok) throw new Error(await responseError(orderResponse));
      setLocations((await locationResponse.json()) as Location[]);
      setOrders((await orderResponse.json()) as OperationsOrder[]);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The operations queue is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const command = async (
    orderId: string,
    path: string,
    body?: Record<string, unknown>,
  ) => {
    setBusyOrder(orderId);
    setError("");
    try {
      const response = await operationsFetch(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error(await responseError(response));
      await load();
    } catch (commandError) {
      setError(
        commandError instanceof Error
          ? commandError.message
          : "The operation could not be completed.",
      );
    } finally {
      setBusyOrder(null);
    }
  };

  const createLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusyOrder("location");
    setError("");
    try {
      const response = await operationsFetch("/payments/operations/locations", {
        method: "POST",
        body: JSON.stringify({
          code: data.get("code"),
          name: data.get("name"),
          address: {
            line1: data.get("line1"),
            line2: data.get("line2"),
            city: data.get("city"),
            administrativeArea: data.get("administrativeArea"),
            postalCode: data.get("postalCode"),
            country: data.get("country"),
          },
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      form.reset();
      await load();
    } catch (locationError) {
      setError(
        locationError instanceof Error
          ? locationError.message
          : "The location could not be created.",
      );
    } finally {
      setBusyOrder(null);
    }
  };

  return (
    <main className={styles.page} id="main-content">
      <header>
        <p>Restricted workspace</p>
        <h1>Verification operations</h1>
        <span>Receive, inspect, ship, and release funds in enforced order.</span>
      </header>
      <div className={styles.content}>
        {error && <p className={styles.error} role="alert">{error}</p>}

        <details className={styles.locationSetup}>
          <summary>Add a verification location</summary>
          <form onSubmit={createLocation}>
            <label>Code<input name="code" placeholder="LAX-01" required /></label>
            <label>Name<input name="name" placeholder="Los Angeles verification hub" required /></label>
            <label>Address line 1<input name="line1" required /></label>
            <label>Address line 2<input name="line2" /></label>
            <label>City<input name="city" required /></label>
            <label>State / region<input name="administrativeArea" required /></label>
            <label>Postal code<input name="postalCode" required /></label>
            <label>Country code<input defaultValue="US" maxLength={2} name="country" required /></label>
            <button disabled={busyOrder === "location"} type="submit">Save location</button>
          </form>
        </details>

        <section className={styles.queue}>
          <div className={styles.queueHeading}>
            <div><p>Controlled release</p><h2>Order queue</h2></div>
            <button disabled={loading} onClick={() => void load()} type="button">Refresh</button>
          </div>
          {loading ? <p>Loading operations queue…</p> : orders.length === 0 ? <p>No orders need operational review.</p> : (
            <div className={styles.grid}>
              {orders.map((order) => {
                const busy = busyOrder === order.orderId;
                return <article key={order.orderId}>
                  <header>
                    <div><p>{new Date(order.createdAt).toLocaleString()}</p><h3>{order.items.map((item) => item.title).join(", ")}</h3></div>
                    <span>{order.status.replaceAll("_", " ")}</span>
                  </header>
                  <dl><div><dt>Buyer</dt><dd>{order.buyer.email ?? "Unavailable"}</dd></div><div><dt>Seller</dt><dd>{order.seller?.email ?? "Unavailable"}</dd></div><div><dt>Paid</dt><dd>{money(order.amountTotal, order.currency)}</dd></div><div><dt>Seller net</dt><dd>{money(order.sellerNetAmount, order.currency)}</dd></div></dl>

                  {order.status === "awaiting_location" && (
                    <form className={styles.actionForm} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void command(order.orderId, `/payments/operations/orders/${order.orderId}/location`, { verificationLocationId: data.get("location") }); }}>
                      <select name="location" required defaultValue=""><option disabled value="">Choose active location</option>{locations.filter((location) => location.active).map((location) => <option key={location.verificationLocationId} value={location.verificationLocationId}>{location.code} · {location.name}</option>)}</select>
                      <button disabled={busy} type="submit">Assign hub</button>
                    </form>
                  )}
                  {order.status === "inbound_in_transit" && <button className={styles.primaryAction} disabled={busy} onClick={() => void command(order.orderId, `/payments/operations/orders/${order.orderId}/received`)} type="button">Confirm physical receipt</button>}
                  {order.status === "under_verification" && (
                    <div className={styles.verificationActions}>
                      <button disabled={busy} onClick={() => void command(order.orderId, `/payments/operations/orders/${order.orderId}/verification`, { approved: true, notes: "Verified against listing record." })} type="button">Approve item</button>
                      <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void command(order.orderId, `/payments/operations/orders/${order.orderId}/verification`, { approved: false, failureReason: data.get("reason") }); }}>
                        <input name="reason" minLength={3} placeholder="Required rejection reason" required />
                        <button disabled={busy} type="submit">Reject and refund</button>
                      </form>
                    </div>
                  )}
                  {order.status === "verified" && (
                    <form className={styles.actionForm} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void command(order.orderId, `/payments/operations/orders/${order.orderId}/outbound-shipment`, { carrier: data.get("carrier"), trackingNumber: data.get("trackingNumber") }); }}>
                      <input name="carrier" placeholder="Outbound carrier" required />
                      <input name="trackingNumber" placeholder="Outbound tracking" required />
                      <button disabled={busy} type="submit">Confirm carrier handoff</button>
                    </form>
                  )}
                  {order.status === "outbound_shipped" && (
                    <button className={styles.primaryAction} disabled={busy || !order.seller?.payoutReady} onClick={() => void command(order.orderId, `/payments/operations/orders/${order.orderId}/release-seller-funds`)} type="button">Release seller funds</button>
                  )}
                  {order.status === "transfer_processing" && (
                    <button className={styles.primaryAction} disabled={busy || !order.seller?.payoutReady} onClick={() => void command(order.orderId, `/payments/operations/orders/${order.orderId}/release-seller-funds`)} type="button">Reconcile pending transfer</button>
                  )}
                  {order.status === "refund_failed" && (
                    <button className={styles.primaryAction} disabled={busy} onClick={() => void command(order.orderId, `/payments/operations/orders/${order.orderId}/refund`, { reason: "Operations retry after provider failure." })} type="button">Retry buyer refund</button>
                  )}
                  {order.transferFailureReason && <p className={styles.warning}>Transfer retry required: {order.transferFailureReason}</p>}
                  {order.refundFailureReason && <p className={styles.warning}>Refund retry required: {order.refundFailureReason}</p>}
                </article>;
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
