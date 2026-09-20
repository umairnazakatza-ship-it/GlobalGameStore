"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Wallet,
  User,
  LogOut,
  Loader2,
  Copy,
  CheckCircle2,
  CreditCard,
  CalendarDays,
  Mail,
  ShieldAlert,
  Lock,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { formatPrice } from "@/lib/order";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { CreditTransaction, Order, Profile } from "@/lib/types";
import TiltCard from "@/components/TiltCard";
import EmptyState from "@/components/EmptyState";
import OrderTimeline from "@/components/OrderTimeline";

type Tab = "overview" | "orders" | "credits" | "profile";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  paid: "bg-accent-chrome/15 text-accent-chrome",
  completed: "bg-instock/15 text-instock",
  cancelled: "bg-red-500/15 text-red-400",
};

const inputCls =
  "w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text-primary transition focus:border-accent-chrome focus:outline-none focus:ring-2 focus:ring-accent-chrome/15";

function initials(name: string | null | undefined, email: string | null | undefined) {
  const src = (name && name.trim()) || (email ?? "");
  const parts = src.split(/\s+|@/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function memberSince(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function AccountPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  const [form, setForm] = useState({ full_name: "", phone: "", whatsapp: "", country: "" });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pw, setPw] = useState({ currentPassword: "", password: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteMsg, setDeleteMsg] = useState("");

  const [copied, setCopied] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [removingOrders, setRemovingOrders] = useState(false);
  const [ordersMessage, setOrdersMessage] = useState("");

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me").then((r) => r.json());
      if (!me.profile) {
        setNotAuthed(true);
        setLoading(false);
        return;
      }
      setProfile(me.profile);
      setForm({
        full_name: me.profile.full_name ?? "",
        phone: me.profile.phone ?? "",
        whatsapp: me.profile.whatsapp ?? "",
        country: me.profile.country ?? "",
      });
      const [o, t] = await Promise.all([
        fetch("/api/account/orders").then((r) => r.json()),
        fetch("/api/account/transactions").then((r) => r.json()),
      ]);
      setOrders(o.orders ?? []);
      setTransactions(t.transactions ?? []);
      setLoading(false);
    })();
  }, []);

  if (notAuthed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-serif text-2xl font-bold text-text-primary">Please log in</h1>
        <p className="mt-2 text-text-muted">You need an account to view your panel.</p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-xl bg-accent-oxblood px-6 py-3 font-semibold text-white hover:bg-accent-oxblood/90"
        >
          Log In
        </Link>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/account/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.profile) {
      setProfile((p) => (p ? { ...p, ...data.profile } : p));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Delete your account permanently? This cannot be undone.")) return;
    const res = await fetch("/api/account/delete", { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      router.push("/");
      router.refresh();
    } else {
      setDeleteMsg(data.error ?? "Could not delete account");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSaving(true);
    setPwMsg(null);
    const res = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pw),
    });
    const data = await res.json();
    if (data.ok) {
      setPw({ currentPassword: "", password: "", confirm: "" });
      setPwMsg({ ok: true, text: "Password updated!" });
    } else {
      setPwMsg({ ok: false, text: data.error ?? "Could not update password" });
    }
    setPwSaving(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId]
    );
  };

  const toggleAllOrders = () => {
    setSelectedOrderIds((current) =>
      current.length === orders.length ? [] : orders.map((order) => order.id)
    );
  };

  const removeSelectedOrders = async () => {
    if (selectedOrderIds.length === 0) return;
    if (
      !window.confirm(
        `Remove ${selectedOrderIds.length} selected order${selectedOrderIds.length === 1 ? "" : "s"} from your history? This cannot be undone.`
      )
    ) {
      return;
    }

    setRemovingOrders(true);
    setOrdersMessage("");
    const res = await fetch("/api/account/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: selectedOrderIds }),
    });
    const data = await res.json();
    if (res.ok) {
      setOrders((current) => current.filter((order) => !selectedOrderIds.includes(order.id)));
      setSelectedOrderIds([]);
      setOrdersMessage("Selected orders removed from your history.");
    } else {
      setOrdersMessage(data.error ?? "Could not remove selected orders");
    }
    setRemovingOrders(false);
  };

  const tabs: { id: Tab; label: string; icon: typeof Package }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "orders", label: "Orders", icon: Package },
    { id: "credits", label: "Credits", icon: Wallet },
    { id: "profile", label: "Profile", icon: User },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-chrome" />
      </div>
    );
  }

  const completedOrders = orders.filter((o) => o.status === "completed").length;
  const firstName = profile?.full_name?.split(" ")[0];
  const avatar = initials(profile?.full_name, profile?.email);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* -------- Profile header (subtle 3D) -------- */}
      <TiltCard intensity={3} scale={1.01} glare={false} className="mb-8">
        <div className="glass clip-corner flex flex-wrap items-center gap-6 rounded-lg border border-border p-6 sm:p-8">
          <div className="flex flex-none items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-chrome font-mono text-xl font-bold text-bg shadow-lg shadow-accent-chrome/20">
              {avatar}
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-bold text-text-primary sm:text-3xl">
                {firstName ? `Hi, ${firstName}` : "My Account"}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {profile?.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Member since {memberSince(profile?.created_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-instock/30 bg-instock/10 px-5 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-instock/80">Store Credits</p>
              <p className="font-mono text-xl font-bold text-instock">
                {formatPrice(Number(profile?.credits_balance ?? 0))}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl border border-red-500/60 bg-red-500/15 px-4 py-3 text-sm font-bold text-red-400 shadow-sm shadow-red-500/20 transition duration-200 hover:border-red-500 hover:bg-red-500 hover:text-white hover:shadow-red-500/40 active:scale-[0.97]"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </TiltCard>

      {/* -------- Tabs -------- */}
      <div className="mb-8 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-accent-chrome text-bg"
                : "border border-border text-text-muted hover:border-accent-chrome/50 hover:text-text-primary"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------------- Overview ---------------- */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <TiltCard intensity={3} scale={1.01} glare={false}>
              <div className="rounded-lg border border-border bg-surface p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text-muted">Available credits</p>
                  <CreditCard className="h-5 w-5 text-accent-chrome" />
                </div>
                <p className="mt-3 font-mono text-3xl font-bold text-instock">
                  {formatPrice(Number(profile?.credits_balance ?? 0))}
                </p>
                <p className="mt-1 text-xs text-text-muted">Codes are emailed after you pay with credits.</p>
              </div>
            </TiltCard>
            <TiltCard intensity={3} scale={1.01} glare={false}>
              <div className="rounded-lg border border-border bg-surface p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text-muted">Total orders</p>
                  <Package className="h-5 w-5 text-accent-chrome" />
                </div>
                <p className="mt-3 font-mono text-3xl font-bold text-text-primary">{orders.length}</p>
                <p className="mt-1 text-xs text-text-muted">{completedOrders} completed</p>
              </div>
            </TiltCard>
          </div>

          <div className="rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-bold text-text-primary">Recent orders</h2>
              {orders.length > 0 && (
                <button
                  onClick={() => setTab("orders")}
                  className="flex items-center gap-1 text-xs font-semibold text-accent-chrome transition hover:gap-1.5"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
            {orders.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No orders yet"
                description="Your past orders will appear here. Codes are delivered instantly after payment."
                action={{ href: "/shop", label: "Start shopping" }}
              />
            ) : (
              <ul className="divide-y divide-border">
                {orders.slice(0, 4).map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <div>
                      <p className="font-mono font-semibold text-text-primary">#{o.order_number}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {new Date(o.created_at).toLocaleDateString()} · {o.items?.length ?? 0} item(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-price">{formatPrice(o.total)}</span>
                      <span
                        className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${STATUS_COLORS[o.status]}`}
                      >
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ---------------- Orders ---------------- */}
      {tab === "orders" && (
        <div className="space-y-4">
          {orders.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={selectedOrderIds.length === orders.length}
                  onChange={toggleAllOrders}
                  className="h-4 w-4 accent-accent-chrome"
                />
                Select all orders
              </label>
              <div className="flex items-center gap-3">
                {ordersMessage && <span className="text-sm text-text-muted">{ordersMessage}</span>}
                <button
                  type="button"
                  onClick={removeSelectedOrders}
                  disabled={selectedOrderIds.length === 0 || removingOrders}
                  className="flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-bold text-red-300 transition hover:border-red-500 hover:bg-red-500 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {removingOrders ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Remove selected{selectedOrderIds.length > 0 ? ` (${selectedOrderIds.length})` : ""}
                </button>
              </div>
            </div>
          )}
          {orders.length === 0 && (
            <EmptyState
              icon={Package}
              title="No orders yet"
              description="When you check out, your order history and delivered codes will live here."
              action={{ href: "/shop", label: "Start shopping" }}
            />
          )}
          {orders.map((o) => (
            <div key={o.id} className="rounded-lg border border-border bg-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.includes(o.id)}
                    onChange={() => toggleOrderSelection(o.id)}
                    aria-label={`Select order ${o.order_number}`}
                    className="mt-1 h-4 w-4 accent-accent-chrome"
                  />
                  <div>
                    <p className="font-mono font-bold text-text-primary">
                      #{o.order_number}
                      <span className="ml-3 font-mono text-sm font-normal text-text-muted">
                        {new Date(o.created_at).toLocaleString()}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      {o.payment_method === "credits" ? "Paid with credits" : "WhatsApp order"} ·{" "}
                      <span className="font-mono text-price">{formatPrice(o.total)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${STATUS_COLORS[o.status]}`}>
                    {ORDER_STATUS_LABELS[o.status]}
                  </span>
                  {o.whatsapp_link && o.status !== "completed" && (
                    <a
                      href={o.whatsapp_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-instock px-3 py-1.5 text-xs font-bold text-white hover:bg-instock/90"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>

              <OrderTimeline status={o.status} createdAt={o.created_at} />

              {(o.items?.length ?? 0) > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="font-mono text-left text-xs uppercase tracking-wider text-text-muted">
                        <th className="pb-2">Item</th>
                        <th className="pb-2">Qty</th>
                        <th className="pb-2">Price</th>
                        <th className="pb-2">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {o.items!.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2.5 text-text-primary">{it.product_name}</td>
                          <td className="py-2.5 text-text-muted">{it.variant_name} × {it.quantity}</td>
                          <td className="py-2.5 font-mono text-text-muted">{formatPrice(it.unit_price)}</td>
                          <td className="py-2.5 font-mono font-semibold text-text-primary">{formatPrice(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(o.delivered_codes?.length ?? 0) > 0 && (
                <div className="mt-4 rounded-xl border border-instock/20 bg-instock/5 p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-bold text-instock">
                    <CheckCircle2 className="h-4 w-4" /> Delivered codes
                  </p>
                  <div className="space-y-2">
                    {o.delivered_codes!.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-text-muted">
                          {c.product_name} {c.variant_name}
                        </span>
                        <span className="flex items-center gap-2">
                          <code className="rounded-lg bg-bg px-3 py-1 font-mono text-sm text-accent-chrome">
                            {c.code}
                          </code>
                          <button
                            onClick={() => copyCode(c.code)}
                            className="rounded-lg p-1.5 text-text-muted hover:bg-surface hover:text-text-primary"
                            aria-label="Copy code"
                          >
                            {copied === c.code ? (
                              <CheckCircle2 className="h-4 w-4 text-instock" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Credits ---------------- */}
      {tab === "credits" && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-6 py-4">
            <p className="font-bold text-text-primary">Credit history</p>
            <p className="text-sm text-text-muted">
              Balance:{" "}
              <span className="font-mono font-semibold text-instock">
                {formatPrice(Number(profile?.credits_balance ?? 0))}
              </span>
            </p>
          </div>
          {transactions.length === 0 ? (
            <p className="p-10 text-center text-text-muted">No credit movements yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{t.reason || "Credit movement"}</p>
                    <p className="font-mono text-xs text-text-muted">
                      {new Date(t.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-bold ${Number(t.amount) >= 0 ? "text-instock" : "text-red-400"}`}
                  >
                    {Number(t.amount) >= 0 ? "+" : ""}
                    {formatPrice(Number(t.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ---------------- Profile ---------------- */}
      {tab === "profile" && (
        <div className="mx-auto max-w-2xl space-y-6">
          <Section title="Personal information" subtitle="How you appear on orders and receipts.">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <Field label="Full name">
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone">
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="WhatsApp">
                  <input
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Country">
                <input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-accent-oxblood px-6 py-2.5 font-semibold text-white transition duration-200 hover:bg-accent-oxblood/90 active:scale-[0.98] disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </button>
                {saved && <span className="text-sm text-instock">Saved.</span>}
              </div>
            </form>
          </Section>

          <Section title="Security" subtitle="Update the password you use to sign in." icon={Lock}>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <Field label="Current password">
                <input
                  type="password"
                  value={pw.currentPassword}
                  onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password">
                  <input
                    type="password"
                    value={pw.password}
                    onChange={(e) => setPw({ ...pw, password: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Confirm new password">
                  <input
                    type="password"
                    value={pw.confirm}
                    onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="flex items-center gap-2 rounded-xl bg-accent-oxblood px-6 py-2.5 font-semibold text-white transition duration-200 hover:bg-accent-oxblood/90 active:scale-[0.98] disabled:opacity-60"
                >
                  {pwSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Update Password
                </button>
                {pwMsg && (
                  <span className={`text-sm ${pwMsg.ok ? "text-instock" : "text-red-400"}`}>{pwMsg.text}</span>
                )}
              </div>
            </form>
          </Section>

          <Section
            title="Delete account"
            subtitle="Permanently delete your account and personal data. This cannot be undone."
            tone="danger"
            icon={Trash2}
          >
            {deleteMsg && <p className="mb-3 text-sm text-red-400">{deleteMsg}</p>}
            <button
              onClick={handleDeleteAccount}
              className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-sm font-bold text-red-300 transition hover:border-red-500 hover:bg-red-500 hover:text-white active:scale-[0.97]"
            >
              <ShieldAlert className="h-4 w-4" /> Delete my account
            </button>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  tone = "default",
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
  icon?: typeof Lock;
}) {
  const isDanger = tone === "danger";
  return (
    <section
      className={`rounded-lg border bg-surface p-6 ${
        isDanger ? "border-red-500/25" : "border-border"
      }`}
    >
      <div className="mb-4 flex items-start gap-3">
        {Icon && (
          <div
            className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${
              isDanger ? "bg-red-500/15 text-red-400" : "bg-accent-chrome/15 text-accent-chrome"
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className={`font-bold ${isDanger ? "text-red-300" : "text-text-primary"}`}>{title}</h2>
          {subtitle && (
            <p className={`mt-0.5 text-sm ${isDanger ? "text-red-400/70" : "text-text-muted"}`}>{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">{label}</label>
      {children}
    </div>
  );
}
