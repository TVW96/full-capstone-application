"use client";

import { login } from "@/app/account/_lib/client-api";
import {
  initialLoginState,
  type LoginField,
} from "@/app/account/_lib/definitions";
import Link from "next/link";
import { useActionState, useState } from "react";

import styles from "./login.module.css";

type FieldErrorProps = {
  errors?: string[];
  id: string;
};

function FieldError({ errors, id }: FieldErrorProps) {
  if (!errors?.length) return null;

  return (
    <ul className={styles.fieldErrors} id={id}>
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, initialLoginState);
  const [showPassword, setShowPassword] = useState(false);
  const hasError = (field: LoginField) => Boolean(state.errors?.[field]);

  if (state.status === "success") {
    return (
      <div className={styles.successState} aria-live="polite">
        <span className={styles.successMark} aria-hidden="true">
          ✓
        </span>
        <p className={styles.formEyebrow}>Signed in</p>
        <h2>Welcome back, {state.values?.fullName}.</h2>
        <p>
          Your shelf is ready. Browse new arrivals or head back to your
          collector profile.
        </p>
        <div className={styles.successActions}>
          <Link className={styles.primaryAction} href="/sell">
            Start selling <span aria-hidden="true">→</span>
          </Link>
          <Link className={styles.primaryAction} href="/shop">
            Browse the marketplace <span aria-hidden="true">→</span>
          </Link>
          <Link className={styles.secondaryAction} href="/account">
            View my account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.loginForm} action={action} noValidate>
      <header className={styles.formHeader}>
        <p className={styles.formEyebrow}>Collector sign in</p>
        <h2 id="signin-heading">Welcome back</h2>
        <p>Enter your details to return to your collection.</p>
      </header>

      {state.message && (
        <div className={styles.formAlert} role="alert">
          <span aria-hidden="true">!</span>
          <p>{state.message}</p>
        </div>
      )}

      <div className={styles.fieldGroup}>
        <label htmlFor="login-email">Email address</label>
        <input
          aria-describedby={hasError("email") ? "login-email-error" : undefined}
          aria-invalid={hasError("email")}
          autoCapitalize="none"
          autoComplete="email"
          defaultValue={state.values?.email}
          id="login-email"
          inputMode="email"
          name="email"
          placeholder="mika@example.com"
          required
          type="email"
        />
        <FieldError errors={state.errors?.email} id="login-email-error" />
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.labelRow}>
          <label htmlFor="login-password">Password</label>
          <Link href="/account/forgot-password">Forgot password?</Link>
        </div>
        <div className={styles.passwordInput}>
          <input
            aria-describedby={
              hasError("password") ? "login-password-error" : undefined
            }
            aria-invalid={hasError("password")}
            autoComplete="current-password"
            id="login-password"
            maxLength={128}
            name="password"
            placeholder="Enter your password"
            required
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <FieldError errors={state.errors?.password} id="login-password-error" />
      </div>

      <label className={styles.rememberMe}>
        <input name="rememberMe" type="checkbox" />
        <span>
          Keep me signed in
          <small>Use only on a personal device.</small>
        </span>
      </label>

      <button className={styles.submitButton} disabled={pending} type="submit">
        <span>{pending ? "Opening your shelf…" : "Sign in"}</span>
        <span aria-hidden="true">→</span>
      </button>

      <p className={styles.securityNote}>
        Secure sign-in · Your password is never returned to this page.
      </p>
    </form>
  );
}
