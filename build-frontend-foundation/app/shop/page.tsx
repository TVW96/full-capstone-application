import type { Metadata } from "next";
import { getAvailableInventory } from "@/lib/featured-inventory";
import ShopCatalog from "./ShopCatalog";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Browse manga | MangaMarketplace",
  description: "Browse physical manga copies from community sellers.",
};

export default async function BrowsePage() {
  const items = await getAvailableInventory();
  return <>
    <ShopCatalog items={items} />
    <Footer />
  </>;
}
