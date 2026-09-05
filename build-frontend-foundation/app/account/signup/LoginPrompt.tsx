import styles from "./signup.module.css";
import Link from "next/link";

export default function LoginPrompt() {
  return (
    <div className={styles.loginPrompt}>
      <span>Already have an account?</span>
      <Link className={styles.loginStatus} href="/account/login">
        Sign in
      </Link>
    </div>
  );
}
