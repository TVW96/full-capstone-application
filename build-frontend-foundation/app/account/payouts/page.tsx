import type { Metadata } from "next";

import PayoutsClient from "./PayoutsClient";

export const metadata: Metadata = {
  title: "Seller payments | MangaMarketplace",
};

export default function SellerPaymentsPage() {
  return <PayoutsClient />;
}
