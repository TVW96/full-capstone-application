import { DeepPartial } from "typeorm";

import { User } from "../../users/entities/user.entity";
import { SELLER_IDS } from "./seed-identifiers";

export const userSeeds: DeepPartial<User>[] = [
  {
    userId: SELLER_IDS.collector,
    email: "collector@example.com",
    username: "collector",
    fullName: "Manga Collector",
    mailingAddressLine1: "125 Manga Lane",
    mailingAddressLine2: "Apartment 4B",
    region: "US",
    avatarUrl: null,
    bio: "Collects classic and deluxe manga editions.",
  },
  {
    userId: SELLER_IDS.trader,
    email: "trader@example.com",
    username: "trader",
    fullName: "Manga Trader",
    mailingAddressLine1: "88 Trade Street",
    mailingAddressLine2: "PO Box 488",
    region: "US",
    avatarUrl: null,
    bio: "Trades modern manga and starter bundles.",
  },
  {
    userId: SELLER_IDS.reader,
    email: "reader@example.com",
    username: "reader",
    fullName: "Manga Reader",
    mailingAddressLine1: "410 Reading Road",
    mailingAddressLine2: "Suite 12",
    region: "US",
    avatarUrl: null,
    bio: "Reads and shares pre-owned manga.",
  },
];
