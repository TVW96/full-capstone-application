"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import styles from "./ThemeToggle.module.css";

type Theme = "light" | "dark";
type WidgetPosition = { x: number; y: number };
type DragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
};

const themeQuery = "(prefers-color-scheme: dark)";
const positionStorageKey = "theme-widget-position";
const viewportMargin = 8;
const dragThreshold = 4;

function getSavedTheme(): Theme | null {
  try {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
  } catch {
    // Fall through to the operating-system preference when storage is blocked.
  }

  return null;
}

function getSystemTheme(mediaQuery = window.matchMedia(themeQuery)): Theme {
  return mediaQuery.matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function getSavedPosition(): WidgetPosition | null {
  try {
    const value = JSON.parse(localStorage.getItem(positionStorageKey) ?? "null");

    if (
      value &&
      Number.isFinite(value.x) &&
      Number.isFinite(value.y)
    ) {
      return value as WidgetPosition;
    }
  } catch {
    // Use the navbar-aligned starting position when storage is unavailable.
  }

  return null;
}

function savePosition(position: WidgetPosition) {
  try {
    localStorage.setItem(positionStorageKey, JSON.stringify(position));
  } catch {
    // Dragging remains available for the current page when storage is blocked.
  }
}

export default function ThemeToggle() {
  const widgetRef = useRef<HTMLButtonElement>(null);
  const hasManualOverride = useRef(false);
  const hasCustomPosition = useRef(false);
  const dragState = useRef<DragState | null>(null);
  const didDrag = useRef(false);

  const clampPosition = useCallback((x: number, y: number): WidgetPosition => {
    const widget = widgetRef.current;
    const width = widget?.offsetWidth ?? 52;
    const height = widget?.offsetHeight ?? 52;

    return {
      x: Math.min(
        Math.max(viewportMargin, x),
        Math.max(viewportMargin, window.innerWidth - width - viewportMargin),
      ),
      y: Math.min(
        Math.max(viewportMargin, y),
        Math.max(viewportMargin, window.innerHeight - height - viewportMargin),
      ),
    };
  }, []);

  const setWidgetPosition = useCallback((x: number, y: number) => {
    const widget = widgetRef.current;

    if (!widget) return;

    const position = clampPosition(x, y);
    widget.style.setProperty("--widget-x", `${position.x}px`);
    widget.style.setProperty("--widget-y", `${position.y}px`);
    widget.dataset.positioned = "true";

    return position;
  }, [clampPosition]);

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(themeQuery);
    const savedTheme = getSavedTheme();

    hasManualOverride.current = savedTheme !== null;
    applyTheme(savedTheme ?? getSystemTheme(mediaQuery));

    function handleSystemThemeChange(event: MediaQueryListEvent) {
      if (!hasManualOverride.current) {
        applyTheme(event.matches ? "dark" : "light");
      }
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  useLayoutEffect(() => {
    if (!widgetRef.current) return;

    const widget = widgetRef.current;
    const navbar = document.querySelector<HTMLElement>("[data-site-navbar]");

    const savedPosition = getSavedPosition();

    function setInitialPosition() {
      const navbarHeight = navbar?.offsetHeight ?? 128;
      const rootFontSize = Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize,
      );
      const rightOffset = Number.isFinite(rootFontSize) ? rootFontSize : 16;
      const x = window.innerWidth - widget.offsetWidth - rightOffset;
      const y = navbarHeight / 2 - widget.offsetHeight / 2;

      setWidgetPosition(x, y);
    }

    if (savedPosition) {
      hasCustomPosition.current = true;
      const position = setWidgetPosition(savedPosition.x, savedPosition.y);

      if (position) savePosition(position);
    } else {
      setInitialPosition();
    }

    function handleResize() {
      if (!hasCustomPosition.current) {
        setInitialPosition();
        return;
      }

      const bounds = widget.getBoundingClientRect();
      const position = setWidgetPosition(bounds.left, bounds.top);

      if (position) savePosition(position);
    }

    window.addEventListener("resize", handleResize);
    const navbarObserver = navbar
      ? new ResizeObserver(() => {
          if (!hasCustomPosition.current) setInitialPosition();
        })
      : null;

    if (navbar) navbarObserver?.observe(navbar);

    return () => {
      window.removeEventListener("resize", handleResize);
      navbarObserver?.disconnect();
    };
  }, [setWidgetPosition]);

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;

    const bounds = event.currentTarget.getBoundingClientRect();

    dragState.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      startX: event.clientX,
      startY: event.clientY,
    };
    didDrag.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;

    if (!drag || drag.pointerId !== event.pointerId) return;

    const distance = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    );

    if (!didDrag.current && distance < dragThreshold) return;

    didDrag.current = true;
    event.currentTarget.dataset.dragging = "true";
    setWidgetPosition(
      event.clientX - drag.offsetX,
      event.clientY - drag.offsetY,
    );
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;

    if (!drag || drag.pointerId !== event.pointerId) return;

    dragState.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    delete event.currentTarget.dataset.dragging;

    if (didDrag.current) {
      hasCustomPosition.current = true;
      const bounds = event.currentTarget.getBoundingClientRect();
      savePosition({ x: bounds.left, y: bounds.top });
      window.setTimeout(() => {
        didDrag.current = false;
      });
    }
  }

  function toggleTheme() {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }

    const currentTheme =
      document.documentElement.dataset.theme ?? getSystemTheme();
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    hasManualOverride.current = true;
    applyTheme(nextTheme);

    try {
      localStorage.setItem("theme", nextTheme);
    } catch {
      // The visual toggle still works when storage is unavailable.
    }
  }

  return (
    <button
      ref={widgetRef}
      className={styles.themeToggle}
      type="button"
      onClick={toggleTheme}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-label="Toggle light and dark mode. Drag to reposition."
      title="Toggle theme · Drag to reposition"
    >
      <svg
        className={styles.moonIcon}
        aria-hidden="true"
        viewBox="0 0 24 24"
      >
        <path d="M20.2 15.3A8.4 8.4 0 0 1 8.7 3.8a8.5 8.5 0 1 0 11.5 11.5Z" />
      </svg>
      <svg
        className={styles.sunIcon}
        aria-hidden="true"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
