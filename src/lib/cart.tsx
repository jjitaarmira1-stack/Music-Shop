"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BUSINESS } from "@/lib/business";

export interface CartProduct {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  image: string;
  stock: number;
}

export interface CartLine {
  product: CartProduct;
  qty: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  totalCents: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (product: CartProduct, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// La clave de almacenamiento sigue al nombre del negocio configurado.
const STORAGE_KEY = `${BUSINESS.name.toLowerCase()}-cart-v1`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* carrito corrupto: empezar limpio */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    }
  }, [lines, hydrated]);

  const add = useCallback((product: CartProduct, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id
            ? { ...l, qty: Math.min(l.qty + qty, product.stock || 99) }
            : l,
        );
      }
      return [...prev, { product, qty: Math.min(qty, product.stock || 99) }];
    });
    setIsOpen(true);
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.product.id !== productId)
        : prev.map((l) =>
            l.product.id === productId
              ? { ...l, qty: Math.min(qty, l.product.stock || 99) }
              : l,
          ),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((acc, l) => acc + l.qty, 0);
    const totalCents = lines.reduce(
      (acc, l) => acc + l.qty * l.product.priceCents,
      0,
    );
    return {
      lines,
      count,
      totalCents,
      isOpen,
      openCart,
      closeCart,
      add,
      remove,
      setQty,
      clear,
    };
  }, [lines, isOpen, openCart, closeCart, add, remove, setQty, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
