"use client";
/* eslint-disable @next/next/no-img-element -- seller media may use approved marketplace storage hosts configured at runtime */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useCart } from "@/components/CartProvider";
import styles from "./cart.module.css";

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");

export default function CartPageClient() {
  const { items, hydrated, removeItem } = useCart();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);

  const checkout = async () => {
    setSubmitting(true); setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/payments/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: items.map((item) => item.listingId), ...(email ? { customerEmail: email } : {}) }),
      });
      const payload = await response.json() as { url?: string; message?: string | string[] };
      if (!response.ok || !payload.url) throw new Error(Array.isArray(payload.message) ? payload.message.join(" ") : payload.message || "Checkout could not be started.");
      window.location.assign(payload.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not be started.");
      setSubmitting(false);
    }
  };

  if (!hydrated) return <main className={styles.main} id="main-content"><p>Loading your cart…</p></main>;

  return <main className={styles.main} id="main-content">
    <header className={styles.header}><p>Checkout desk</p><h1>Your collector cart</h1><span>{items.length} {items.length === 1 ? "listing" : "listings"}</span></header>
    {searchParams.get("checkout") === "cancelled" && <p className={styles.notice}>Checkout was cancelled. Your cart is still here.</p>}
    {items.length === 0 ? <section className={styles.empty}><span aria-hidden="true">読</span><h2>Your cart has room for a good story.</h2><p>Browse exact-copy listings from community sellers and add the ones that belong on your shelf.</p><Link href="/shop">Browse available manga <span aria-hidden="true">→</span></Link></section> :
      <div className={styles.layout}>
        <ul className={styles.items}>{items.map((item) => <li key={item.listingId}>
          <img src={item.imageUrl} alt="" />
          <div><p>{item.series} · {item.condition}</p><h2><Link href={`/product?id=${encodeURIComponent(item.listingId)}`}>{item.title}</Link></h2><button type="button" onClick={() => removeItem(item.listingId)}>Remove</button></div>
          <strong>${item.price.toFixed(2)}</strong>
        </li>)}</ul>
        <aside className={styles.summary}><p className={styles.summaryEyebrow}>Order summary</p><dl><div><dt>Listings</dt><dd>${subtotal.toFixed(2)}</dd></div><div><dt>Shipping</dt><dd>Selected in Stripe</dd></div><div><dt>Estimated tax</dt><dd>Calculated at checkout</dd></div><div className={styles.total}><dt>Subtotal</dt><dd>${subtotal.toFixed(2)}</dd></div></dl>
          <label htmlFor="receipt-email">Receipt email <span>optional</span></label><input id="receipt-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="reader@example.com" />
          <button className={styles.checkout} type="button" disabled={submitting} onClick={checkout}>{submitting ? "Opening secure checkout…" : "Continue to Stripe"}<span aria-hidden="true">→</span></button>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <p className={styles.secure}>Secure payment, address collection, and shipping selection are handled by Stripe.</p>
        </aside>
      </div>}
  </main>;
}
