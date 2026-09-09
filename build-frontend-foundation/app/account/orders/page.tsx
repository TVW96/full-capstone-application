import type { Metadata } from "next";

import BuyerOrdersClient from "./BuyerOrdersClient";

export const metadata: Metadata = {
  title: "My purchases | MangaMarketplace",
};

export default function BuyerOrdersPage() {
  return <BuyerOrdersClient />;
}
