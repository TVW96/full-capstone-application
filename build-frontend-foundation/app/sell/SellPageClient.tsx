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
  const [payoutRequired, setPayoutRequired] = useState(false);
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
        if (user) {
          const session = readSession();
          const apiBaseUrl = (
            process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:3001"
          ).replace(/\/$/, "");
          const payoutResponse = await fetch(
            `${apiBaseUrl}/payments/seller/payment-status`,
            {
              headers: { Authorization: `Bearer ${session?.token ?? ""}` },
              cache: "no-store",
            },
          );
          if (!active) return;
          if (!payoutResponse.ok) throw new Error("Payout status unavailable");
          const payout = (await payoutResponse.json()) as { ready: boolean };
          if (!payout.ready) setPayoutRequired(true);
          else setAccount(user);
        }
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

  if (payoutRequired) {
    return (
      <main id="main-content" className={styles.page}>
        <section className={styles.welcome}>
          <p className={styles.eyebrow}>Seller payments</p>
          <h1>Secure your payout details before listing.</h1>
          <p>
            Stripe-hosted onboarding verifies who will receive proceeds. No
            listing can become purchasable until transfers and payouts are
            enabled for the seller.
          </p>
          <div className={styles.actions}>
            <Link href="/account/payouts" className={styles.primary}>
              Complete seller onboarding
            </Link>
            <Link href="/account" className={styles.secondary}>
              Back to account
            </Link>
          </div>
        </section>
      </main>
    );
  }

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
