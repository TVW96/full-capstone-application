import { getAvailableInventory } from "@/lib/featured-inventory";
import FeaturedView from "./FeaturedView";

export default async function Featured() {
  const items = await getAvailableInventory();

  return <FeaturedView items={items} />;
}
