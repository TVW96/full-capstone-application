import type { Metadata } from "next";

import AccountPageClient from "./AccountPageClient";

export const metadata: Metadata = {
  title: "My account | MangaMarketplace",
  description: "Manage your MangaMarketplace profile and saved addresses.",
};

export default function AccountPage() {
  return <AccountPageClient />;
}
