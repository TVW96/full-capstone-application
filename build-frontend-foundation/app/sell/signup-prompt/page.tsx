import Link from "next/link";
import type { Metadata } from "next";
import styles from "../sell.module.css";

export const metadata: Metadata = {
  title: "Join to sell | MangaMarketplace",
  description:
    "Join MangaMarketplace to list your manga copies and find their next reader.",
};

export default function SellSignupPrompt() {
  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.welcome}>
        <span className={styles.successMark} aria-hidden="true">
          本
        </span>
        <p className={styles.eyebrow}>From your shelf to their next favorite</p>
        <h1>
          Good stories deserve
          <br />
          another reader.
        </h1>
        <p>
          Create a free account to start selling your manga. List a single copy
          or put together a bundle, add your photos, and set your price.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/account/signup">
            Create an account <span aria-hidden="true">→</span>
          </Link>
          <Link className={styles.secondary} href="/account/login">
            Sign in to sell
          </Link>
        </div>
        <p className={styles.hint}>
          Already a member? Sign in, then choose Start selling to create your
          listing.
        </p>
      </section>
    </main>
  );
}
