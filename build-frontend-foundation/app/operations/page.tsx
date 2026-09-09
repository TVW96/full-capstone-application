import type { Metadata } from "next";

import OperationsClient from "./OperationsClient";

export const metadata: Metadata = {
  title: "Verification operations | MangaMarketplace",
};

export default function OperationsPage() {
  return <OperationsClient />;
}
