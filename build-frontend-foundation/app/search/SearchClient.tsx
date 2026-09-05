"use client";
/* eslint-disable @next/next/no-img-element -- seller media may use approved marketplace storage hosts configured at runtime */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { normalizeListings, type FeaturedInventoryItem } from "@/lib/featured-inventory";
import styles from "./search.module.css";
const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
export default function SearchClient({ items: initialItems }: { items: FeaturedInventoryItem[] }) {
  const [items, setItems] = useState(initialItems);
  const initialQuery = useSearchParams().get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
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
  const results = useMemo(() => { const term = query.trim().toLowerCase(); if (!term) return items; return items.filter((item) => [item.title, item.series, item.author, item.edition, item.condition, item.description].some((value) => value.toLowerCase().includes(term))); }, [items, query]);
  return <main className={styles.main} id="main-content"><header><p>Marketplace search</p><h1>Search every useful detail.</h1><form onSubmit={(event) => event.preventDefault()}><label htmlFor="market-search">Title, series, creator, edition, or condition</label><div><input autoFocus id="market-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What belongs on the shelf?"/><button type="submit">Search</button></div></form></header><p className={styles.count} aria-live="polite">{results.length} {results.length === 1 ? "match" : "matches"}{query && <> for “{query}”</>}</p>{results.length ? <ul className={styles.results}>{results.map((item) => <li key={item.id}><Link href={`/product?id=${encodeURIComponent(item.id)}`}><div><img src={item.imageUrl} alt=""/><span>{item.condition}</span></div><section><p>{item.series} · {item.edition}</p><h2>{item.title}</h2><small>{item.description}</small></section><strong>${item.price.toFixed(2)}</strong></Link></li>)}</ul> : <section className={styles.empty}><p>Nothing matched that shelf note.</p><h2>Try a broader title, creator, or condition.</h2><button type="button" onClick={() => setQuery("")}>Show everything</button></section>}</main>;
}
