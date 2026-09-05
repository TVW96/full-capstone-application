import type { Metadata } from "next";
import Link from "next/link";

import LoginForm from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Sign in | MangaMarketplace",
  description:
    "Sign in to MangaMarketplace to manage your manga collection, listings, and orders.",
};

const shelfStats = [
  { value: "1", label: "shelf, always with you" },
  { value: "0", label: "missing volumes forgotten" },
  { value: "∞", label: "stories waiting nearby" },
];

export default function LoginPage() {
  return (
    <main className={styles.loginPage} id="main-content">
      <section className={styles.welcomePanel} aria-labelledby="login-title">
        <div className={styles.welcomeInner}>
          <p className={styles.kicker}>
            <span aria-hidden="true">読</span> Member access
          </p>

          <div className={styles.welcomeCopy}>
            <p className={styles.chapter}>Chapter 02 · Welcome back</p>
            <h1 id="login-title">
              Pick up where
              <span>your shelf left off.</span>
            </h1>
            <p>
              Your collection, saved searches, orders, and listings are right
              where you left them.
            </p>
          </div>

          <dl className={styles.shelfStats}>
            {shelfStats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.value}</dt>
                <dd>{stat.label}</dd>
              </div>
            ))}
          </dl>

          <blockquote>
            “Every volume deserves a shelf. Every shelf tells a story.”
          </blockquote>
        </div>
      </section>

      <section className={styles.formRegion} aria-labelledby="signin-heading">
        <div className={styles.formWrap}>
          <LoginForm />

          <p className={styles.signupPrompt}>
            New to MangaMarketplace?{" "}
            <Link href="/account/signup">Create an account</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
