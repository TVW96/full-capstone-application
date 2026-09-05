import type { Metadata } from "next";
import Link from "next/link";
import styles from "./forgot.module.css";

export const metadata: Metadata = { title: "Reset password | MangaMarketplace" };

export default function ForgotPasswordPage() {
  return <main className={styles.main} id="main-content"><section className={styles.panel}><div className={styles.art} aria-hidden="true"><span>読</span><i/><i/><i/><p>Find your way back to the shelf.</p></div><div className={styles.content}><p className={styles.eyebrow}>Account recovery</p><h1>Forgot your password?</h1><p>Enter the email used for your account. Recovery email delivery is not enabled in this development build, so no reset message will be sent yet.</p><form><label htmlFor="recovery-email">Account email</label><input id="recovery-email" type="email" placeholder="reader@example.com" disabled/><button type="button" disabled>Send recovery link</button></form><p className={styles.status}>Password-reset delivery will be connected in the account-security phase.</p><Link href="/account/login">← Back to login</Link></div></section></main>;
}
