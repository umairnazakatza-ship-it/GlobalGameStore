"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Zap, Minus, Plus, MessageCircle } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { formatPrice, buildWhatsAppLink } from "@/lib/order";

export interface BuyVariant {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  stock: number;
  soldOut?: boolean;
  priceOnRequest?: boolean;
  region?: { code: string; name: string } | null;
}

interface Props {
  productId: string;
  productSlug: string;
  productName: string;
  productImage: string | null;
  soldOut?: boolean;
  whatsappPhone: string;
  variants: BuyVariant[];
}

export default function ProductBuy({
  productId,
  productSlug,
  productName,
  productImage,
  soldOut,
  whatsappPhone,
  variants,
}: Props) {
  const router = useRouter();
  const { addItem } = useCart();
  const toast = useToast();
  const [selected, setSelected] = useState<BuyVariant | null>(
    () => variants.find((v) => !v.soldOut && !v.priceOnRequest) ?? variants[0] ?? null
  );
  const [qty, setQty] = useState(1);
  const regions = useMemo(
    () =>
      [...new Map(
        variants
          .filter((variant) => variant.region)
          .map((variant) => [variant.region!.code, variant.region!])
      ).values()],
    [variants]
  );
  const [selectedRegion, setSelectedRegion] = useState<string | null>(() => selected?.region?.code ?? regions[0]?.code ?? null);
  const activeRegion = regions.some((region) => region.code === selectedRegion)
    ? selectedRegion
    : regions[0]?.code ?? null;
  const visibleVariants = activeRegion
    ? variants.filter((variant) => variant.region?.code === activeRegion)
    : variants;

  const chooseRegion = (regionCode: string) => {
    setSelectedRegion(regionCode);
    const firstAvailable = variants.find(
      (variant) => variant.region?.code === regionCode && !variant.soldOut && !variant.priceOnRequest
    ) ?? variants.find((variant) => variant.region?.code === regionCode) ?? null;
    setSelected(firstAvailable);
    setQty(1);
  };

  if (soldOut) {
    return (
      <div className="mt-8 rounded-lg border border-red-500/30 bg-surface p-6">
        <p className="text-lg font-bold text-red-400">Sold Out</p>
        <p className="mt-1 text-sm text-text-muted">
          This product is currently unavailable. Please check back later.
        </p>
      </div>
    );
  }

  if (variants.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-border bg-surface p-6 text-text-muted">
        This product is currently unavailable.
      </div>
    );
  }

  const stock = selected ? selected.stock : 0;

  const handleAdd = () => {
    if (!selected || selected.soldOut) return;
    addItem({
      variantId: selected.id,
      productId,
      productSlug,
      productName,
      productImage,
      variantName: selected.name,
      unitPrice: selected.price,
      quantity: qty,
      stock: selected.stock,
    });
    toast.success(
      qty > 1
        ? `${qty} × ${productName} (${selected.name}) added to cart`
        : `${productName} added to cart`
    );
  };

  const handleBuyNow = () => {
    if (!selected || selected.soldOut) return;
    addItem({
      variantId: selected.id,
      productId,
      productSlug,
      productName,
      productImage,
      variantName: selected.name,
      unitPrice: selected.price,
      quantity: qty,
      stock: selected.stock,
    });
    router.push("/checkout");
  };

  return (
    <div className="mt-8 rounded-lg border border-border bg-surface p-6">
      {regions.length > 1 && (
        <div className="mb-6">
          <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-text-muted">Choose your store region</p>
          <div className="flex flex-wrap gap-2">
            {regions.map((region) => (
              <button
                key={region.code}
                onClick={() => chooseRegion(region.code)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition duration-200 active:scale-[0.98] ${
                  activeRegion === region.code
                    ? "border-accent-chrome bg-accent-chrome text-bg"
                    : "border-border text-text-muted hover:border-accent-chrome/50 hover:text-text-primary"
                }`}
              >
                {region.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mb-3 text-sm font-medium text-text-muted">Select amount:</p>
      <div className="flex flex-wrap gap-2">
        {visibleVariants.map((v) =>
          v.priceOnRequest && !v.soldOut ? (
            <a
              key={v.id}
              href={buildWhatsAppLink(
                whatsappPhone,
                `Hello! I'd like to know the price for ${productName} - ${v.name}.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-instock/40 bg-instock/5 px-4 py-3 text-left transition duration-200 hover:border-instock/60 hover:bg-instock/10 active:scale-[0.99]"
            >
              <span className="block text-sm font-semibold text-text-primary">{v.name}</span>
              <span className="flex items-center gap-1 font-mono text-sm font-bold text-instock">
                <MessageCircle className="h-4 w-4" /> Contact on WhatsApp for price
              </span>
            </a>
          ) : (
            <button
              key={v.id}
              onClick={() => {
                setSelected(v);
                setQty(1);
              }}
              disabled={v.soldOut}
              className={`rounded-xl border px-4 py-3 text-left transition duration-200 active:scale-[0.99] ${
                v.soldOut
                  ? "cursor-not-allowed border-border opacity-50"
                  : selected?.id === v.id
                    ? "border-accent-chrome bg-accent-chrome/10 shadow-sm shadow-accent-chrome/10 glow-chrome-sm"
                    : "border-border hover:border-accent-chrome/50 hover:bg-surface"
              }`}
            >
              <span className="block text-sm font-semibold text-text-primary">{v.name}</span>
              <span className="block font-mono text-sm font-bold text-price">
                {v.soldOut ? (
                  <span className="font-mono text-sm font-bold text-red-400">Out of stock</span>
                ) : (
                  <>
                    {formatPrice(v.price)}
                    {v.originalPrice && (
                      <span className="ml-2 font-mono text-xs font-normal text-old-price line-through">
                        {formatPrice(v.originalPrice)}
                      </span>
                    )}
                  </>
                )}
              </span>
            </button>
          )
        )}
      </div>

      {selected && !selected.priceOnRequest && (
        <>
          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-border px-2 py-2">
              <button
                onClick={() => setQty((n) => Math.max(1, n - 1))}
                disabled={qty <= 1}
                className="rounded-lg p-1 text-text-muted transition hover:text-text-primary disabled:opacity-30"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center font-mono font-semibold text-text-primary">{qty}</span>
              <button
                onClick={() => setQty((n) => Math.min(stock > 0 ? stock : 99, n + 1))}
                disabled={stock > 0 && qty >= stock}
                className="rounded-lg p-1 text-text-muted transition hover:text-text-primary disabled:opacity-30"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {stock > 0 && (
              <p className="text-sm text-text-muted">
                <span className="text-instock">{stock} codes in stock</span>
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleAdd}
              className="btn-ripple flex flex-1 items-center justify-center gap-2 rounded-xl border border-accent-chrome/60 px-5 py-3 font-semibold text-accent-chrome transition duration-200 hover:bg-accent-chrome/10 hover:glow-chrome-sm active:scale-[0.98]"
            >
              <ShoppingCart className="h-4 w-4" /> Add to Cart
            </button>
            <button
              onClick={handleBuyNow}
              className="btn-ripple flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-oxblood px-5 py-3 font-bold text-white shadow-lg shadow-accent-oxblood/25 transition duration-200 hover:bg-accent-oxblood/90 hover:shadow-accent-oxblood/40 hover:glow-oxblood active:scale-[0.98]"
            >
              <Zap className="h-4 w-4" /> Buy Now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
