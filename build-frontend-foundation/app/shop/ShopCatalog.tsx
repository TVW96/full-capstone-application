"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AddToCartButton from "@/components/AddToCartButton";
import { normalizeListings, type FeaturedInventoryItem } from "@/lib/featured-inventory";
import styles from "./catalog.module.css";

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");

export default function ShopCatalog({ items: initialItems }: { items: FeaturedInventoryItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [condition, setCondition] = useState("all");
  const [sort, setSort] = useState("featured");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/listings`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Listings unavailable")))
      .then((payload: unknown) => {
        const listings = normalizeListings(payload);
        if (listings.length) setItems(listings);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const conditions = [...new Set(items.map((item) => item.condition))].sort();
  const visible = useMemo(() => {
    const filtered = condition === "all" ? items : items.filter((item) => item.condition === condition);
    return [...filtered].sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : b.popularity - a.popularity);
  }, [condition, items, sort]);

  return <main className={styles.main} id="main-content">
    <header className={styles.hero}>
      <p className={styles.eyebrow}>Collector-sourced · exact-copy listings</p>
      <h1>Find the copy your shelf is missing.</h1>
      <p>Compare real condition notes, editions, and bundles from manga readers who know what collectors care about.</p>
      <dl>
        <div><dt>Live listings</dt><dd>{items.length}</dd></div>
        <div><dt>Checkout</dt><dd>Protected by Stripe</dd></div>
        <div><dt>Shipping</dt><dd>Address collected at checkout</dd></div>
      </dl>
    </header>

    <section className={styles.toolbar} aria-label="Catalog controls">
      <p><strong>{visible.length}</strong> copies available</p>
      <label>Condition<select value={condition} onChange={(event) => setCondition(event.target.value)}><option value="all">All conditions</option>{conditions.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
      <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured first</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
    </section>

    <ul className={styles.grid}>
      {visible.map((item) => <li key={item.id}>
        <article className={styles.card}>
          <Link className={styles.imageLink} href={`/product?id=${encodeURIComponent(item.id)}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={`Seller listing for ${item.title}`} />
            <span>{item.condition}</span>
          </Link>
          <div className={styles.body}>
            <p className={styles.meta}>{item.series} · {item.edition}</p>
            <h2><Link href={`/product?id=${encodeURIComponent(item.id)}`}>{item.title}</Link></h2>
            <p className={styles.description}>{item.description}</p>
            <div className={styles.priceRow}><strong>${item.price.toFixed(2)}</strong><span>{item.itemCount && item.itemCount > 1 ? `${item.itemCount} books` : "1 copy"}</span></div>
            <AddToCartButton item={{ listingId: item.id, title: item.title, series: item.series, condition: item.condition, price: item.price, imageUrl: item.imageUrl, purchasable: item.purchasable !== false }} />
          </div>
        </article>
      </li>)}
    </ul>
  </main>;
}
