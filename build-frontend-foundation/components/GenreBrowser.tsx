"use client";

import { useState } from "react";

import Carousel from "./Carousel";
import { genreItems, Genre } from "@/data/genre";
import styles from "./GenreBrowser.module.css";

const genres: { id: Genre; label: string }[] = [
  { id: "action", label: "Action" },
  { id: "romance", label: "Romance" },
  { id: "mystery", label: "Mystery" },
  { id: "sci-fi", label: "Sci-Fi" },
  { id: "isekai", label: "Isekai" },
];

export default function GenreBrowser() {
  const [activeGenre, setActiveGenre] = useState<Genre>("action");

  return (
    <div className={styles.browser}>
      <div className={styles.selectionBar} role="tablist" aria-label="Genres">
        {genres.map((genre) => (
          <button
            className={activeGenre === genre.id ? styles.active : ""}
            key={genre.id}
            type="button"
            role="tab"
            aria-selected={activeGenre === genre.id}
            onClick={() => setActiveGenre(genre.id)}
          >
            {genre.label}
          </button>
        ))}
      </div>

      <Carousel ariaLabel={`${activeGenre} manga`}>
        {genreItems[activeGenre].map((item) => (
          <article className={styles.item} key={item.id}>
            <div className={styles.cover} aria-hidden="true">
              {item.title.slice(0, 1)}
            </div>
            <div>
              <p className={styles.volume}>Volume {item.volume}</p>
              <h3>{item.title}</h3>
              <p>by {item.author}</p>
            </div>
          </article>
        ))}
      </Carousel>
    </div>
  );
}
