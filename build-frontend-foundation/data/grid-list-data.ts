type ProductListing = {
  listingTitle: string;
  sellerID: string;
  imageURL: string[];
  price: number;
  description: string;
};

export const testProducts: ProductListing[] = [
  {
    listingTitle: 'One Piece: Straw Hat Adventure Box Set',
    sellerID: 'seller_001',
    imageURL: [
      'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=800&q=80',
    ],
    price: 89.99,
    description: 'Collector edition manga box set featuring the epic journey of the Straw Hat crew.',
  },
  {
    listingTitle: 'Naruto Akatsuki Art Print',
    sellerID: 'seller_002',
    imageURL: [
      'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80',
    ],
    price: 24.5,
    description: 'High-quality comic-inspired poster with bold ninja energy and iconic Akatsuki styling.',
  },
  {
    listingTitle: 'Dragon Ball Z Battle Manga Vol. 1',
    sellerID: 'seller_003',
    imageURL: [
      'https://images.unsplash.com/photo-1520045892732-304bc3ac5d8e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80',
    ],
    price: 179.99,
    description: 'Classic manga volume with intense battles, power-ups, and legendary Saiyan action.',
  },
  {
    listingTitle: 'Attack on Titan Deluxe Poster',
    sellerID: 'seller_004',
    imageURL: [
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=800&q=80',
    ],
    price: 54.0,
    description: 'Dramatic anime-inspired wall poster capturing the tension and scale of the Titan battle.',
  },
  {
    listingTitle: 'My Hero Academia Hero Guide',
    sellerID: 'seller_005',
    imageURL: [
      'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&w=800&q=80',
    ],
    price: 31.75,
    description: 'A collector-friendly visual guide covering the heroes, powers, and major moments.',
  },
  {
    listingTitle: 'Death Note Notebook Replica',
    sellerID: 'seller_006',
    imageURL: [
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
    ],
    price: 42.0,
    description: 'Authentic-inspired notebook styled after the iconic Death Note series.',
  },
  {
    listingTitle: 'Fullmetal Alchemist SteelBook',
    sellerID: 'seller_007',
    imageURL: [
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
    ],
    price: 68.5,
    description: 'Premium limited steelbook edition that celebrates the classic alchemy epic.',
  },
  {
    listingTitle: 'Tokyo Ghoul Character Poster',
    sellerID: 'seller_008',
    imageURL: [
      'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80',
    ],
    price: 19.99,
    description: 'Dark and atmospheric poster featuring the moody, intense world of Tokyo Ghoul.',
  },
  {
    listingTitle: 'Jujutsu Kaisen Manga Box Set',
    sellerID: 'seller_009',
    imageURL: [
      'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=800&q=80',
    ],
    price: 94.25,
    description: 'A sleek collectible manga set featuring the occult battles and cursed energy action.',
  },
  {
    listingTitle: 'Hunter x Hunter Art Collection',
    sellerID: 'seller_010',
    imageURL: [
      'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1520045892732-304bc3ac5d8e?auto=format&fit=crop&w=800&q=80',
    ],
    price: 57.0,
    description: 'A vibrant art book packed with character designs, scenes, and iconic moments.',
  },
  {
    listingTitle: 'Pokemon Trainer Backpack',
    sellerID: 'seller_011',
    imageURL: [
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=800&q=80',
    ],
    price: 39.9,
    description: 'A compact, stylish backpack inspired by the charm and adventure of Pokémon trainers.',
  },
  {
    listingTitle: 'Bleach Soul Reaper Figure',
    sellerID: 'seller_012',
    imageURL: [
      'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
    ],
    price: 129.99,
    description: 'A detailed collectible figure capturing the spirit and atmosphere of a Soul Reaper.',
  },
  {
    listingTitle: 'One Punch Man Hero Poster',
    sellerID: 'seller_013',
    imageURL: [
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=800&q=80',
    ],
    price: 27.5,
    description: 'A bold, high-energy poster celebrating the chaotic power and humor of One Punch Man.',
  },
];