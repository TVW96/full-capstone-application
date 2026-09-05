export type CatalogProduct = {
  productId: string;
  title: string;
  series: string | null;
  volumeNumber: number | null;
  edition: string | null;
  isbn: string | null;
  author: string | null;
  publisher: string | null;
  language: string | null;
  publicationDate: string | null;
};

export type InventoryItem = {
  itemId: string;
  productId: string;
  ownerId: string;
  condition: string;
  conditionNotes: string | null;
  availability: "available" | "listed" | "sold" | "unavailable";
  acquisitionPrice: string | null;
  sellerPhotoPath: string | null;
};

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_API_URL ||
  "http://127.0.0.1:3001"
).replace(/\/$/, "");

async function fetchCollection<T>(path: string): Promise<T[]> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Marketplace API returned ${response.status} for ${path}`);
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(`Marketplace API returned an invalid collection for ${path}`);
  }

  return data as T[];
}

export async function getBrowseInventory(): Promise<{
  inventoryItems: InventoryItem[];
  catalogProducts: CatalogProduct[];
}> {
  const [inventoryItems, catalogProducts] = await Promise.all([
    fetchCollection<InventoryItem>("/inventory-items"),
    fetchCollection<CatalogProduct>("/catalog-products"),
  ]);

  return { inventoryItems, catalogProducts };
}
