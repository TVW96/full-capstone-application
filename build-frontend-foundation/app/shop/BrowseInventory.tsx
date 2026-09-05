"use client";

import { useState } from "react";

import type { CatalogProduct, InventoryItem } from "@/lib/marketplace-api";

import styles from "./page.module.css";

type BrowseInventoryProps = {
  catalogProducts: CatalogProduct[];
  inventoryItems: InventoryItem[];
};

function formatAvailability(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function BrowseInventory({
  catalogProducts,
  inventoryItems,
}: BrowseInventoryProps) {
  const [selectedCondition, setSelectedCondition] = useState("all");
  const productsById = new Map(
    catalogProducts.map((product) => [product.productId, product]),
  );
  const conditions = Array.from(
    new Set(inventoryItems.map((item) => item.condition)),
  ).sort((first, second) => first.localeCompare(second));
  const filteredItems =
    selectedCondition === "all"
      ? inventoryItems
      : inventoryItems.filter((item) => item.condition === selectedCondition);

  return (
    <>
      <section className={styles.filterBar} aria-label="Inventory filters">
        <div className={styles.filterIntroduction}>
          <strong>Filter copies</strong>
          <span aria-live="polite">
            Showing {filteredItems.length} of {inventoryItems.length}
          </span>
        </div>

        <div className={styles.filterControl}>
          <label htmlFor="condition-filter">Condition</label>
          <select
            id="condition-filter"
            name="condition"
            value={selectedCondition}
            onChange={(event) => setSelectedCondition(event.target.value)}
          >
            <option value="all">All conditions</option>
            {conditions.map((condition) => (
              <option key={condition} value={condition}>
                {condition}
              </option>
            ))}
          </select>
        </div>
      </section>

      {filteredItems.length > 0 ? (
        <ul className={styles.grid} aria-label="Manga inventory">
          {filteredItems.map((item, index) => {
            const product = productsById.get(item.productId);
            const title = product?.title ?? "Catalog item";

            return (
              <li className={styles.card} key={item.itemId}>
                <article aria-labelledby={`inventory-title-${item.itemId}`}>
                  {item.sellerPhotoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={styles.sellerPhoto}
                      src={item.sellerPhotoPath}
                      alt={`${title} — seller’s copy`}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.cover} aria-hidden="true">
                      <span>読</span>
                      <small>{String(index + 1).padStart(2, "0")}</small>
                    </div>
                  )}
                  <div className={styles.cardBody}>
                    <div className={styles.cardTopline}>
                      <span
                        className={styles.status}
                        data-status={item.availability}
                      >
                        {formatAvailability(item.availability)}
                      </span>
                      {product?.edition && <span>{product.edition}</span>}
                    </div>

                    <h2 id={`inventory-title-${item.itemId}`}>{title}</h2>
                    {product?.author && (
                      <p className={styles.author}>by {product.author}</p>
                    )}

                    <dl className={styles.details}>
                      <div>
                        <dt>Condition</dt>
                        <dd>{item.condition}</dd>
                      </div>
                      <div>
                        <dt>ISBN</dt>
                        <dd>{product?.isbn ?? "Not listed"}</dd>
                      </div>
                    </dl>

                    {item.conditionNotes && (
                      <p className={styles.notes}>{item.conditionNotes}</p>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <section className={styles.empty} aria-labelledby="no-results-heading">
          <h2 id="no-results-heading">No copies match this condition</h2>
          <p>Choose another condition to see more inventory.</p>
        </section>
      )}
    </>
  );
}
