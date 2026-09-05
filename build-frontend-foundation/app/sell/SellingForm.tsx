"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AccountUser } from "@/app/account/_lib/account-types";
import type { CatalogProduct } from "@/lib/marketplace-api";
import CopyEditor from "./CopyEditor";
import {
  loadCatalog,
  newCopy,
  PHOTO_TYPES,
  PublicationError,
  publishListing,
  type CopyDraft,
  type PublishedListing,
} from "./_lib/selling-api";
import styles from "./sell.module.css";

const steps = ["Your copies", "Listing details", "Review & publish"];
const money = (value: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value) || 0,
  );
function validIsbn(value: string) {
  const isbn = value.replace(/[\s-]/g, "").toUpperCase();
  if (!isbn) return true;
  if (/^\d{9}[\dX]$/.test(isbn))
    return (
      [...isbn].reduce(
        (sum, digit, index) =>
          sum + (digit === "X" ? 10 : Number(digit)) * (10 - index),
        0,
      ) %
        11 ===
      0
    );
  return (
    /^97[89]\d{10}$/.test(isbn) &&
    [...isbn].reduce(
      (sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1),
      0,
    ) %
      10 ===
      0
  );
}

export default function SellingForm({ account }: { account: AccountUser }) {
  const [copies, setCopies] = useState<CopyDraft[]>(() => [newCopy()]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [catalogState, setCatalogState] = useState("loading");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PublishedListing | null>(null);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const [attempted, setAttempted] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const urls = useRef(new Set<string>());
  const submitting = useRef(false);
  const copyTitle = (copy: CopyDraft) =>
    copy.mode === "catalog"
      ? products.find((item) => item.productId === copy.productId)?.title ||
        "Select a manga title"
      : copy.title || "Your manga title";
  const cover = copies[0]?.photos[0];
  const photoCount = copies.reduce(
    (count, copy) => count + copy.photos.length,
    0,
  );
  const dirty = Boolean(
    title ||
    description ||
    price ||
    photoCount ||
    copies.some((copy) => copy.title || copy.productId || copy.condition),
  );

  useEffect(() => {
    let active = true;
    loadCatalog()
      .then((data) => {
        if (active) {
          setProducts(data);
          setCatalogState("ready");
        }
      })
      .catch(() => {
        if (active) setCatalogState("error");
      });
    return () => {
      active = false;
    };
  }, [catalogAttempt]);
  useEffect(() => {
    const currentUrls = urls.current;
    return () => {
      currentUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    if (!dirty || result) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, result]);
  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  function changeCopy(id: string, patch: Partial<CopyDraft>) {
    setCopies((current) =>
      current.map((copy) => (copy.id === id ? { ...copy, ...patch } : copy)),
    );
    setError("");
  }
  function release(url: string) {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }
  function addPhotos(id: string, files: File[]) {
    if (!files.length) return;
    if (
      files.some(
        (file) =>
          !PHOTO_TYPES.includes(file.type) ||
          !file.size ||
          file.size > 8 * 1024 * 1024,
      )
    ) {
      setError(
        "Choose JPG, PNG, WebP, or AVIF images up to 8 MB each. No files were added.",
      );
      return;
    }
    const bytes = copies
      .flatMap((copy) => copy.photos)
      .reduce((sum, photo) => sum + photo.file.size, 0);
    if (
      photoCount + files.length > 8 ||
      bytes + files.reduce((sum, file) => sum + file.size, 0) > 32 * 1024 * 1024
    ) {
      setError(
        "A listing can have up to 8 photos and 32 MB in total. Remove a photo or choose fewer files.",
      );
      return;
    }
    const photos = files.map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      return { id: crypto.randomUUID(), file, url };
    });
    setCopies((current) =>
      current.map((copy) =>
        copy.id === id
          ? { ...copy, photos: [...copy.photos, ...photos] }
          : copy,
      ),
    );
    setError("");
  }
  function goTo(next: number) {
    setError("");
    setStep(next);
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  }
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (step === 0) {
      const invalid = copies.findIndex(
        (copy) =>
          !(copy.mode === "catalog" ? copy.productId : copy.title.trim()) ||
          !copy.condition ||
          !copy.photos.length,
      );
      if (invalid !== -1) {
        setError(
          `Copy ${invalid + 1} needs a book title, condition, and at least one photo.`,
        );
        return;
      }
      if (copies.some((copy) => copy.mode === "new" && !validIsbn(copy.isbn))) {
        setError(
          "Check the ISBN. Enter a valid 10- or 13-digit ISBN, or leave it blank.",
        );
        return;
      }
      if (!title)
        setTitle(
          (copies.length > 1
            ? `${copyTitle(copies[0])} + ${copies.length - 1} more — manga bundle`
            : copyTitle(copies[0])
          ).slice(0, 160),
        );
      goTo(1);
      return;
    }
    if (step === 1) {
      if (!title.trim()) {
        setError("Give your listing a title.");
        return;
      }
      goTo(2);
      return;
    }
    submitting.current = true;
    setPending(true);
    setError("");
    setAttempted(true);
    try {
      setResult(
        await publishListing(submissionId, title, description, price, copies),
      );
    } catch (cause) {
      setAttempted(
        attempted || (cause instanceof PublicationError && cause.retryOnly),
      );
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not publish your listing. Please retry.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  function startAnother() {
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
    setCopies([newCopy()]);
    setTitle("");
    setDescription("");
    setPrice("");
    setSubmissionId(crypto.randomUUID());
    setAttempted(false);
    setResult(null);
    goTo(0);
    setCatalogAttempt((value) => value + 1);
  }

  if (result)
    return (
      <main id="main-content" className={styles.page}>
        <section className={styles.success} aria-live="polite">
          <span className={styles.successMark} aria-hidden="true">
            ✓
          </span>
          <p className={styles.eyebrow}>A new chapter starts here</p>
          <h1>Your listing is live.</h1>
          <p>{result.title}</p>
          <strong className={styles.successPrice}>{money(result.price)}</strong>
          <p>
            Your{" "}
            {copies.length === 1 ? "copy is" : `${copies.length} copies are`}{" "}
            listed, with photos ready for buyers to explore.
          </p>
          <p className={styles.hint}>Listing reference: {result.listingId}</p>
          <div className={styles.actions}>
            <button className={styles.primary} onClick={startAnother}>
              Create another listing <span aria-hidden="true">→</span>
            </button>
            <Link href="/shop" className={styles.secondary}>
              Browse the marketplace
            </Link>
          </div>
        </section>
      </main>
    );

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            From your shelf to their next favorite
          </p>
          <h1>
            Start selling<span>.</span>
          </h1>
          <p>Make room for your next read. Give your manga a new home.</p>
        </div>
        <div className={styles.seller}>
          <span aria-hidden="true">
            {account.username.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <small>Selling as</small>
            <strong>@{account.username}</strong>
          </div>
        </div>
      </header>
      <ol className={styles.steps} aria-label="Listing progress">
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? "step" : undefined}
            data-complete={step > index}
          >
            <span>{step > index ? "✓" : `0${index + 1}`}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
      <div className={styles.workspace}>
        <form onSubmit={onSubmit} className={styles.form} aria-busy={pending}>
          <header className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Step 0{step + 1} / 03</p>
            <h2 tabIndex={-1} ref={headingRef}>
              {
                [
                  "What’s leaving your shelf?",
                  "Make it a great find.",
                  "One last look.",
                ][step]
              }
            </h2>
            <p>
              {
                [
                  "Add one copy, or bring several together in a bundle.",
                  "Write a clear title and set a price for the whole listing.",
                  "Check your books, photos, and price before making your listing public.",
                ][step]
              }
            </p>
          </header>
          {error && (
            <div
              ref={alertRef}
              tabIndex={-1}
              className={styles.error}
              role="alert"
            >
              {error}
              {error.toLowerCase().includes("session") && (
                <p>
                  <a
                    href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/account/login/`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open sign in in a new tab
                  </a>
                </p>
              )}
            </div>
          )}
          <fieldset disabled={pending} className={styles.formFields}>
            {step === 0 && (
              <>
                {copies.map((copy, index) => (
                  <CopyEditor
                    key={copy.id}
                    copy={copy}
                    index={index}
                    products={products}
                    catalogState={catalogState}
                    onChange={(patch) => changeCopy(copy.id, patch)}
                    onRemove={
                      copies.length > 1
                        ? () => {
                            copy.photos.forEach((photo) => release(photo.url));
                            setCopies(
                              copies.filter((item) => item.id !== copy.id),
                            );
                          }
                        : undefined
                    }
                    onPhotos={(files) => addPhotos(copy.id, files)}
                    onRemovePhoto={(id) => {
                      const photo = copy.photos.find((item) => item.id === id);
                      if (photo) release(photo.url);
                      changeCopy(copy.id, {
                        photos: copy.photos.filter((item) => item.id !== id),
                      });
                    }}
                    onRetryCatalog={() => {
                      setCatalogState("loading");
                      setCatalogAttempt((value) => value + 1);
                    }}
                  />
                ))}
                {copies.length < 8 && (
                  <button
                    type="button"
                    className={styles.addCopy}
                    onClick={() => setCopies([...copies, newCopy()])}
                  >
                    <span aria-hidden="true">＋</span> Add another copy to this
                    bundle{" "}
                    <span className={styles.hint}>
                      {copies.length}/8 copies
                    </span>
                  </button>
                )}
              </>
            )}
            {step === 1 && (
              <section className={`${styles.panel} ${styles.stack}`}>
                <label className={styles.field}>
                  <span>
                    Listing title <small>{title.length}/160</small>
                  </span>
                  <input
                    required
                    maxLength={160}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Chainsaw Man Volumes 1–3 · English"
                  />
                </label>
                <label className={styles.field}>
                  <span>
                    Description <small>Optional</small>
                  </span>
                  <textarea
                    rows={6}
                    maxLength={5000}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Tell readers what makes this listing special. Include the volumes, extras, and anything they should know."
                  />
                </label>
                <div className={styles.divider} />
                <label className={styles.field}>
                  <span>
                    {copies.length > 1 ? "Bundle price (USD)" : "Price (USD)"}
                  </span>
                  <div className={styles.priceInput}>
                    <span aria-hidden="true">$</span>
                    <input
                      required
                      type="number"
                      min="0.01"
                      max="99999999.99"
                      step="0.01"
                      inputMode="decimal"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      placeholder="0.00"
                      aria-describedby="price-hint"
                    />
                  </div>
                </label>
                <p id="price-hint" className={styles.hint}>
                  One price for{" "}
                  {copies.length === 1
                    ? "your copy"
                    : `all ${copies.length} copies`}
                  . Enter the item price in US dollars.
                </p>
              </section>
            )}
            {step === 2 && (
              <section className={`${styles.panel} ${styles.stack}`}>
                <div className={styles.row}>
                  <h3>Listing details</h3>
                  {!attempted && (
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => goTo(1)}
                    >
                      Edit details
                    </button>
                  )}
                </div>
                <h4 className={styles.reviewTitle}>{title}</h4>
                <p className={styles.description}>
                  {description || "No additional description."}
                </p>
                <div className={styles.reviewPrice}>
                  <span>Total listing price</span>
                  <strong>{money(price)}</strong>
                </div>
                <div className={styles.divider} />
                <div className={styles.row}>
                  <h3>
                    {copies.length === 1
                      ? "Your copy"
                      : `${copies.length} copies in this bundle`}
                  </h3>
                  {!attempted && (
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => goTo(0)}
                    >
                      Edit copies
                    </button>
                  )}
                </div>
                {copies.map((copy) => (
                  <article className={styles.reviewCopy} key={copy.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={copy.photos[0]?.url} alt={copyTitle(copy)} />
                    <div>
                      <h4>{copyTitle(copy)}</h4>
                      <p>
                        {copy.condition} · {copy.photos.length}{" "}
                        {copy.photos.length === 1 ? "photo" : "photos"}
                      </p>
                      {copy.conditionNotes && (
                        <p className={styles.description}>
                          {copy.conditionNotes}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
                <p className={styles.publishNote}>
                  Publishing makes these book details, photos, and your seller
                  username public. Only upload photos you have permission to
                  use.
                </p>
                {attempted && (
                  <p className={styles.hint}>
                    This submission is locked for a safe retry. Keep this page
                    open until publication is confirmed.
                  </p>
                )}
              </section>
            )}
            <footer className={styles.formFooter}>
              {step > 0 && !attempted && (
                <button
                  className={styles.secondary}
                  type="button"
                  onClick={() => goTo(step - 1)}
                >
                  ← Back
                </button>
              )}
              <span className={styles.hint}>
                {step === 2
                  ? "Ready for its next reader."
                  : "Nothing is published until you confirm."}
              </span>
              <button
                type="submit"
                className={styles.primary}
                disabled={
                  pending ||
                  (step === 0 &&
                    copies.some(
                      (copy) =>
                        copy.mode === "catalog" && catalogState !== "ready",
                    ))
                }
              >
                {pending
                  ? "Uploading & publishing…"
                  : step === 2
                    ? attempted
                      ? "Retry publication"
                      : "Publish listing"
                    : step === 0
                      ? "Continue to details"
                      : "Review listing"}
                <span aria-hidden="true">→</span>
              </button>
            </footer>
          </fieldset>
          <p className={styles.sessionNote}>
            Your work stays on this page. Keep it open until you’ve published.
          </p>
        </form>
        <aside className={styles.sidebar} aria-label="Listing preview and tips">
          <div className={styles.preview}>
            <div className={styles.previewLabel}>
              <span>Listing preview</span>
              <span className={styles.draftBadge}>Not published</span>
            </div>
            <div className={styles.previewImage}>
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover.url} alt="Listing cover preview" />
              ) : (
                <div className={styles.emptyCover}>
                  <span aria-hidden="true">本</span>
                  <strong>
                    A new home for
                    <br />a good story.
                  </strong>
                  <small>Your cover photo will appear here</small>
                </div>
              )}
              {copies.length > 1 && (
                <span className={styles.bundleBadge}>
                  {copies.length}-copy bundle
                </span>
              )}
            </div>
            <div className={styles.previewBody}>
              <p className={styles.eyebrow}>
                {copies[0]?.condition || "Your next great find"}
              </p>
              <h3>{title || (copies[0] && copyTitle(copies[0]))}</h3>
              <strong className={styles.previewPrice}>
                {price ? money(price) : "$ —"}
              </strong>
              <div className={styles.previewMeta}>
                <span>@{account.username}</span>
                <span>
                  {photoCount} {photoCount === 1 ? "photo" : "photos"}
                </span>
              </div>
            </div>
          </div>
          <section className={styles.tips}>
            <p className={styles.eyebrow}>A little care goes a long way</p>
            <h3>Help the next reader say yes.</h3>
            <ul>
              <li>
                <span>01</span>
                <div>
                  <strong>Show the actual copy</strong>
                  <p>
                    Photograph the cover, spine, and any wear in natural light.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Get the edition right</strong>
                  <p>Check the language and ISBN inside your book.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Be clear about condition</strong>
                  <p>A small detail now builds trust with your buyer.</p>
                </div>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
