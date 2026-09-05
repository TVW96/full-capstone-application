"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentAccount, readSession } from "@/app/account/_lib/client-api";
import type { AccountUser } from "@/app/account/_lib/account-types";
import SellingForm from "./SellingForm";
import styles from "./sell.module.css";

export default function SellPageClient() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountUser | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function checkAccount() {
      if (!readSession()) {
        router.replace("/sell/signup-prompt");
        return;
      }
      try {
        const user = await getCurrentAccount();
        if (!active) return;
        if (user) setAccount(user);
        else if (!readSession()) router.replace("/sell/signup-prompt");
        else setFailed(true);
      } catch {
        if (active) setFailed(true);
      }
    }
    void checkAccount();
    return () => {
      active = false;
    };
  }, [router, attempt]);

  if (!account)
    return (
      <main id="main-content" className={styles.page}>
        <section className={styles.welcome} aria-live="polite">
          <p className={styles.eyebrow}>Your next chapter</p>
          <h1>
            {failed
              ? "We couldn’t reach your account"
              : "Getting your selling space ready…"}
          </h1>
          <p>
            {failed
              ? "Your work starts here. Reconnect to verify your account and create a listing."
              : "Checking your membership before you start selling."}
          </p>
          {failed && (
            <div className={styles.actions}>
              <button
                className={styles.primary}
                onClick={() => {
                  setFailed(false);
                  setAttempt(attempt + 1);
                }}
              >
                Try again
              </button>
              <Link href="/account/login" className={styles.secondary}>
                Sign in
              </Link>
            </div>
          )}
        </section>
      </main>
    );
  return <SellingForm account={account} />;
}
