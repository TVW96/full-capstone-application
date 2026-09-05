import type { Metadata } from "next";
import { Suspense } from "react";

import Footer from "@/components/Footer";
import { getAvailableInventory } from "@/lib/featured-inventory";
import ProductPageClient from "./ProductPageClient";

export const metadata: Metadata = {
  title: "Listing details | MangaMarketplace",
  description: "Inspect the exact manga copy, edition, condition, and shipping details.",
};

export default async function ProductPage() {
  const items = await getAvailableInventory();
  return <>
    <Suspense fallback={<main id="main-content">Opening listing details…</main>}>
      <ProductPageClient initialItems={items} />
    </Suspense>
    <Footer />
  </>;
}
