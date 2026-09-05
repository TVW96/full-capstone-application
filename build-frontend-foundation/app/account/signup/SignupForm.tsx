"use client";

import { signup } from "@/app/account/_lib/client-api";
import {
  initialSignupState,
  type SignupField,
} from "@/app/account/_lib/definitions";
import {
  COUNTRY_OPTIONS,
  getCountryName,
} from "@/app/account/_lib/countries";
import Link from "next/link";
import { useActionState, useState } from "react";

import styles from "./signup.module.css";

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

export default function SignupForm() {
  const [state, action, pending] = useActionState(
    signup,
    initialSignupState,
  );
  const [showPassword, setShowPassword] = useState(false);

  const hasError = (field: SignupField) => Boolean(state.errors?.[field]);

  if (state.status === "success") {
    return (
      <section className={styles.successState} aria-live="polite">
        <span className={styles.successMark} aria-hidden="true">
          ✓
        </span>
        <p className={styles.formEyebrow}>Account created</p>
        <h2>Nice to meet you, {state.values?.fullName}.</h2>
        <p>
          Your collector profile is ready and you are signed in on this device.
          Start exploring, or add the first volume to your shelf.
        </p>
        <dl className={styles.accountPreview}>
          <div>
            <dt>Username</dt>
            <dd>@{state.values?.username}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{state.values?.email}</dd>
          </div>
          <div>
            <dt>Country</dt>
            <dd>{getCountryName(state.values?.region)}</dd>
          </div>
        </dl>
        <Link className={styles.primaryAction} href="/sell">
          Start selling <span aria-hidden="true">→</span>
        </Link>
        <Link className={styles.primaryAction} href="/shop">
          Explore the marketplace
        </Link>
      </section>
    );
  }

  return (
    <form className={styles.signupForm} action={action} noValidate>
      <header className={styles.formHeader}>
        <p className={styles.formEyebrow}>Free collector account</p>
        <h2 id="signup-heading">Create your profile</h2>
        <p>
          Keep your collection organized and make each listing feel personal.
        </p>
      </header>

      {state.message && (
        <div className={styles.formAlert} role="alert">
          <span aria-hidden="true">!</span>
          <p>{state.message}</p>
        </div>
      )}

      <div className={styles.fieldGrid}>
        <div className={styles.fieldGroup}>
          <label htmlFor="firstName">First name</label>
          <input
            aria-describedby={
              hasError("firstName") ? "firstName-error" : undefined
            }
            aria-invalid={hasError("firstName")}
            autoComplete="given-name"
            defaultValue={state.values?.firstName}
            id="firstName"
            maxLength={60}
            name="firstName"
            placeholder="Mika"
            required
          />
          <FieldError errors={state.errors?.firstName} id="firstName-error" />
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="lastName">Last name</label>
          <input
            aria-describedby={
              hasError("lastName") ? "lastName-error" : undefined
            }
            aria-invalid={hasError("lastName")}
            autoComplete="family-name"
            defaultValue={state.values?.lastName}
            id="lastName"
            maxLength={60}
            name="lastName"
            placeholder="Tanaka"
            required
          />
          <FieldError errors={state.errors?.lastName} id="lastName-error" />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="username">Username</label>
        <div className={styles.prefixedInput}>
          <span aria-hidden="true">@</span>
          <input
            aria-describedby={
              hasError("username") ? "username-error" : "username-hint"
            }
            aria-invalid={hasError("username")}
            autoCapitalize="none"
            autoComplete="username"
            defaultValue={state.values?.username}
            id="username"
            maxLength={50}
            name="username"
            placeholder="mikashelf"
            required
            spellCheck={false}
            type="text"
          />
        </div>
        <p className={styles.fieldHint} id="username-hint">
          Letters, numbers, and underscores only.
        </p>
        <FieldError errors={state.errors?.username} id="username-error" />
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="mailingAddressLine1">Mailing address line 1</label>
        <input
          aria-describedby={
            hasError("mailingAddressLine1")
              ? "mailingAddressLine1-error"
              : undefined
          }
          aria-invalid={hasError("mailingAddressLine1")}
          autoComplete="address-line1"
          defaultValue={state.values?.mailingAddressLine1}
          id="mailingAddressLine1"
          maxLength={255}
          name="mailingAddressLine1"
          placeholder="123 Manga Lane"
          required
        />
        <FieldError
          errors={state.errors?.mailingAddressLine1}
          id="mailingAddressLine1-error"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="mailingAddressLine2">
          Mailing address line 2 <span className={styles.optional}>(optional)</span>
        </label>
        <input
          aria-describedby={
            hasError("mailingAddressLine2")
              ? "mailingAddressLine2-error"
              : "mailingAddressLine2-hint"
          }
          aria-invalid={hasError("mailingAddressLine2")}
          autoComplete="address-line2"
          defaultValue={state.values?.mailingAddressLine2}
          id="mailingAddressLine2"
          maxLength={255}
          name="mailingAddressLine2"
          placeholder="Apartment 4B or PO Box 488"
        />
        <p className={styles.fieldHint} id="mailingAddressLine2-hint">
          Use this line for an apartment, suite, PO box, or other delivery detail.
        </p>
        <FieldError
          errors={state.errors?.mailingAddressLine2}
          id="mailingAddressLine2-error"
        />
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.fieldGroup}>
          <label htmlFor="region">Country</label>
          <select
            aria-describedby={
              hasError("region") ? "region-error" : "region-hint"
            }
            aria-invalid={hasError("region")}
            autoComplete="country"
            defaultValue={state.values?.region}
            id="region"
            name="region"
            required
          >
            <option value="">Select a country</option>
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
          <FieldError errors={state.errors?.region} id="region-error" />
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="email">Email address</label>
          <input
            aria-describedby={hasError("email") ? "email-error" : undefined}
            aria-invalid={hasError("email")}
            autoCapitalize="none"
            autoComplete="email"
            defaultValue={state.values?.email}
            id="email"
            inputMode="email"
            name="email"
            placeholder="mika@example.com"
            required
            type="email"
          />
          <FieldError errors={state.errors?.email} id="email-error" />
        </div>
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.fieldGroup}>
          <label htmlFor="password">Password</label>
          <input
            aria-describedby="password-hint password-error"
            aria-invalid={hasError("password")}
            autoComplete="new-password"
            id="password"
            maxLength={128}
            minLength={8}
            name="password"
            required
            type={showPassword ? "text" : "password"}
          />
          <FieldError errors={state.errors?.password} id="password-error" />
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            aria-describedby={
              hasError("confirmPassword")
                ? "confirmPassword-error"
                : undefined
            }
            aria-invalid={hasError("confirmPassword")}
            autoComplete="new-password"
            id="confirmPassword"
            maxLength={128}
            minLength={8}
            name="confirmPassword"
            required
            type={showPassword ? "text" : "password"}
          />
          <FieldError
            errors={state.errors?.confirmPassword}
            id="confirmPassword-error"
          />
        </div>
      </div>

      <div className={styles.passwordMeta}>
        <p id="password-hint">
          Use 8+ characters with a letter, number, and symbol.
        </p>
        <label className={styles.showPassword}>
          <input
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
            type="checkbox"
          />
          Show passwords
        </label>
      </div>

      <div className={styles.termsGroup}>
        <label>
          <input
            aria-describedby={
              hasError("acceptedTerms") ? "terms-error" : undefined
            }
            aria-invalid={hasError("acceptedTerms")}
            name="acceptedTerms"
            required
            type="checkbox"
          />
          <span>
            I agree to the Marketplace Terms and acknowledge the Privacy
            Policy.
          </span>
        </label>
        <FieldError
          errors={state.errors?.acceptedTerms}
          id="terms-error"
        />
      </div>

      <button className={styles.submitButton} disabled={pending} type="submit">
        <span>{pending ? "Checking your details…" : "Create my account"}</span>
        <span aria-hidden="true">→</span>
      </button>

      <p className={styles.securityNote}>
        Your password is validated securely and is never returned to this page.
      </p>
    </form>
  );
}
