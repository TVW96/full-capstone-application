"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";
import styles from "./success.module.css";

export default function SuccessClient() {
  const { clearCart } = useCart();
  const sessionId = useSearchParams().get("session_id");
  useEffect(() => { if (sessionId) clearCart(); }, [clearCart, sessionId]);
  return <main className={styles.main} id="main-content"><section><div className={styles.mark} aria-hidden="true">✓</div><p className={styles.eyebrow}>Payment received</p><h1>Your next shelf story is on its way.</h1><p>Stripe confirmed your payment. We’ve saved the order and the seller can now prepare the package using the shipping method you selected.</p>{sessionId && <p className={styles.reference}>Checkout reference · {sessionId.slice(-12)}</p>}<div className={styles.actions}><Link href="/shop">Keep browsing</Link><Link href="/account">Go to account</Link></div></section></main>;
}
