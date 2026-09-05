"use client";

import {
  Children,
  KeyboardEvent,
  ReactNode,
  useState,
} from "react";

import styles from "./Carousel.module.css";

type CarouselProps = {
  children: ReactNode;
  ariaLabel?: string;
};

export default function Carousel({
  children,
  ariaLabel = "Carousel",
}: CarouselProps) {
  const slides = Children.toArray(children);
  const [activeIndex, setActiveIndex] = useState(0);
  const slideCount = slides.length;

  if (slideCount === 0) {
    return null;
  }

  const currentIndex = Math.min(activeIndex, slideCount - 1);

  const goToSlide = (index: number) => {
    setActiveIndex((index + slideCount) % slideCount);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToSlide(currentIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goToSlide(currentIndex + 1);
    }
  };

  return (
    <section
      className={styles.carousel}
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      onKeyDown={handleKeyDown}
    >
      <div className={styles.viewport}>
        <div
          className={styles.slide}
          role="group"
          aria-roledescription="slide"
          aria-label={`${currentIndex + 1} of ${slideCount}`}
        >
          {slides[currentIndex]}
        </div>
      </div>

      {slideCount > 1 && (
        <div className={styles.controls}>
          <button
            className={styles.arrow}
            type="button"
            onClick={() => goToSlide(currentIndex - 1)}
            aria-label="Previous slide"
          >
            <span aria-hidden="true">&#8592;</span>
          </button>

          <div className={styles.indicators} aria-label="Choose slide">
            {slides.map((_, index) => (
              <button
                className={`${styles.indicator} ${
                  index === currentIndex ? styles.activeIndicator : ""
                }`}
                key={index}
                type="button"
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === currentIndex ? "true" : undefined}
              />
            ))}
          </div>

          <button
            className={styles.arrow}
            type="button"
            onClick={() => goToSlide(currentIndex + 1)}
            aria-label="Next slide"
          >
            <span aria-hidden="true">&#8594;</span>
          </button>
        </div>
      )}
    </section>
  );
}
