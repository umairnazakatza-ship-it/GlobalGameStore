"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  KeyRound,
  UploadCloud,
  X,
  Gamepad2,
} from "lucide-react";
import { formatPrice } from "@/lib/order";
import type { Product, Region, Variant } from "@/lib/types";
import AddCodesResultDialog, {
  type AddCodesResult,
} from "@/components/admin/AddCodesResultDialog";
import AdminSkeleton from "@/components/admin/AdminSkeleton";

interface ProductRow extends Product {
  variants: (Variant & { available: number })[];
  available: number;
}

export default function AdminProducts({ isSubAdmin = false }: { isSubAdmin?: boolean }) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  // create/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    image_url: "",
    region_id: "",
    featured: false,
    active: true,
    sold_out: false,
  });

  // variant forms
  const [vName, setVName] = useState("");
  const [vPrice, setVPrice] = useState("");
  const [vOrig, setVOrig] = useState("");
  const [codesInput, setCodesInput] = useState("");
  const [vPriceOnRequest, setVPriceOnRequest] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [evName, setEvName] = useState("");
  const [evPrice, setEvPrice] = useState("");
  const [evOrig, setEvOrig] = useState("");
  const [evActive, setEvActive] = useState(true);
  const [evSoldOut, setEvSoldOut] = useState(false);
  const [evPriceOnRequest, setEvPriceOnRequest] = useState(false);
  const [codesForVariant, setCodesForVariant] = useState<string | null>(null);
  const [codesFilter, setCodesFilter] = useState<"all" | "available" | "sold">("all");
  const [codesList, setCodesList] = useState<{
    id: string;
    code: string;
    status: string;
    created_at: string;
    order_id: string | null;
    order: { order_number: string } | null;
  }[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addCodesResult, setAddCodesResult] = useState<AddCodesResult | null>(
    null
  );

interface ApiVariant extends Variant {
  available?: number;
}

interface ApiProduct extends Product {
  variants?: ApiVariant[];
}

interface ApiResponse {
  products?: ApiProduct[];
  regions?: Region[];
  available_codes?: Record<string, number>;
  error?: string;
}

  const load = () => {
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then((d: ApiResponse) => {
if (d.products) {
            setProducts(
              d.products.map((p) => ({
                ...p,
                variants: (p.variants ?? []).map((v) => ({
                  ...v,
                  available: d.available_codes?.[v.id] ?? 0,
                })),
                available: (p.variants ?? []).reduce(
                  (s, v) => s + (d.available_codes?.[v.id] ?? 0),
                  0
                ),
              }))
            );
            setRegions(d.regions ?? []);
          } else setError(d.error ?? "Failed to load");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3000);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", image_url: "", region_id: "", featured: false, active: true, sold_out: false });
    setModalOpen(true);
  };

  const openEdit = (p: ProductRow) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      image_url: p.image_url ?? "",
      region_id: p.region_id ?? "",
      featured: p.featured,
      active: p.active,
      sold_out: !!p.sold_out,
    });
    setModalOpen(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const url = editing ? `/api/admin/products/${editing.id}` : "/api/admin/products";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        region_id: form.region_id || null,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save");
      return;
    }
    setError("");
    setModalOpen(false);
    load();
    showNotice(editing ? "Product updated" : "Product created add variants and codes next");
  };

  const deleteProduct = async (p: ProductRow) => {
    if (!confirm(`Delete "${p.name}" and all its variants/codes?`)) return;
    await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
    load();
    showNotice("Product deleted");
  };

  const toggleSoldOut = async (p: ProductRow) => {
    const next = !p.sold_out;
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sold_out: next }),
    });
    if (res.ok) {
      load();
      showNotice(next ? `"${p.name}" marked as sold out` : `"${p.name}" is back in stock`);
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to update");
    }
  };

  const addVariant = async (productId: string) => {
    if (!vName || (!vPrice && !vPriceOnRequest)) return;
    const res = await fetch("/api/admin/variants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: productId,
        name: vName,
        price: Number(vPrice || 0),
        original_price: vOrig ? Number(vOrig) : null,
        price_on_request: vPriceOnRequest,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add variant");
      return;
    }
    setVName("");
    setVPrice("");
    setVOrig("");
    setVPriceOnRequest(false);
    load();
    showNotice("Variant added");
  };

  const addCodes = async (variantId: string) => {
    const raw = codesInput.split(/[\n,]+/).map((c) => c.trim()).filter(Boolean);
    if (raw.length === 0) return;
    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant_id: variantId, codes: raw }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add codes");
      return;
    }
    const added = data.added ?? 0;
    const purchasedCount = data.purchased?.count ?? 0;
    const alreadyInUseCount = data.already_in_use?.count ?? 0;
    const purchasedCodes: string[] = data.purchased?.codes ?? [];
    const alreadyInUseCodes: string[] = data.already_in_use?.codes ?? [];

    if (added > 0 || purchasedCount > 0 || alreadyInUseCount > 0) {
      if (added > 0) setCodesInput("");
      // Pop up a centered result dialog so the breakdown (added / purchased
      // already / already in use + the offending code chips) is the thing
      // the admin actually sees, instead of an inline banner at the top.
      setAddCodesResult({
        added,
        purchased: { count: purchasedCount, codes: purchasedCodes },
        already_in_use: {
          count: alreadyInUseCount,
          codes: alreadyInUseCodes,
        },
      });
      load();
    } else {
      setError(data.error ?? "Failed to add codes");
    }
  };

  const deleteVariant = async (id: string) => {
    if (!confirm("Delete this variant and all its codes?")) return;
    await fetch(`/api/admin/variants/${id}`, { method: "DELETE" });
    load();
    showNotice("Variant deleted");
  };

  const openEditVariant = (v: Variant & { available: number }) => {
    setEditingVariantId(v.id);
    setEvName(v.name);
    setEvPrice(String(v.price));
    setEvOrig(v.original_price != null ? String(v.original_price) : "");
    setEvActive(v.active);
    setEvSoldOut(!!v.sold_out);
    setEvPriceOnRequest(!!v.price_on_request);
  };

  const saveVariant = async (id: string) => {
    if (!evName || (!evPrice && !evPriceOnRequest)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/variants/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: evName,
        price: Number(evPrice || 0),
        original_price: evOrig ? Number(evOrig) : null,
        active: evActive,
        sold_out: evSoldOut,
        price_on_request: evPriceOnRequest,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to update variant");
      return;
    }
    setEditingVariantId(null);
    load();
    showNotice("Variant updated");
  };

  const toggleVariantSoldOut = async (v: Variant & { available: number }) => {
    const next = !v.sold_out;
    const res = await fetch(`/api/admin/variants/${v.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sold_out: next }),
    });
    if (res.ok) {
      load();
      showNotice(next ? `"${v.name}" marked as sold out` : `"${v.name}" is back in stock`);
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to update variant");
    }
  };

  const toggleCodes = (variantId: string) => {
    if (codesForVariant === variantId) {
      setCodesForVariant(null);
      return;
    }
    setCodesForVariant(variantId);
    setCodesList([]);
    setCodesLoading(true);
    fetch(`/api/admin/codes?variant_id=${variantId}`)
      .then((r) => r.json())
      .then((d) => setCodesList(d.codes ?? []))
      .finally(() => setCodesLoading(false));
  };

  const deleteCode = async (id: string) => {
    if (!confirm("Delete this code? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/codes/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (codesForVariant) {
        setCodesLoading(true);
        fetch(`/api/admin/codes?variant_id=${codesForVariant}`)
          .then((r) => r.json())
          .then((d) => setCodesList(d.codes ?? []))
          .finally(() => setCodesLoading(false));
      }
      load();
      showNotice("Code deleted");
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to delete code");
    }
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not upload image");
        return;
      }
      setForm((f) => ({ ...f, image_url: data.url }));
      showNotice("Image uploaded");
    } catch {
      setError("Could not upload image");
    } finally {
      setUploading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text-primary transition focus:border-accent-chrome focus:outline-none focus:ring-2 focus:ring-accent-chrome/15";

  const q = search.trim().toLowerCase();
  const filteredProducts = products.filter(
    (p) => !q || p.name.toLowerCase().includes(q) || (p.region?.name ?? "").toLowerCase().includes(q)
  );

  if (loading) return <AdminSkeleton rows={5} />;

  return (
    <div className="space-y-6">
      {notice && (
        <p className="rounded-xl border border-instock/30 bg-instock/10 px-4 py-3 text-sm text-instock">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {filteredProducts.length} product{filteredProducts.length === 1 ? "" : "s"}
          {q ? ` matching "${search}"` : ""}
        </p>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text-primary transition focus:border-accent-chrome focus:outline-none focus:ring-2 focus:ring-accent-chrome/15"
          />
          {!isSubAdmin && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-xl bg-accent-oxblood px-4 py-2.5 text-sm font-bold text-white transition duration-200 hover:bg-accent-oxblood/90 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" /> New Product
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {filteredProducts.map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-surface">
            <div className="flex flex-wrap items-center gap-4 p-4">
              <button
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                className="flex flex-1 items-center gap-4 text-left"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-bg">
                  {p.image_url ? (
                    <Image src={p.image_url} alt={p.name} width={56} height={56} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Gamepad2 className="h-6 w-6 text-border" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-primary">
                    {p.name}
                    {!p.active && <span className="ml-2 rounded-full bg-border px-2 py-0.5 text-xs text-text-muted">inactive</span>}
                    {p.sold_out && <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">sold out</span>}
                    {p.featured && <span className="ml-2 rounded-full bg-accent-chrome px-2 py-0.5 font-mono text-xs font-bold text-bg">sale</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {p.region?.name ?? "Global"} ·{" "}
                    {p.variants?.length ?? 0} variant(s) ·{" "}
                    <span className={p.available > 0 ? "text-instock" : "text-red-400"}>
                      {p.available} code(s) in stock
                    </span>
                  </p>
                </div>
                {expanded === p.id ? <ChevronUp className="h-5 w-5 text-text-muted" /> : <ChevronDown className="h-5 w-5 text-text-muted" />}
              </button>
              {!isSubAdmin && <div className="flex gap-2">
                <button
                  onClick={() => toggleSoldOut(p)}
                  className={`rounded-lg border px-2.5 py-2 text-xs font-bold transition ${
                    p.sold_out
                      ? "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      : "border-border text-text-muted hover:border-red-500/50 hover:text-red-400"
                  }`}
                  aria-label="Toggle sold out"
                >
                  {p.sold_out ? "In stock" : "Sold out"}
                </button>
                <button
                  onClick={() => openEdit(p)}
                  className="rounded-lg border border-border p-2 text-text-muted hover:border-accent-chrome hover:text-accent-chrome"
                  aria-label="Edit product"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteProduct(p)}
                  className="rounded-lg border border-border p-2 text-text-muted hover:border-red-500 hover:text-red-400"
                  aria-label="Delete product"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>}
            </div>

            {expanded === p.id && (
              <div className="space-y-5 border-t border-border p-4">
                {p.variants?.map((v) => (
                  <div key={v.id} className="rounded-xl border border-border bg-bg p-4">
                    {editingVariantId === v.id ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                          {!isSubAdmin && <input value={evName} onChange={(e) => setEvName(e.target.value)} placeholder="Variant name (e.g. 100 UC)" className={inputCls} />}
                          <input value={evPrice} onChange={(e) => setEvPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="Price" className={inputCls} />
                          {!isSubAdmin && <input value={evOrig} onChange={(e) => setEvOrig(e.target.value)} type="number" min="0" step="0.01" placeholder="Old price (optional)" className={inputCls} />}
                        </div>
                        {!isSubAdmin && (<div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-sm text-text-muted">
                            <input type="checkbox" checked={evActive} onChange={(e) => setEvActive(e.target.checked)} className="accent-accent-chrome" />
                            Active
                          </label>
                          <label className="flex items-center gap-2 text-sm text-text-muted">
                            <input type="checkbox" checked={evSoldOut} onChange={(e) => setEvSoldOut(e.target.checked)} className="accent-red-500" />
                            Sold out
                          </label>
                          <label className="flex items-center gap-2 text-sm text-text-muted">
                            <input type="checkbox" checked={evPriceOnRequest} onChange={(e) => setEvPriceOnRequest(e.target.checked)} className="accent-accent-chrome" />
                            Contact for price
                          </label>
                          <div className="ml-auto flex gap-2">
                            <button
                              onClick={() => saveVariant(v.id)}
                              disabled={busy}
                              className="rounded-lg bg-accent-oxblood px-4 py-2 text-xs font-bold text-white transition duration-200 hover:bg-accent-oxblood/90 active:scale-[0.97] disabled:opacity-60"
                            >
                              Save Variant
                            </button>
                            <button
                              onClick={() => setEditingVariantId(null)}
                              className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-text-muted hover:border-accent-chrome/50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>)}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-text-primary">{v.name}</p>
                          <p className="text-sm text-text-muted">
                            <span className="font-mono text-price">{formatPrice(Number(v.price))}</span>
                            {v.original_price && (
                              <span className="ml-2 font-mono text-old-price line-through">{formatPrice(Number(v.original_price))}</span>
                            )}
                            {" · "}
                            <span className={v.available > 0 ? "text-instock" : "text-red-400"}>
                              {v.available} available
                            </span>
                            {!v.active && (
                              <span className="ml-2 rounded-full bg-border px-2 py-0.5 text-xs text-text-muted">inactive</span>
                            )}
                            {v.sold_out && (
                              <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">sold out</span>
                            )}
                            {v.price_on_request && (
                              <span className="ml-2 rounded-full bg-accent-chrome/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-accent-chrome">contact for price</span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!isSubAdmin && <button
                            onClick={() => toggleVariantSoldOut(v)}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                              v.sold_out
                                ? "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                : "border-border text-text-muted hover:border-red-500/50 hover:text-red-400"
                            }`}
                            aria-label="Toggle variant sold out"
                          >
                            {v.sold_out ? "In stock" : "Sold out"}
                          </button>}
                          {!isSubAdmin && <button
                            onClick={() => addCodes(v.id)}
                            className="rounded-lg bg-accent-oxblood px-3 py-1.5 text-xs font-bold text-white transition duration-200 hover:bg-accent-oxblood/90 active:scale-[0.97]"
                            disabled={!codesInput.trim()}
                          >
                            Add codes
                          </button>}
                          {!isSubAdmin && <button
                            onClick={() => toggleCodes(v.id)}
                            className={`rounded-lg border p-1.5 transition ${
                              codesForVariant === v.id
                                ? "border-accent-chrome text-accent-chrome"
                                : "border-border text-text-muted hover:border-accent-chrome hover:text-accent-chrome"
                            }`}
                            aria-label="View codes"
                            title="View codes"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>}
                          <button
                            onClick={() => openEditVariant(v)}
                            className="rounded-lg border border-border p-1.5 text-text-muted hover:border-accent-chrome hover:text-accent-chrome"
                            aria-label="Edit variant"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {!isSubAdmin && <button
                            onClick={() => deleteVariant(v.id)}
                            className="rounded-lg border border-border p-1.5 text-text-muted hover:border-red-500 hover:text-red-400"
                            aria-label="Delete variant"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>}
                        </div>
                      </div>
                    )}
                    {codesForVariant === v.id && (
                      <div className="mt-3 border-t border-border pt-3">
                        {codesLoading ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-accent-chrome" />
                          </div>
                        ) : codesList.length === 0 ? (
                          <p className="text-xs text-text-muted">No codes for this variant.</p>
                        ) : (
                          <>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs text-text-muted">
                                {codesList.length} code{codesList.length === 1 ? "" : "s"}
                                {codesList.length > 500 ? ` (showing latest 500)` : ""}
                                {" · "}
                                <span className="text-instock">{codesList.filter((c) => c.status === "available").length} available</span>
                                {" · "}
                                <span className="text-amber-400">{codesList.filter((c) => c.status === "assigned").length} sold</span>
                              </p>
                              <div className="flex gap-1 rounded-lg border border-border bg-bg p-0.5 font-mono text-[10px] font-bold uppercase">
                                {(["all", "available", "sold"] as const).map((f) => (
                                  <button
                                    key={f}
                                    onClick={() => setCodesFilter(f)}
                                    className={`rounded-md px-2 py-1 transition ${
                                      codesFilter === f
                                        ? "bg-accent-chrome text-bg"
                                        : "text-text-muted hover:text-text-primary"
                                    }`}
                                  >
                                    {f}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                              {codesList
                                .filter((c) =>
                                  codesFilter === "all"
                                    ? true
                                    : codesFilter === "sold"
                                    ? c.status === "assigned"
                                    : c.status === "available"
                                )
                                .map((c) => (
                                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-1.5">
                                  <code className="min-w-0 truncate font-mono text-xs text-text-primary">{c.code}</code>
                                  {c.status === "assigned" && c.order ? (
                                    <span
                                      className="flex-none rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400"
                                      title={`Sold on order #${c.order.order_number}`}
                                    >
                                      Sold · #{c.order.order_number}
                                    </span>
                                  ) : (
                                    <span
                                      className={`flex-none rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                                        c.status === "available"
                                          ? "bg-instock/15 text-instock"
                                          : "bg-amber-500/15 text-amber-400"
                                      }`}
                                    >
                                      {c.status === "available" ? "Available" : c.status}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => deleteCode(c.id)}
                                    className="flex-none rounded-md p-1 text-text-muted hover:text-red-400"
                                    aria-label="Delete code"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {!isSubAdmin && <div className="grid gap-3 rounded-xl border border-border bg-bg p-4 sm:grid-cols-4">
                  <input value={vName} onChange={(e) => setVName(e.target.value)} placeholder="Variant name (e.g. 100 UC)" className={inputCls} />
                  <input value={vPrice} onChange={(e) => setVPrice(e.target.value)} type="number" min="0" step="0.01" placeholder={vPriceOnRequest ? "Price (kept as 0)" : "Price"} className={inputCls} />
                  <input value={vOrig} onChange={(e) => setVOrig(e.target.value)} type="number" min="0" step="0.01" placeholder="Old price (optional)" className={inputCls} />
                  <button
                    onClick={() => addVariant(p.id)}
                    disabled={!vName || (!vPrice && !vPriceOnRequest)}
                    className="rounded-xl bg-accent-oxblood px-3 py-2.5 text-sm font-semibold text-white transition duration-200 hover:bg-accent-oxblood/90 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Plus className="mr-1 inline h-4 w-4" /> Add Variant
                  </button>
                  <label className="flex items-center gap-2 text-sm text-text-muted sm:col-span-4">
                    <input type="checkbox" checked={vPriceOnRequest} onChange={(e) => setVPriceOnRequest(e.target.checked)} className="accent-accent-chrome" />
                    New variant is contact-for-price (hidden price, customer asks on WhatsApp)
                  </label>
                </div>}

                {!isSubAdmin && <div className="rounded-xl border border-border bg-bg p-4">
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-text-primary">
                    <KeyRound className="h-4 w-4 text-accent-chrome" /> Add codes for a variant
                  </label>
                  <textarea
                    value={codesInput}
                    onChange={(e) => setCodesInput(e.target.value)}
                    placeholder={"One code per line or comma separated.\n1234-5678-9012\nABCD-EFGH-IJKL"}
                    rows={3}
                    className={`${inputCls} font-mono`}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Click &quot;Add codes&quot; on the variant you want to stock.
                  </p>
                </div>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setModalOpen(false)}>
          <form
            onSubmit={saveProduct}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong clip-corner max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg border border-accent-chrome/20 p-6 shadow-2xl"
          >
            <h2 className="font-serif text-lg font-bold text-text-primary">{editing ? "Edit product" : "New product"}</h2>
            <div>
              <label className="mb-1.5 block text-sm text-text-muted">Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-text-muted">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-text-muted">Product image</label>
              {form.image_url && (
                <div className="mb-3 flex items-start justify-between gap-3">
                  <Image
                    src={form.image_url}
                    alt="Preview"
                    width={96}
                    height={64}
                    className="h-16 w-24 rounded-xl border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, image_url: "" })}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-muted hover:border-red-500/50 hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              )}
              <label
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm transition ${
                  uploading
                    ? "cursor-wait opacity-50"
                    : "border-border hover:border-accent-chrome/50 hover:text-accent-chrome"
                }`}
              >
                <UploadCloud className={`h-6 w-6 ${uploading ? "animate-pulse" : "text-accent-chrome"}`} />
                {uploading ? "Uploading…" : "Click to upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFile}
                  disabled={uploading}
                />
              </label>
              <p className="mt-1.5 text-xs text-text-muted">
                PNG, JPG, WebP, GIF or AVIF · max 5 MB or paste a URL below.
              </p>
              <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm text-text-muted">Region (recommendations)</label>
                <select value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })} className={inputCls}>
                  <option value="">Global</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="accent-accent-chrome" />
                Featured (Sale badge)
              </label>
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-accent-chrome" />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input type="checkbox" checked={form.sold_out} onChange={(e) => setForm({ ...form, sold_out: e.target.checked })} className="accent-red-500" />
                Sold out
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-muted hover:border-accent-chrome/50">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-xl bg-accent-oxblood px-5 py-2.5 text-sm font-bold text-white transition duration-200 hover:bg-accent-oxblood/90 active:scale-[0.98] disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save Changes" : "Create Product"}
              </button>
            </div>
          </form>
        </div>
      )}

      <AddCodesResultDialog
        result={addCodesResult}
        onClose={() => setAddCodesResult(null)}
      />
    </div>
  );
}
