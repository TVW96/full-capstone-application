"use client";

import { clearSession, readSession } from "@/app/account/_lib/client-api";
import type { CatalogProduct } from "@/lib/marketplace-api";

const API_URL = (
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:3001"
).replace(/\/$/, "");
export const CONDITIONS = [
  "New",
  "Like new",
  "Very good",
  "Good",
  "Acceptable",
] as const;
export const PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];
export type Photo = { id: string; file: File; url: string };
export type CopyDraft = {
  id: string;
  mode: "catalog" | "new";
  productId: string;
  title: string;
  series: string;
  volumeNumber: string;
  author: string;
  publisher: string;
  language: string;
  edition: string;
  isbn: string;
  condition: string;
  conditionNotes: string;
  photos: Photo[];
};
export type PublishedListing = {
  listingId: string;
  title: string;
  price: string;
  status: string;
};
export class PublicationError extends Error {
  constructor(
    message: string,
    public readonly retryOnly = false,
  ) {
    super(message);
  }
}

export function newCopy(): CopyDraft {
  return {
    id: crypto.randomUUID(),
    mode: "catalog",
    productId: "",
    title: "",
    series: "",
    volumeNumber: "",
    author: "",
    publisher: "",
    language: "en",
    edition: "",
    isbn: "",
    condition: "",
    conditionNotes: "",
    photos: [],
  };
}

export async function loadCatalog(): Promise<CatalogProduct[]> {
  const response = await fetch(`${API_URL}/catalog-products`, {
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("The catalog could not be loaded.");
  const data: unknown = await response.json();
  if (!Array.isArray(data))
    throw new Error("The catalog response was incomplete.");
  return data as CatalogProduct[];
}

export async function publishListing(
  submissionId: string,
  title: string,
  description: string,
  price: string,
  copies: CopyDraft[],
): Promise<PublishedListing> {
  const session = readSession();
  if (!session)
    throw new Error(
      "Your session expired. Sign in again in another tab, then retry here to keep your work.",
    );
  const form = new FormData();
  let photoIndex = 0;
  const payload = {
    submissionId,
    title: title.trim(),
    description: description.trim(),
    price: Number(price),
    copies: copies.map((copy) => ({
      ...(copy.mode === "catalog"
        ? { productId: copy.productId }
        : {
            product: {
              title: copy.title.trim(),
              language: copy.language,
              ...(copy.series.trim() && { series: copy.series.trim() }),
              ...(copy.volumeNumber && {
                volumeNumber: Number(copy.volumeNumber),
              }),
              ...(copy.author.trim() && { author: copy.author.trim() }),
              ...(copy.publisher.trim() && {
                publisher: copy.publisher.trim(),
              }),
              ...(copy.edition.trim() && { edition: copy.edition.trim() }),
              ...(copy.isbn.trim() && {
                isbn: copy.isbn.replace(/[\s-]/g, ""),
              }),
            },
          }),
      condition: copy.condition,
      conditionNotes: copy.conditionNotes.trim(),
      photoIndexes: copy.photos.map((photo) => {
        form.append("photos", photo.file);
        return photoIndex++;
      }),
    })),
  };
  form.append("payload", JSON.stringify(payload));
  let response: Response;
  try {
    response = await fetch(`${API_URL}/sell/listings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` },
      body: form,
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw new PublicationError(
      "We could not confirm publication. Keep this page open and retry: the same submission will not create a duplicate listing.",
      true,
    );
  }
  if (response.status === 401) {
    clearSession();
    throw new Error(
      "Your session expired. Sign in again in another tab, then retry here to keep your work.",
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new PublicationError(
      Array.isArray(body.message)
        ? body.message.join(" ")
        : body.message || "We could not publish your listing. Please retry.",
      response.status >= 500,
    );
  }
  if (!body.listingId || body.status !== "active")
    throw new PublicationError(
      "We could not confirm publication. Retry to check this submission.",
      true,
    );
  return body as PublishedListing;
}
