"use client";

import Link from "next/link";
import { useState } from "react";

import { type CartItem, useCart } from "./CartProvider";
import styles from "./AddToCartButton.module.css";

export default function AddToCartButton({ item }: { item: CartItem }) {
  const { addItem, hasItem } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = hasItem(item.listingId) || added;

  if (!item.purchasable) {
    return <p className={styles.unavailable}>Preview listing · Connect the marketplace API to purchase</p>;
  }

  return inCart ? (
    <Link className={styles.checkout} href="/cart">In cart · Review checkout <span aria-hidden="true">→</span></Link>
  ) : (
    <button className={styles.add} type="button" onClick={() => { addItem(item); setAdded(true); }}>
      Add to cart
    </button>
  );
}
