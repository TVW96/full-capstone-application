import styles from "./Newsletter.module.css";

type NewsletterProps = {
  id?: string;
  eyebrow?: string;
  heading?: string;
  description?: string;
  action?: string;
  buttonLabel?: string;
};

export default function Newsletter({
  id = "newsletter",
  eyebrow = "Weekly collector update",
  heading = "Stay in the loop on new arrivals.",
  description =
    "Fresh stock, restocks, and collector listings—once a week.",
  action = "/subscribe",
  buttonLabel = "Subscribe",
}: NewsletterProps) {
  const headingId = `${id}-heading`;
  const emailId = `${id}-email`;

  return (
    <section className={styles.newsletter} aria-labelledby={headingId}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <div className={styles.copy}>
        <h2 className={styles.heading} id={headingId}>
          {heading}
        </h2>
        <p className={styles.lede}>{description}</p>
      </div>
      <form
        className={styles.form}
        action={action}
        method="post"
        aria-label="Newsletter signup"
      >
        <label className={styles.visuallyHidden} htmlFor={emailId}>
          Email address
        </label>
        <input
          id={emailId}
          type="email"
          name="email"
          placeholder="you@example.com"
          required
        />
        <button className={styles.submit} type="submit">
          {buttonLabel} <span aria-hidden="true">→</span>
        </button>
      </form>
    </section>
  );
}
