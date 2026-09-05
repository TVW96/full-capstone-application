export type Genre = "action" | "romance" | "mystery" | "sci-fi" | "isekai";

export type GenreItem = {
  id: string;
  title: string;
  volume: number;
  author: string;
};

export const genreItems: Record<Genre, GenreItem[]> = {
  action: [
    { id: "action-1", title: "Iron Vanguard", volume: 1, author: "A. Mori" },
    { id: "action-2", title: "Blazing Circuit", volume: 4, author: "K. Sato" },
    { id: "action-3", title: "Skybreaker", volume: 2, author: "R. Ito" },
    { id: "action-4", title: "Wolf Squadron", volume: 7, author: "M. Tan" },
    { id: "action-5", title: "Crimson Ronin", volume: 3, author: "Y. Abe" },
    { id: "action-6", title: "Neon Fist", volume: 5, author: "J. Park" },
    { id: "action-7", title: "Titan's Wake", volume: 1, author: "L. Chen" },
    { id: "action-8", title: "Rogue Star", volume: 6, author: "S. Vega" },
    { id: "action-9", title: "Storm Runner", volume: 8, author: "D. Kim" },
    { id: "action-10", title: "The Last Vanguard", volume: 2, author: "N. Ellis" },
  ],
  romance: [
    { id: "romance-1", title: "Paper Lantern Hearts", volume: 1, author: "M. Sato" },
    { id: "romance-2", title: "After the Rain", volume: 3, author: "H. Watanabe" },
    { id: "romance-3", title: "Coffee at Sunset", volume: 2, author: "E. Flores" },
    { id: "romance-4", title: "A Map to You", volume: 5, author: "C. Lee" },
    { id: "romance-5", title: "Blooming Days", volume: 4, author: "R. Okada" },
    { id: "romance-6", title: "The Summer We Met", volume: 1, author: "T. Nguyen" },
    { id: "romance-7", title: "Starlight Promise", volume: 6, author: "F. Ito" },
    { id: "romance-8", title: "Sweet on You", volume: 2, author: "A. Brooks" },
    { id: "romance-9", title: "Letters in Spring", volume: 7, author: "P. Mori" },
    { id: "romance-10", title: "Our Shared Horizon", volume: 3, author: "S. Kim" },
  ],
  mystery: [
    { id: "mystery-1", title: "The Vanishing Bookmark", volume: 1, author: "N. Kato" },
    { id: "mystery-2", title: "Midnight at Platform Nine", volume: 2, author: "J. Reed" },
    { id: "mystery-3", title: "Case File: Blue Moon", volume: 4, author: "Y. Tanaka" },
    { id: "mystery-4", title: "The Glass Cipher", volume: 3, author: "S. Patel" },
    { id: "mystery-5", title: "Murder in Ink", volume: 5, author: "L. Sato" },
    { id: "mystery-6", title: "The Hollow Staircase", volume: 1, author: "D. Wong" },
    { id: "mystery-7", title: "Fog over Kuroda", volume: 6, author: "M. Evans" },
    { id: "mystery-8", title: "Seven Silent Clues", volume: 2, author: "A. Mori" },
    { id: "mystery-9", title: "The Locked Garden", volume: 8, author: "C. Ito" },
    { id: "mystery-10", title: "A Stranger's Alibi", volume: 3, author: "R. Chen" },
  ],
  "sci-fi": [
    { id: "sci-fi-1", title: "Orbitfall", volume: 1, author: "K. Vega" },
    { id: "sci-fi-2", title: "Signal from Europa", volume: 3, author: "I. Tan" },
    { id: "sci-fi-3", title: "Chrome Genesis", volume: 2, author: "A. Reed" },
    { id: "sci-fi-4", title: "The Lunar Archive", volume: 5, author: "M. Chen" },
    { id: "sci-fi-5", title: "Zero-G Summer", volume: 1, author: "S. Ito" },
    { id: "sci-fi-6", title: "After the Singularity", volume: 4, author: "N. Park" },
    { id: "sci-fi-7", title: "Starship Nocturne", volume: 6, author: "J. Okada" },
    { id: "sci-fi-8", title: "The Terraformers", volume: 2, author: "E. Brooks" },
    { id: "sci-fi-9", title: "Memory Engine", volume: 7, author: "T. Mori" },
    { id: "sci-fi-10", title: "Red Planet Radio", volume: 3, author: "D. Flores" },
  ],
  isekai: [
    { id: "isekai-1", title: "Summoned to the Tea Shop", volume: 1, author: "H. Abe" },
    { id: "isekai-2", title: "The Otherworld Cartographer", volume: 2, author: "M. Lee" },
    { id: "isekai-3", title: "Dungeon Café", volume: 4, author: "R. Sato" },
    { id: "isekai-4", title: "My Slime Companion", volume: 3, author: "Y. Chen" },
    { id: "isekai-5", title: "Crown of the Forgotten Realm", volume: 5, author: "F. Park" },
    { id: "isekai-6", title: "The Villain's Second Life", volume: 1, author: "A. Mori" },
    { id: "isekai-7", title: "Herbalist in Another World", volume: 6, author: "C. Watanabe" },
    { id: "isekai-8", title: "The Clockwork Kingdom", volume: 2, author: "J. Kim" },
    { id: "isekai-9", title: "Summoner's Weekend", volume: 7, author: "N. Ellis" },
    { id: "isekai-10", title: "A Hero's Quiet Farm", volume: 3, author: "S. Vega" },
  ],
};
