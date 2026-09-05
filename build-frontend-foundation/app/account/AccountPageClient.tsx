"use client";

import { getCurrentAccount } from "@/app/account/_lib/client-api";
import type { AccountUser } from "@/app/account/_lib/account-types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AccountDashboard from "./AccountDashboard";
import styles from "./profile.module.css";

export default function AccountPageClient() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountUser | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentAccount().then((currentAccount) => {
      if (!active) return;
      if (!currentAccount) {
        router.replace("/account/login");
        return;
      }
      setAccount(currentAccount);
    });
    return () => {
      active = false;
    };
  }, [router]);

  if (!account) {
    return (
      <main className={styles.accountPage} id="main-content">
        <p role="status">Loading your account…</p>
      </main>
    );
  }

  return <AccountDashboard account={account} />;
}
