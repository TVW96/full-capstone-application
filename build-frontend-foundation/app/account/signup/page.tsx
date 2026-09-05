import type { Metadata } from "next";

import LoginPrompt from "./LoginPrompt";
import SignupForm from "./SignupForm";
import styles from "./signup.module.css";

export const metadata: Metadata = {
  title: "Create your account | MangaMarketplace",
  description:
    "Create a MangaMarketplace collector profile to organize your shelf, follow series, and sell manga.",
};

const accountBenefits = [
  {
    number: "01",
    title: "Map your shelf",
    description: "Track exact volumes, editions, languages, and printings.",
  },
  {
    number: "02",
    title: "Find the gaps",
    description: "Follow a series and spot the missing volume instantly.",
  },
  {
    number: "03",
    title: "Sell with confidence",
    description: "Turn real-copy photos and condition notes into trusted listings.",
  },
];

export default function SignupPage() {
  return (
    <main className={styles.accountPage} id="main-content">
      <section className={styles.accountIntro} aria-labelledby="account-title">
        <div className={styles.introInner}>
          <p className={styles.editionLabel}>
            <span>読</span> Member edition · 001
          </p>
          <h1 id="account-title">
            Your shelf has a story.
            <span>Give it a home.</span>
          </h1>
          <p className={styles.introCopy}>
            Join a marketplace made for readers who care which volume, which
            printing, and which copy arrives at their door.
          </p>

          <ol className={styles.benefitList}>
            {accountBenefits.map((benefit) => (
              <li key={benefit.number}>
                <span>{benefit.number}</span>
                <div>
                  <h2>{benefit.title}</h2>
                  <p>{benefit.description}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className={styles.communityNote}>
            Built for collectors, casual readers, and the people helping a
            beloved series find its next shelf.
          </p>
        </div>
      </section>

      <section className={styles.formRegion} aria-labelledby="signup-heading">
        <div className={styles.formCard}>
          <SignupForm />
          <LoginPrompt />
        </div>
      </section>
    </main>
  );
}
