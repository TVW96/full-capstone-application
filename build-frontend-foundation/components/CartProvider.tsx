"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  listingId: string;
  title: string;
  series: string;
  condition: string;
  price: number;
  imageUrl: string;
  purchasable: boolean;
};

type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (listingId: string) => void;
  clearCart: () => void;
  hasItem: (listingId: string) => boolean;
};

const STORAGE_KEY = "manga-marketplace-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let restored: CartItem[] = [];
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) restored = parsed.slice(0, 10) as CartItem[];
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    queueMicrotask(() => {
      setItems(restored);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const addItem = useCallback((item: CartItem) => setItems((current) => current.some(({ listingId }) => listingId === item.listingId) ? current : [...current, item].slice(0, 10)), []);
  const removeItem = useCallback((listingId: string) => setItems((current) => current.filter((item) => item.listingId !== listingId)), []);
  const clearCart = useCallback(() => setItems((current) => current.length ? [] : current), []);

  const value = useMemo<CartContextValue>(() => ({
    items,
    hydrated,
    addItem,
    removeItem,
    clearCart,
    hasItem: (listingId) => items.some((item) => item.listingId === listingId),
  }), [addItem, clearCart, hydrated, items, removeItem]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider.");
  return context;
}
