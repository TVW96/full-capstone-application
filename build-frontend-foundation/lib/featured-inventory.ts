export type FeaturedInventoryItem = {
  id: string;
  title: string;
  series: string;
  author: string;
  edition: string;
  condition: string;
  description: string;
  price: number;
  imageUrl: string;
  popularity: number;
  availability: "available";
  itemCount?: number;
  purchasable?: boolean;
};

type ApiRecord = Record<string, unknown>;

const coverImages = [
  "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=900&q=86",
  "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=900&q=86",
  "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=900&q=86",
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=900&q=86",
  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=86",
  "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=86",
];

function asRecord(value: unknown): ApiRecord | undefined {
  return value && typeof value === "object" ? (value as ApiRecord) : undefined;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeListings(payload: unknown): FeaturedInventoryItem[] {
  if (!Array.isArray(payload)) return [];

  return payload.flatMap((entry, index) => {
    const listing = asRecord(entry);
    if (!listing || asString(listing.status).toLowerCase() !== "active") return [];

    const listingItems = Array.isArray(listing.listingItems) ? listing.listingItems : [];
    const firstListingItem = asRecord(listingItems[0]);
    const inventoryItem = asRecord(firstListingItem?.inventoryItem);
    const product = asRecord(inventoryItem?.product);
    const imagePath = asString(inventoryItem?.sellerPhotoPath);

    return [{
      id: asString(listing.listingId),
      title: asString(listing.title, asString(product?.title, `Marketplace listing ${index + 1}`)),
      series: asString(product?.series, "Independent title"),
      author: asString(product?.author, "Community seller"),
      edition: asString(product?.edition, listingItems.length > 1 ? "Collector bundle" : "Standard edition"),
      condition: asString(inventoryItem?.condition, "Seller described"),
      description: asString(listing.description, asString(inventoryItem?.conditionNotes, "Seller photos and copy details available.")),
      price: asNumber(listing.price),
      imageUrl: imagePath || coverImages[index % coverImages.length],
      popularity: Math.max(60, 96 - index * 4),
      availability: "available" as const,
      itemCount: Math.max(1, listingItems.length),
      purchasable: true,
    }];
  });
}

async function fetchApiCollection(url: string): Promise<unknown[]> {
  const response = await fetch(url, {
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(1800),
  });

  if (!response.ok) throw new Error(`Inventory API returned ${response.status}`);
  const payload: unknown = await response.json();
  return Array.isArray(payload) ? payload : [];
}

export async function getAvailableInventory(): Promise<FeaturedInventoryItem[]> {
  const apiBase = (
    process.env.BACKEND_API_URL ??
    process.env.NEXT_PUBLIC_BACKEND_API_URL ??
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");

  try {
    const listings = await fetchApiCollection(`${apiBase}/listings`);
    return normalizeListings(listings);
  } catch {
    return [];
  }
}

export async function getAvailableInventoryItem(id: string): Promise<FeaturedInventoryItem | undefined> {
  return (await getAvailableInventory()).find((item) => item.id === id);
}
