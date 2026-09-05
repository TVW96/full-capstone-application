"use client";

import Link from "next/link";
import {
  AUTH_CHANGE_EVENT,
  getCurrentAccount,
  logout,
} from "@/app/account/_lib/client-api";
import type { AccountUser } from "@/app/account/_lib/account-types";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import styles from "./Navbar.module.css";
import NavbarMenuToggle from "./NavbarMenuToggle";
import { useCart } from "./CartProvider";

const utilityLinks = [
  { href: "/help", label: "Help center" },
  { href: "/orders", label: "Track an order" },
  { href: "/sell", label: "Start selling" },
];

const primaryLinks = [
  { href: "/shop", label: "Browse" },
  { href: "/series", label: "Series" },
  { href: "/community", label: "Community" },
  { href: "/collectibles", label: "Collectibles" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountUser | null>(null);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const { items: cartItems } = useCart();

  useEffect(() => {
    let active = true;
    const refreshAccount = () => {
      getCurrentAccount().then((currentAccount) => {
        if (active) setAccount(currentAccount);
      });
    };
    refreshAccount();
    window.addEventListener(AUTH_CHANGE_EVENT, refreshAccount);
    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGE_EVENT, refreshAccount);
    };
  }, []);

  const handleLogout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await logout();
    setAccount(null);
    router.push("/account/login");
  };

  return (
    <header className={styles.navBar} data-site-navbar>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>

      <div className={styles.utilityBar}>
        <div className={styles.utilityBarInner}>
          <p className={styles.utilityMessage}>
            A community marketplace for manga readers and collectors
          </p>

          <nav aria-label="Utility navigation">
            <ul className={styles.utilityList}>
              {utilityLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className={styles.mainNavBar}>
        <Link
          className={styles.brand}
          href="/"
          aria-label="MangaMarketplace home"
        >
          <span className={styles.brandMark} aria-hidden="true">
            読
          </span>
          <span>MangaMarketplace</span>
        </Link>

        <NavbarMenuToggle />

        <nav
          className={styles.primaryNav}
          id="primary-navigation"
          aria-label="Primary navigation"
        >
          <ul className={styles.primaryList}>
            {primaryLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.shoppingTools}>
          <form
            action={`${basePath}/search`}
            className={styles.search}
            role="search"
          >
            <label className={styles.visuallyHidden} htmlFor="header-search">
              Search by title, series, ISBN, or seller
            </label>
            <input
              id="header-search"
              type="search"
              name="q"
              placeholder="Title, series, ISBN, seller"
            />
            <button type="submit">Search</button>
          </form>

          <div className={styles.accountTools}>
            <ul
              className={styles.checkoutList}
              aria-label="Account and checkout"
            >
              <li>
                {account ? (
                  <Link href="/account">Account</Link>
                ) : (
                  <Link href="/account/login">Login / Signup</Link>
                )}
              </li>
              {account && (
                <li>
                  <form onSubmit={handleLogout}>
                    <button className={styles.signOutButton} type="submit">
                      Sign out
                    </button>
                  </form>
                </li>
              )}
              <li>
                <Link className={styles.cartLink} href="/cart">
                  <span>Cart</span>
                  <span className={styles.cartCount} aria-label={`${cartItems.length} items`}>
                    {cartItems.length}
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}
