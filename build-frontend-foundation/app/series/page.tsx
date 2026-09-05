import Link from "next/link";
import Footer from "@/components/Footer";
import { getAvailableInventory } from "@/lib/featured-inventory";
import styles from "./series.module.css";

export const metadata = { title: "Browse by series | MangaMarketplace" };

export default async function SeriesPage() {
  const items = await getAvailableInventory();
  const series = [...new Set(items.map((item) => item.series))].sort();
  return <><main className={styles.main} id="main-content">
    <header className={styles.hero}><div><p>Series index</p><h1>Build the run, one volume at a time.</h1></div><span aria-hidden="true">01—∞</span></header>
    <section className={styles.finder}><div><p>Start with a title</p><h2>Which world are you returning to?</h2></div><form action="/search"><label className={styles.hidden} htmlFor="series-search">Search a series</label><input id="series-search" name="q" placeholder="Try One Piece, Vagabond, Pluto…"/><button>Search series <span aria-hidden="true">→</span></button></form></section>
    <section className={styles.index} aria-labelledby="available-series"><div><p>On community shelves now</p><h2 id="available-series">Available series</h2></div><ol>{series.map((name, index) => <li key={name}><Link href={`/search?q=${encodeURIComponent(name)}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{name}</strong><small>{items.filter((item) => item.series === name).length} available</small><b aria-hidden="true">↗</b></Link></li>)}</ol></section>
    <section className={styles.method}><p>Collector method</p><div><article><span>1</span><h2>Map the gaps</h2><p>Write down volume, language, format, and printing—not just the series title.</p></article><article><span>2</span><h2>Compare copies</h2><p>Use condition notes and seller images to choose the copy that fits your shelf.</p></article><article><span>3</span><h2>Bundle wisely</h2><p>One seller and one shipment can be better value when several missing volumes align.</p></article></div></section>
  </main><Footer /></>;
}
