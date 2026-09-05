"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { normalizeListings, type FeaturedInventoryItem } from "@/lib/featured-inventory";
import styles from "./Featured.module.css";

type DisplayMode = "grid" | "carousel" | "hero";

const modes: Array<{ id: DisplayMode; label: string; description: string }> = [
  { id: "grid", label: "Infinite grid", description: "Browse in a vertical scrolling grid" },
  { id: "carousel", label: "Carousel", description: "Browse in a horizontal carousel" },
  { id: "hero", label: "Popular", description: "See the three most popular items" },
];

function ViewIcon({ mode }: { mode: DisplayMode }) {
  if (mode === "grid") {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z" /></svg>;
  }
  if (mode === "carousel") {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 5h3v10H2zM7 3h6v14H7zM15 5h3v10h-3z" /></svg>;
  }
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2.2 2.3 4.7 5.2.8-3.8 3.6.9 5.2-4.6-2.4-4.6 2.4.9-5.2-3.8-3.6 5.2-.8z" /></svg>;
}

function Price({ value }: { value: number }) {
  if (value <= 0) return <span className={styles.price}>Price on request</span>;
  return <data className={styles.price} value={value}>${value.toFixed(2)}</data>;
}

function ItemCard({
  item,
  onPreview,
}: {
  item: FeaturedInventoryItem;
  onPreview: (item: FeaturedInventoryItem) => void;
}) {
  return (
    <article className={styles.itemCard}>
      <button className={styles.cardPreview} type="button" onClick={() => onPreview(item)} aria-label={`Preview ${item.title}`}>
        <span className={styles.cardImageWrap}>
          <Image className={styles.cardImage} src={item.imageUrl} alt="" fill sizes="(max-width: 40rem) 72vw, 18rem" />
          <span className={styles.quickView}>Quick view</span>
        </span>
        <span className={styles.cardBody}>
          <span className={styles.cardMeta}>{item.series} · {item.condition}</span>
          <strong className={styles.cardTitle}>{item.title}</strong>
          <span className={styles.cardFooter}>
            <span>{item.edition}</span>
            <Price value={item.price} />
          </span>
        </span>
      </button>
    </article>
  );
}

function PreviewDialog({
  item,
  onClose,
}: {
  item: FeaturedInventoryItem;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className={styles.modalBackdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="preview-title">
        <button ref={closeButton} className={styles.modalClose} type="button" onClick={onClose} aria-label="Close preview">×</button>
        <div className={styles.modalImageWrap}>
          <Image className={styles.modalImage} src={item.imageUrl} alt={`Seller preview for ${item.title}`} fill sizes="(max-width: 44rem) 90vw, 34rem" priority />
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalEyebrow}>Available now · {item.condition}</p>
          <h3 id="preview-title">{item.title}</h3>
          <p className={styles.modalByline}>by {item.author}</p>
          <p className={styles.modalDescription}>{item.description}</p>
          <dl className={styles.modalDetails}>
            <div><dt>Edition</dt><dd>{item.edition}</dd></div>
            <div><dt>Series</dt><dd>{item.series}</dd></div>
          </dl>
          <div className={styles.modalActionRow}>
            <Price value={item.price} />
            <Link className={styles.itemLink} href={`/product?id=${encodeURIComponent(item.id)}`}>View full listing <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>
    </div>
  );
}

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");

export default function FeaturedView({ items: initialItems }: { items: FeaturedInventoryItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [mode, setMode] = useState<DisplayMode>("grid");
  const [visibleCount, setVisibleCount] = useState(6);
  const [previewItem, setPreviewItem] = useState<FeaturedInventoryItem | null>(null);
  const carousel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/listings`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Listings unavailable")))
      .then((payload: unknown) => {
        const listings = normalizeListings(payload);
        if (listings.length) setItems(listings);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const popularItems = useMemo(
    () => [...items].sort((a, b) => b.popularity - a.popularity).slice(0, 3),
    [items],
  );

  const handleGridScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 120) {
      setVisibleCount((count) => Math.min(count + 4, items.length));
    }
  };

  const scrollCarousel = (direction: -1 | 1) => {
    carousel.current?.scrollBy({ left: direction * 330, behavior: "smooth" });
  };

  return (
    <section className={styles.featured} aria-labelledby="featured-heading">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>From collector shelves</p>
          <h2 id="featured-heading">Featured &amp; available</h2>
          <p className={styles.intro}>Every copy below is currently available from a community seller.</p>
        </div>
        <Link className={styles.viewAll} href="/shop">Shop all <span aria-hidden="true">↗</span></Link>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.modePicker} role="group" aria-label="Featured item display">
          {modes.map((option) => (
            <button
              className={styles.modeButton}
              data-active={mode === option.id}
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              aria-pressed={mode === option.id}
              title={option.description}
            >
              <ViewIcon mode={option.id} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <p className={styles.count}><span>{items.length}</span> copies ready to browse</p>
      </div>

      {mode === "grid" && (
        <div className={styles.gridScroller} onScroll={handleGridScroll} tabIndex={0} aria-label="Available inventory grid; scroll for more items">
          <div className={styles.grid}>
            {items.slice(0, visibleCount).map((item) => <ItemCard item={item} key={item.id} onPreview={setPreviewItem} />)}
          </div>
          <p className={styles.scrollStatus} aria-live="polite">
            {visibleCount < items.length ? "Keep scrolling to load more" : "You’ve reached the end of the shelf"}
          </p>
        </div>
      )}

      {mode === "carousel" && (
        <div className={styles.carouselShell}>
          <div className={styles.carouselControls} aria-label="Carousel controls">
            <button type="button" onClick={() => scrollCarousel(-1)} aria-label="Scroll carousel left">←</button>
            <button type="button" onClick={() => scrollCarousel(1)} aria-label="Scroll carousel right">→</button>
          </div>
          <div ref={carousel} className={styles.carousel} tabIndex={0} aria-label="Available inventory carousel">
            {items.map((item) => <ItemCard item={item} key={item.id} onPreview={setPreviewItem} />)}
          </div>
        </div>
      )}

      {mode === "hero" && (
        <div className={styles.heroGrid}>
          {popularItems.map((item, index) => (
            <article className={styles.heroItem} data-featured={index === 0} key={item.id}>
              <Image className={styles.heroImage} src={item.imageUrl} alt="" fill sizes={index === 0 ? "(max-width: 52rem) 100vw, 66vw" : "(max-width: 52rem) 100vw, 33vw"} />
              <div className={styles.heroShade} />
              <div className={styles.heroContent}>
                <p>#{index + 1} community favorite{item.popularity > 0 ? ` · ${item.popularity} saves` : ""}</p>
                <h3>{item.title}</h3>
                <div><span>{item.condition}</span><Price value={item.price} /></div>
                <button type="button" onClick={() => setPreviewItem(item)}>Preview copy <span aria-hidden="true">↗</span></button>
              </div>
            </article>
          ))}
        </div>
      )}

      {previewItem && <PreviewDialog item={previewItem} onClose={() => setPreviewItem(null)} />}
    </section>
  );
}
