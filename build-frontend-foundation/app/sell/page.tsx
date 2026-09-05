import type { Metadata } from "next";
import SellPageClient from "./SellPageClient";

export const metadata: Metadata = {
  title: "Start selling | MangaMarketplace",
  description:
    "Give your manga a new home. Add your copies, upload photos, and publish a single-copy or bundle listing on MangaMarketplace.",
};

export default function SellPage() {
  return <SellPageClient />;
}
