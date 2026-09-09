"use client";

import { readSession } from "@/app/account/_lib/client-api";
import { useCart } from "@/components/CartProvider";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import styles from "./success.module.css";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:3001"
).replace(/\/$/, "");

type CheckoutStatus = {
  orderId?: string;
  status: string;
  paymentStatus?: string;
};

export default function SuccessClient() {
  const { clearCart } = useCart();
  const sessionId = useSearchParams().get("session_id");
  const [checkout, setCheckout] = useState<CheckoutStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const verify = async () => {
      const accountSession = readSession();
      if (!sessionId || !accountSession) {
        if (active) {
          setError(
            !sessionId
              ? "This page is missing its checkout reference."
              : "Sign in with the account that placed this order to verify it.",
          );
        }
        return;
      }

      try {
        const response = await fetch(
          `${apiBaseUrl}/payments/buyer/checkout/${encodeURIComponent(sessionId)}`,
          {
            headers: { Authorization: `Bearer ${accountSession.token}` },
            cache: "no-store",
          },
        );
        if (!response.ok) throw new Error("The checkout could not be verified.");
        const result = (await response.json()) as CheckoutStatus;
        if (!active) return;
        setCheckout(result);
        if (result.orderId) {
          clearCart();
          return;
        }
        if (result.status === "payment_processing" && attempts < 6) {
          attempts += 1;
          timer = setTimeout(() => void verify(), 1500);
        }
      } catch (verificationError) {
        if (active) {
          setError(
            verificationError instanceof Error
              ? verificationError.message
              : "The checkout could not be verified.",
          );
        }
      }
    };

    void verify();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [clearCart, sessionId]);

  const confirmed = Boolean(checkout?.orderId);
  return (
    <main className={styles.main} id="main-content">
      <section>
        <div className={styles.mark} aria-hidden="true">
          {confirmed ? "✓" : "…"}
        </div>
        <p className={styles.eyebrow}>
          {confirmed ? "Payment confirmed" : "Confirming payment"}
        </p>
        <h1>
          {confirmed
            ? "Your order is entering verification."
            : "We’re securing your order record."}
        </h1>
        <p>
          {confirmed
            ? "The seller will ship the exact item to an assigned verification hub. If it passes, the hub sends it to you and only then releases the seller’s net proceeds."
            : "The signed Stripe webhook may take a moment. Your cart is cleared only after the backend confirms this checkout belongs to you."}
        </p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {sessionId && (
          <p className={styles.reference}>
            Checkout reference · {sessionId.slice(-12)}
          </p>
        )}
        <div className={styles.actions}>
          <Link href="/shop">Keep browsing</Link>
          <Link href="/account">Go to account</Link>
        </div>
      </section>
    </main>
  );
}
