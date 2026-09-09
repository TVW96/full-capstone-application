"use client";

import { readSession } from "@/app/account/_lib/client-api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import styles from "./orders.module.css";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:3001"
).replace(/\/$/, "");

type BuyerOrder = {
  orderId: string;
  status: string;
  amountTotal: number;
  currency: string;
  createdAt: string;
  refundedAmount: number;
  items: Array<{ listingId: string; title: string; unitAmount: number }>;
  inboundShipment: { receivedAt: string | null } | null;
  outboundShipment: {
    carrier: string;
    trackingNumber: string;
    shippedAt: string;
  } | null;
  verification: {
    receivedAt: string | null;
    completedAt: string | null;
    passed: boolean;
  };
};

const statusCopy: Record<string, string> = {
  awaiting_location: "A verification hub is being assigned.",
  awaiting_seller_shipment: "The seller is preparing the item for the verification hub.",
  inbound_in_transit: "The item is in transit to the verification hub.",
  under_verification: "The hub received the item and is checking the exact copy.",
  verified: "The item passed physical verification and is being prepared for you.",
  outbound_shipped: "The verified item has been handed to the outbound carrier.",
  transfer_processing: "The item shipped and the seller transfer is processing.",
  completed: "The item shipped and seller proceeds were released.",
  verification_failed: "The item did not pass verification. A refund is being prepared.",
  refund_pending: "Your refund is processing to the original payment method.",
  refund_failed: "The automatic refund needs support review.",
  refunded: "This order was refunded to the original payment method.",
  disputed: "This payment is under dispute review.",
  transfer_reversed: "The seller transfer was reversed for review.",
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export default function BuyerOrdersClient() {
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    await Promise.resolve();
    const session = readSession();
    if (!session) {
      setError("Sign in to view your protected order history.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/payments/buyer/orders`, {
        headers: { Authorization: `Bearer ${session.token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Orders are temporarily unavailable.");
      setOrders((await response.json()) as BuyerOrder[]);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Orders are temporarily unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  return (
    <main className={styles.page} id="main-content">
      <header>
        <p>Buyer account</p>
        <h1>My purchases</h1>
        <span>Follow each item through payment, verification, and shipment.</span>
      </header>
      <div className={styles.content}>
        <div className={styles.toolbar}>
          <Link href="/account">← Back to account</Link>
          <button disabled={loading} onClick={() => void load()} type="button">
            Refresh
          </button>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {loading ? (
          <p>Loading your purchases…</p>
        ) : orders.length === 0 ? (
          <section className={styles.empty}>
            <h2>No purchases yet</h2>
            <p>Your verified marketplace orders will appear here.</p>
            <Link href="/shop">Browse listings</Link>
          </section>
        ) : (
          <div className={styles.grid}>
            {orders.map((order) => (
              <article key={order.orderId}>
                <header>
                  <div>
                    <p>{new Date(order.createdAt).toLocaleDateString()}</p>
                    <h2>{order.items.map((item) => item.title).join(", ")}</h2>
                  </div>
                  <strong>{money(order.amountTotal, order.currency)}</strong>
                </header>
                <div className={styles.status}>
                  <span>{order.status.replaceAll("_", " ")}</span>
                  <p>{statusCopy[order.status] ?? "This order is being reviewed."}</p>
                </div>
                {order.outboundShipment && (
                  <p className={styles.tracking}>
                    <strong>Outbound tracking</strong>
                    {order.outboundShipment.carrier} ·{" "}
                    {order.outboundShipment.trackingNumber}
                  </p>
                )}
                {order.refundedAmount > 0 && (
                  <p className={styles.refund}>
                    Refunded: {money(order.refundedAmount, order.currency)}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
