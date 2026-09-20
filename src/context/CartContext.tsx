"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { CartItem } from "@/lib/types";
import { cartTotal } from "@/lib/order";

const STORAGE_KEY = "gts-cart";

interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue>({
  items: [],
  count: 0,
  total: 0,
  addItem: () => {},
  updateQuantity: () => {},
  removeItem: () => {},
  clear: () => {},
  isOpen: false,
  openCart: () => {},
  closeCart: () => {},
});

function readStoredCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore corrupt cart
  }
  return [];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() =>
    typeof window === "undefined" ? [] : readStoredCart()
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        const requestedQuantity = existing.quantity + item.quantity;
        const quantity =
          existing.stock && existing.stock > 0
            ? Math.min(existing.stock, requestedQuantity)
            : requestedQuantity;
        return prev.map((i) =>
          i.variantId === item.variantId
            ? { ...i, stock: item.stock ?? i.stock, quantity }
            : i
        );
      }
      return [
        ...prev,
        {
          ...item,
          quantity:
            item.stock && item.stock > 0
              ? Math.min(item.stock, item.quantity)
              : item.quantity,
        },
      ];
    });
    setIsOpen(true);
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.variantId !== variantId)
        : prev.map((i) =>
            i.variantId === variantId
              ? {
                  ...i,
                  quantity:
                    i.stock && i.stock > 0
                      ? Math.min(i.stock, quantity)
                      : quantity,
                }
              : i
          )
    );
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = cartTotal(items);

  return (
    <CartContext.Provider
      value={{
        items,
        count,
        total,
        addItem,
        updateQuantity,
        removeItem,
        clear,
        isOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
