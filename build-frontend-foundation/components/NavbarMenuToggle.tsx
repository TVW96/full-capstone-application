"use client";

import { useEffect, useState } from "react";

import styles from "./Navbar.module.css";

export default function NavbarMenuToggle() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeOnNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("header a")) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("click", closeOnNavigation);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOnNavigation);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <button
      aria-controls="primary-navigation"
      aria-expanded={open}
      aria-label={open ? "Close navigation menu" : "Open navigation menu"}
      className={styles.menuToggle}
      onClick={() => setOpen((current) => !current)}
      type="button"
    >
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </button>
  );
}
