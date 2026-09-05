import type { Metadata } from "next";
import Footer from "@/components/Footer";
import { getAvailableInventory } from "@/lib/featured-inventory";
import SearchClient from "./SearchClient";
import { Suspense } from "react";
export const metadata: Metadata = { title: "Search | MangaMarketplace" };
export default async function SearchPage() { const items = await getAvailableInventory(); return <><Suspense fallback={<main id="main-content">Opening marketplace search…</main>}><SearchClient items={items}/></Suspense><Footer /></>; }
