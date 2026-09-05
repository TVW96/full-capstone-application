"use client";

import { useEffect, useState } from "react";

import {
  getBrowseInventory,
  type CatalogProduct,
  type InventoryItem,
} from "@/lib/marketplace-api";
import BrowseInventory from "./BrowseInventory";
import styles from "./page.module.css";

type BrowseData = {
  inventoryItems: InventoryItem[];
  catalogProducts: CatalogProduct[];
};

export default function ShopPageClient() {
  const [browseData, setBrowseData] = useState<BrowseData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getBrowseInventory()
      .then((data) => {
        if (active) setBrowseData(data);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return (
      <div className={styles.page}>
        <main className={styles.main} id="main-content">
          <section className={styles.empty} aria-labelledby="api-error-heading">
            <p className={styles.eyebrow}>Connection issue</p>
            <h1 id="api-error-heading">Inventory is temporarily unavailable</h1>
            <p>Please try again when the marketplace API is available.</p>
          </section>
        </main>
      </div>
    );
  }

  if (!browseData) {
    return (
      <div className={styles.page}>
        <main className={styles.main} id="main-content">
          <section className={styles.empty}>
            <p className={styles.eyebrow}>Community inventory</p>
            <h1>Loading manga copies…</h1>
          </section>
        </main>
      </div>
    );
  }

  const { inventoryItems, catalogProducts } = browseData;
  return (
    <div className={styles.page}>
      <main className={styles.main} id="main-content">
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Community inventory</p>
          <h1>Browse manga copies</h1>
          <p>
            Explore the exact editions and conditions currently tracked by
            MangaMarketplace sellers.
          </p>
          <p className={styles.resultCount} aria-live="polite">
            {inventoryItems.length}{" "}
            {inventoryItems.length === 1 ? "copy" : "copies"}
          </p>
        </header>

        {inventoryItems.length > 0 ? (
          <BrowseInventory
            catalogProducts={catalogProducts}
            inventoryItems={inventoryItems}
          />
        ) : (
          <section className={styles.empty} aria-labelledby="empty-heading">
            <h2 id="empty-heading">No copies are available yet</h2>
            <p>Check back after sellers add inventory.</p>
          </section>
        )}
      </main>
    </div>
  );
}
