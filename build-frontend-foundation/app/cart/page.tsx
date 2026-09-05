import type { Metadata } from "next";
import Footer from "@/components/Footer";
import CartPageClient from "./CartPageClient";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Your cart | MangaMarketplace", description: "Review listings and continue to secure Stripe checkout." };

export default function CartPage() {
  return <><Suspense fallback={<main id="main-content">Loading your cart…</main>}><CartPageClient /></Suspense><Footer /></>;
}
