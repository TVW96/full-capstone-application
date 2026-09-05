"use client";

import { useId, useState } from "react";
import type { CatalogProduct } from "@/lib/marketplace-api";
import { CONDITIONS, type CopyDraft } from "./_lib/selling-api";
import styles from "./sell.module.css";

type Props = {
  copy: CopyDraft;
  index: number;
  products: CatalogProduct[];
  catalogState: string;
  onChange: (patch: Partial<CopyDraft>) => void;
  onRemove?: () => void;
  onPhotos: (files: File[]) => void;
  onRemovePhoto: (id: string) => void;
  onRetryCatalog: () => void;
};

export default function CopyEditor({
  copy,
  index,
  products,
  catalogState,
  onChange,
  onRemove,
  onPhotos,
  onRemovePhoto,
  onRetryCatalog,
}: Props) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState(false);
  const selected = products.find(
    (product) => product.productId === copy.productId,
  );
  const matches = products.filter((product) =>
    [product.title, product.series, product.isbn, product.author].some(
      (value) => value?.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  const field = (
    key: keyof CopyDraft,
    label: string,
    optional = true,
    maxLength = 160,
  ) => (
    <label className={styles.field}>
      <span>
        {label}
        {optional && <small>Optional</small>}
      </span>
      <input
        value={String(copy[key])}
        required={!optional}
        maxLength={maxLength}
        onChange={(event) => onChange({ [key]: event.target.value })}
      />
    </label>
  );
  return (
    <section className={styles.copy} aria-labelledby={`${id}-heading`}>
      <header className={styles.row}>
        <h3 id={`${id}-heading`}>
          <span className={styles.number}>
            {String(index + 1).padStart(2, "0")}
          </span>{" "}
          {selected?.title || copy.title || "Your manga copy"}
        </h3>
        {onRemove && (
          <button
            className={styles.textButton}
            type="button"
            onClick={onRemove}
            aria-label={`Remove copy ${index + 1}`}
          >
            Remove
          </button>
        )}
      </header>
      <div
        className={styles.segmented}
        role="group"
        aria-label={`Book source for copy ${index + 1}`}
      >
        <button
          type="button"
          aria-pressed={copy.mode === "catalog"}
          onClick={() => onChange({ mode: "catalog" })}
        >
          Find in catalog
        </button>
        <button
          type="button"
          aria-pressed={copy.mode === "new"}
          onClick={() => onChange({ mode: "new" })}
        >
          Add a new title
        </button>
      </div>
      {copy.mode === "catalog" ? (
        <div className={styles.stack}>
          <label className={styles.field}>
            <span>Search by title, author, or ISBN</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="e.g. Chainsaw Man, Vol. 1"
            />
          </label>
          {catalogState === "error" ? (
            <p className={styles.error} role="alert">
              The catalog is unavailable.{" "}
              <button
                type="button"
                className={styles.textButton}
                onClick={onRetryCatalog}
              >
                Try again
              </button>
            </p>
          ) : (
            <label className={styles.field}>
              <span>
                Catalog title <small>Match your edition and language</small>
              </span>
              <select
                required
                value={copy.productId}
                disabled={catalogState === "loading"}
                onChange={(event) =>
                  onChange({ productId: event.target.value })
                }
              >
                <option value="">
                  {catalogState === "loading"
                    ? "Loading catalog…"
                    : "Select a matching title"}
                </option>
                {selected && !matches.includes(selected) && (
                  <option value={selected.productId}>{selected.title}</option>
                )}
                {matches.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {[
                      product.title,
                      product.edition,
                      product.language,
                      product.isbn,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </option>
                ))}
              </select>
            </label>
          )}
          {catalogState === "ready" && !matches.length && (
            <p className={styles.hint}>
              No matching titles. Choose “Add a new title” to enter your book.
            </p>
          )}
          {selected && (
            <div className={styles.catalogMatch}>
              <span aria-hidden="true">✓</span>
              <div>
                <strong>{selected.title}</strong>
                <p>
                  {[
                    selected.author,
                    selected.language?.toUpperCase(),
                    selected.edition,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Catalog title selected"}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.stack}>
          <p className={styles.hint}>
            Can’t find your edition? Add its book details so other collectors
            can find it too.
          </p>
          {field("title", "Book title", false)}
          <div className={styles.fieldGrid}>
            {field("series", "Series")}
            <label className={styles.field}>
              <span>
                Volume <small>Optional</small>
              </span>
              <input
                type="number"
                min="1"
                max="9999"
                step="1"
                value={copy.volumeNumber}
                onChange={(event) =>
                  onChange({ volumeNumber: event.target.value })
                }
              />
            </label>
          </div>
          <div className={styles.fieldGrid}>
            {field("author", "Author")}
            <label className={styles.field}>
              <span>Language</span>
              <select
                value={copy.language}
                onChange={(event) => onChange({ language: event.target.value })}
              >
                <option value="en">English</option>
                <option value="ja">Japanese</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ko">Korean</option>
                <option value="zh">Chinese</option>
              </select>
            </label>
          </div>
          <details className={styles.moreDetails}>
            <summary>
              Edition, publisher & ISBN <span>Optional</span>
            </summary>
            <div className={styles.stack}>
              <div className={styles.fieldGrid}>
                {field("edition", "Edition", true, 80)}
                {field("publisher", "Publisher")}
              </div>
              {field("isbn", "ISBN", true, 20)}
            </div>
          </details>
        </div>
      )}
      <div className={styles.divider} />
      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>Condition</span>
          <select
            required
            value={copy.condition}
            onChange={(event) => onChange({ condition: event.target.value })}
          >
            <option value="">Select condition</option>
            {CONDITIONS.map((condition) => (
              <option key={condition}>{condition}</option>
            ))}
          </select>
        </label>
        <p className={styles.conditionTip}>
          Be a little picky. Mention yellowing, bent corners, annotations, or
          missing extras.
        </p>
      </div>
      <label className={styles.field}>
        <span>
          Condition notes <small>Optional</small>
        </span>
        <textarea
          maxLength={2000}
          rows={2}
          value={copy.conditionNotes}
          onChange={(event) => onChange({ conditionNotes: event.target.value })}
          placeholder="e.g. Light shelf wear on the spine. Clean pages, no writing."
        />
      </label>
      <div className={styles.photoHeading}>
        <h4>Photos of this copy</h4>
        <span>{copy.photos.length} added · first photo is the cover</span>
      </div>
      <div
        className={styles.dropzone}
        data-dragging={dragging}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onPhotos(Array.from(event.dataTransfer.files));
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="30"
          height="30"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M4 7h4l2-3h4l2 3h4v13H4z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <strong>Give buyers a closer look</strong>
        <p>
          Drop photos here or{" "}
          <label htmlFor={`${id}-photos`}>choose files</label>
        </p>
        <input
          id={`${id}-photos`}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          aria-label={`Upload photos for copy ${index + 1}`}
          onChange={(event) => {
            onPhotos(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <small>
          JPG, PNG, WebP or AVIF · up to 8 MB each
          <br />
          At least 1 per copy · 8 photos / 32 MB per listing
        </small>
      </div>
      {copy.photos.length > 0 && (
        <ul
          className={styles.photoGrid}
          aria-label={`Photos for copy ${index + 1}`}
        >
          {copy.photos.map((photo, position) => (
            <li key={photo.id}>
              {/* Local file previews must remain in the browser. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Your copy ${index + 1}, photo ${position + 1}`}
              />
              <span className={styles.photoBadge}>
                {position === 0
                  ? "Cover"
                  : String(position + 1).padStart(2, "0")}
              </span>
              <button
                type="button"
                className={styles.removePhoto}
                onClick={() => onRemovePhoto(photo.id)}
                aria-label={`Remove photo ${position + 1} from copy ${index + 1}`}
              >
                ×
              </button>
              {position > 0 && (
                <button
                  className={styles.coverButton}
                  type="button"
                  onClick={() =>
                    onChange({
                      photos: [
                        photo,
                        ...copy.photos.filter((item) => item.id !== photo.id),
                      ],
                    })
                  }
                >
                  Make cover
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
