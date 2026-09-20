"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, ShoppingCart, ArrowRight, Gamepad2, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/order";
import EmptyState from "@/components/EmptyState";

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, total, count } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Add some game top-ups and gift cards to get started. Codes are delivered instantly after payment."
          action={{ href: "/shop", label: "Browse Products", primary: true }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-8 font-serif text-3xl font-bold text-text-primary">
        Shopping Cart <span className="font-mono text-lg font-normal text-text-muted">({count} items)</span>
      </h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map((item) => (
            <div
              key={item.variantId}
              className="group relative flex gap-4 rounded-lg border border-border bg-surface p-4"
            >
              <Link
                href={`/product/${item.productSlug}`}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface"
              >
                {item.productImage ? (
                  <Image
                    src={item.productImage}
                    alt={item.productName}
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-bg/40">
                    <Gamepad2 className="h-8 w-8 text-border" />
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeItem(item.variantId);
                  }}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-bg/85 text-text-muted opacity-0 transition duration-200 hover:bg-red-500 hover:text-white group-hover:opacity-100"
                  aria-label={`Remove ${item.productName} from cart`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Link>
              <div className="flex-1">
                <Link
                  href={`/product/${item.productSlug}`}
                  className="font-semibold text-text-primary hover:text-accent-chrome"
                >
                  {item.productName}
                </Link>
                <p className="text-sm text-text-muted">{item.variantName}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1">
                    <button
                      onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="p-1 text-text-muted transition hover:text-text-primary disabled:opacity-30"
                      aria-label="Decrease"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center font-mono text-sm font-semibold text-text-primary">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                      disabled={!!item.stock && item.stock > 0 && item.quantity >= item.stock}
                      className="p-1 text-text-muted transition hover:text-text-primary"
                      aria-label="Increase"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-bold text-price">
                      {formatPrice(item.unitPrice * item.quantity)}
                    </span>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      className="rounded-lg p-2 text-text-muted hover:bg-surface hover:text-red-400"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit rounded-lg border border-border bg-surface p-6 lg:sticky lg:top-24">
          <h2 className="font-serif text-lg font-bold text-text-primary">Order Summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            {items.map((i) => (
              <div key={i.variantId} className="flex justify-between text-text-muted">
                <span className="line-clamp-1">
                  {i.productName} ({i.variantName}) × {i.quantity}
                </span>
                <span className="font-mono">{formatPrice(i.unitPrice * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-text-muted">
              <span>Subtotal</span>
              <span className="font-mono">{formatPrice(total)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Taxes & fees</span>
              <span className="font-mono">—</span>
            </div>
          </div>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-base">
            <span className="font-semibold text-text-primary">Total</span>
            <span className="font-mono text-xl font-bold text-price">{formatPrice(total)}</span>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Codes are delivered instantly after payment.
          </p>
          <button
            onClick={() => router.push("/checkout")}
            className="mt-4 w-full rounded-xl bg-accent-oxblood py-3 font-bold text-white shadow-lg shadow-accent-oxblood/25 transition duration-200 hover:bg-accent-oxblood/90 hover:shadow-accent-oxblood/40 active:scale-[0.98]"
          >
            Proceed to Checkout
          </button>
          <Link
            href="/shop"
            className="mt-3 block text-center text-sm text-text-muted transition-colors hover:text-accent-chrome"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
