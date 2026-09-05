"use client";
/* eslint-disable @next/next/no-img-element -- seller media uses marketplace storage hosts configured at runtime */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AddToCartButton from "@/components/AddToCartButton";
import { normalizeListings, type FeaturedInventoryItem } from "@/lib/featured-inventory";
import styles from "./[id]/product.module.css";

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");

export default function ProductPageClient({ initialItems }: { initialItems: FeaturedInventoryItem[] }) {
  const id = useSearchParams().get("id") ?? "";
  const [items, setItems] = useState(initialItems);
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/listings`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Listings unavailable")))
      .then((payload: unknown) => {
        const listings = normalizeListings(payload);
        if (listings.length) setItems(listings);
      })
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
    return () => controller.abort();
  }, []);

  const item = useMemo(() => items.find((candidate) => candidate.id === id), [id, items]);
  if (!item && refreshing) return <main className={styles.main} id="main-content"><p>Loading listing details…</p></main>;
  if (!item) return <main className={styles.main} id="main-content"><section className={styles.sellerNote}><p>Listing unavailable</p><h1>This copy may have sold or left the shelf.</h1><div><p>Return to the live marketplace to see what is available now.</p><Link href="/shop">Browse current listings →</Link></div></section></main>;

  return <main className={styles.main} id="main-content">
    <nav className={styles.crumbs} aria-label="Breadcrumb"><Link href="/shop">Browse</Link><span>/</span><span>{item.series}</span></nav>
    <article className={styles.product}>
      <div className={styles.gallery}><img src={item.imageUrl} alt={`Seller photograph of ${item.title}`} /><p><span aria-hidden="true">◎</span> Seller photo · inspect the exact copy before checkout</p></div>
      <div className={styles.details}><p className={styles.eyebrow}>Available now · {item.condition}</p><h1>{item.title}</h1><p className={styles.byline}>{item.series} · by {item.author}</p><p className={styles.price}>${item.price.toFixed(2)}</p><p className={styles.description}>{item.description}</p><dl><div><dt>Edition</dt><dd>{item.edition}</dd></div><div><dt>Condition</dt><dd>{item.condition}</dd></div><div><dt>Contents</dt><dd>{item.itemCount && item.itemCount > 1 ? `${item.itemCount}-book bundle` : "One physical copy"}</dd></div><div><dt>Fulfillment</dt><dd>Ships from the seller</dd></div></dl><AddToCartButton item={{ listingId: item.id, title: item.title, series: item.series, condition: item.condition, price: item.price, imageUrl: item.imageUrl, purchasable: item.purchasable !== false }} /><ul className={styles.assurances}><li><strong>Secure payment</strong><span>Checkout hosted by Stripe</span></li><li><strong>Delivery details</strong><span>Validated format at checkout</span></li><li><strong>Order record</strong><span>Created only after confirmed payment</span></li></ul></div>
    </article>
    <section className={styles.sellerNote}><p>Buyer’s field guide</p><h2>Look closely. Buy confidently.</h2><div><p>Condition labels are a starting point. The seller’s copy notes and photographs describe the actual book you’ll receive.</p><Link href="/shipping">Read shipping &amp; returns <span aria-hidden="true">→</span></Link></div></section>
  </main>;
}
