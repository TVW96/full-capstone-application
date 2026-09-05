import Link from "next/link";
import type { CSSProperties } from "react";

import styles from "./Footer.module.css";

const footerNavigation = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "All manga" },
      { href: "/shop", label: "Buy books" },
      { href: "/sell", label: "Sell books" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/shipping", label: "Shipping & returns" },
      { href: "/privacy-terms", label: "Privacy Terms" },
      { href: "/contact", label: "Contact" },
    ],
  },
] as const;

export default function Footer() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const brandArtStyle = {
    "--footer-brand-art": `url("${basePath}/one-piece-manga.jpeg")`,
  } as CSSProperties;

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandColumn} style={brandArtStyle}>
          <div className={styles.brandStage}>
            <Link
              className={styles.brand}
              href="/"
              aria-label="MangaMarketplace home"
            >
              <span className={styles.brandMark} aria-hidden="true">
                <span className={styles.brandMarkGlyph}>読</span>
              </span>
              <span className={styles.brandTitle} aria-hidden="true">
                <span className={styles.brandTitleCore}>
                  <span>Manga</span>
                  <span className={styles.brandTitleMarket}>Market</span>
                </span>
                <span className={styles.brandTitlePlace}>place</span>
              </span>
            </Link>

            <p className={styles.brandDescription}>
              <span className={styles.descriptionLead}>A</span>
              <span className={styles.communityPowered}>
                <span>community</span>
                <span className={styles.poweredWord}>-powered</span>
              </span>
              <span>marketplace</span>
              <span className={styles.descriptionTail}>
                for manga readers, sellers, and collectors.
              </span>
            </p>

            <span className={styles.mastheadGlyph} aria-hidden="true">
              読
            </span>
          </div>
        </div>

        {footerNavigation.map((section) => (
          <nav
            className={styles.navSection}
            key={section.title}
            aria-label={section.title}
          >
            <h2>{section.title}</h2>
            <ul>
              {section.links.map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className={styles.base}>
        <p>
          <small>© 2026 MangaMarketplace. All rights reserved.</small>
        </p>
        <p className={styles.communityNote}>
          <small>Built for collectors, powered by community.</small>
        </p>
      </div>
    </footer>
  );
}
