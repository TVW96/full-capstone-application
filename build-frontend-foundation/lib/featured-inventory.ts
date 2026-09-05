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

type FallbackInventoryItem = Omit<FeaturedInventoryItem, "availability"> & {
  availability: "available" | "sold";
};

const fallbackInventory: FallbackInventoryItem[] = [
  {
    id: "inv-vagabond-01",
    title: "Vagabond VIZBIG Edition, Vol. 1",
    series: "Vagabond",
    author: "Takehiko Inoue",
    edition: "VIZBIG Edition",
    condition: "Very Good",
    description: "Clean pages, a firm spine, and only faint shelf wear along the lower edge.",
    price: 17.5,
    imageUrl: coverImages[0],
    popularity: 98,
    availability: "available",
  },
  {
    id: "inv-fullmetal-01",
    title: "Fullmetal Alchemist: Fullmetal Edition, Vol. 1",
    series: "Fullmetal Alchemist",
    author: "Hiromu Arakawa",
    edition: "Hardcover",
    condition: "Like New",
    description: "A crisp collector copy with sharp corners and a bright metallic cover.",
    price: 21,
    imageUrl: coverImages[1],
    popularity: 94,
    availability: "available",
  },
  {
    id: "inv-naruto-01",
    title: "Naruto, Vol. 1",
    series: "Naruto",
    author: "Masashi Kishimoto",
    edition: "English Paperback",
    condition: "Like New",
    description: "Read once and stored upright in a smoke-free home.",
    price: 8.5,
    imageUrl: coverImages[2],
    popularity: 91,
    availability: "available",
  },
  {
    id: "inv-one-piece-01",
    title: "One Piece, Vol. 1",
    series: "One Piece",
    author: "Eiichiro Oda",
    edition: "Early Paperback Printing",
    condition: "Good",
    description: "Mild page toning with a strong binding and no writing inside.",
    price: 7.75,
    imageUrl: coverImages[3],
    popularity: 89,
    availability: "available",
  },
  {
    id: "inv-pluto-01",
    title: "Pluto: Urasawa x Tezuka, Vol. 1",
    series: "Pluto",
    author: "Naoki Urasawa",
    edition: "Signature Edition",
    condition: "Very Good",
    description: "A handsome reading copy with light wear at the spine ends.",
    price: 13,
    imageUrl: coverImages[4],
    popularity: 86,
    availability: "available",
  },
  {
    id: "inv-witch-hat-01",
    title: "Witch Hat Atelier, Vol. 1",
    series: "Witch Hat Atelier",
    author: "Kamome Shirahama",
    edition: "English Paperback",
    condition: "New",
    description: "Unread copy with immaculate pages and no visible shelf wear.",
    price: 11.5,
    imageUrl: coverImages[5],
    popularity: 84,
    availability: "available",
  },
  {
    id: "inv-monster-01",
    title: "Monster: The Perfect Edition, Vol. 1",
    series: "Monster",
    author: "Naoki Urasawa",
    edition: "Perfect Edition",
    condition: "Very Good",
    description: "Square spine, clean cover, and a tiny mark on the bottom edge.",
    price: 16,
    imageUrl: coverImages[1],
    popularity: 82,
    availability: "available",
  },
  {
    id: "inv-blue-period-01",
    title: "Blue Period, Vol. 1",
    series: "Blue Period",
    author: "Tsubasa Yamaguchi",
    edition: "English Paperback",
    condition: "Good",
    description: "Gently read with a shallow corner crease on the back cover.",
    price: 8,
    imageUrl: coverImages[0],
    popularity: 79,
    availability: "available",
  },
  {
    id: "inv-20th-century-01",
    title: "20th Century Boys: Perfect Edition, Vol. 1",
    series: "20th Century Boys",
    author: "Naoki Urasawa",
    edition: "Perfect Edition",
    condition: "Like New",
    description: "Barely handled, with a tight binding and spotless cover.",
    price: 18.25,
    imageUrl: coverImages[3],
    popularity: 77,
    availability: "available",
  },
  {
    id: "inv-dorohedoro-01",
    title: "Dorohedoro, Vol. 1",
    series: "Dorohedoro",
    author: "Q Hayashida",
    edition: "English Paperback",
    condition: "Very Good",
    description: "Clean interior with light rubbing on the matte cover.",
    price: 12,
    imageUrl: coverImages[4],
    popularity: 73,
    availability: "available",
  },
  {
    id: "inv-sold-example",
    title: "Death Note Black Edition, Vol. 1",
    series: "Death Note",
    author: "Tsugumi Ohba",
    edition: "Black Edition",
    condition: "Good",
    description: "Previously sold inventory.",
    price: 15,
    imageUrl: coverImages[5],
    popularity: 99,
    availability: "sold",
  },
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
  const apiBase = (process.env.BACKEND_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");

  try {
    const listings = await fetchApiCollection(`${apiBase}/listings`);
    const available = normalizeListings(listings);
    if (available.length > 0) return available;
  } catch {
    // The frontend remains useful when the local Nest API is not running.
  }

  return fallbackInventory.flatMap((item) =>
    item.availability === "available"
      ? [{ ...item, availability: "available" as const, itemCount: 1, purchasable: false }]
      : [],
  );
}

export async function getAvailableInventoryItem(id: string): Promise<FeaturedInventoryItem | undefined> {
  return (await getAvailableInventory()).find((item) => item.id === id);
}
