"use client";

import { useEffect, useState } from "react";
import { Plus, Minus, Loader2, Shield, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/order";
import type { CreditTransaction, Profile } from "@/lib/types";
import AdminSkeleton from "@/components/admin/AdminSkeleton";

type CreditMode = "add" | "remove";

export default function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [mode, setMode] = useState<CreditMode>("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const load = () => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users ?? []);
        setTransactions(d.transactions ?? []);
        setLoading(false);
      });
  };

  useEffect(load, []);

  const q = search.trim().toLowerCase();
  const filteredUsers = users.filter(
    (u) =>
      !q
      || u.email.toLowerCase().includes(q)
      || (u.full_name ?? "").toLowerCase().includes(q)
      || (u.phone ?? "").toLowerCase().includes(q)
  );

  const openPanel = (u: Profile, m: CreditMode) => {
    setSelected(u);
    setMode(m);
    setAmount("");
    setReason("");
  };

  const updateCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    const signed = mode === "remove" ? -Math.abs(Number(amount)) : Math.abs(Number(amount));
    const res = await fetch(`/api/admin/users/${selected.id}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: signed, reason }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error ?? "Failed");
      return;
    }
    setNotice(
      `${mode === "add" ? "Added" : "Deducted"} credits for ${selected.email} new balance ${formatPrice(
        Number(data.profile.credits_balance)
      )}`
    );
    setAmount("");
    setReason("");
    setSelected(null);
    setTimeout(() => setNotice(""), 4000);
    load();
  };

  const deleteUser = async (u: Profile) => {
    if (!window.confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    const data = await res.json();
    setBusy(false);
    setNotice(data.ok ? `Deleted ${u.email}` : data.error ?? "Failed to delete user");
    if (data.ok) setTimeout(() => setNotice(""), 4000);
    load();
  };

  const setRole = async (u: Profile, role: "user" | "sub_admin") => {
    setBusy(true);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: u.id, role }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error ?? "Could not update role");
      return;
    }
    setNotice(role === "sub_admin" ? `${u.email} is now a sub-admin` : `${u.email} is now a regular user`);
    setTimeout(() => setNotice(""), 4000);
    load();
  };

  if (loading) return <AdminSkeleton rows={5} />;

  return (
    <div className="space-y-6">
      {notice && (
        <p className="rounded-xl border border-instock/30 bg-instock/10 px-4 py-3 text-sm text-instock">
          {notice}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User list */}
        <div className="overflow-hidden rounded-lg border border-border bg-surface lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <p className="font-bold text-text-primary">
              {filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"}
              {q ? ` matching "${search}"` : ""}
            </p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              className="rounded-xl border border-border bg-bg px-4 py-2 text-sm text-text-primary transition focus:border-accent-chrome focus:outline-none focus:ring-2 focus:ring-accent-chrome/15"
            />
          </div>
          <div className="divide-y divide-border">
            {filteredUsers.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    {u.email}
                    {u.role === "admin" && (
                      <span className="flex items-center gap-1 rounded-full bg-accent-chrome/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-accent-chrome">
                        <Shield className="h-3 w-3" /> Admin
                      </span>
                    )}
                    {u.role === "sub_admin" && (
                      <span className="flex items-center gap-1 rounded-full bg-accent-chrome/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-accent-chrome">
                        <Shield className="h-3 w-3" /> Sub-admin
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-text-muted">
                    {u.full_name || "-"} · joined {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-instock">
                    {formatPrice(Number(u.credits_balance ?? 0))}
                  </span>
                  <button
                    onClick={() => openPanel(u, "add")}
                    className="flex items-center gap-1.5 rounded-lg bg-accent-oxblood px-3 py-1.5 text-xs font-bold text-white transition duration-200 hover:bg-accent-oxblood/90 active:scale-[0.97]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                  <button
                    onClick={() => openPanel(u, "remove")}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10"
                  >
                    <Minus className="h-3.5 w-3.5" /> Deduct
                  </button>
                  <button
                    onClick={() => setRole(u, u.role === "sub_admin" ? "user" : "sub_admin")}
                    disabled={busy || u.role === "admin"}
                    className="rounded-lg border border-accent-chrome/40 px-3 py-1.5 text-xs font-bold text-accent-chrome hover:bg-accent-chrome/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {u.role === "sub_admin" ? "Remove sub-admin" : "Make sub-admin"}
                  </button>
                  <button
                    onClick={() => deleteUser(u)}
                    disabled={busy}
                    title="Delete user"
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-text-muted hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add / deduct credits panel */}
        {selected && (
          <form onSubmit={updateCredits} className="h-fit rounded-lg border border-accent-chrome/40 bg-surface p-5">
            <p className="font-bold text-text-primary">
              {mode === "add" ? "Add credits to" : "Deduct credits from"}
            </p>
            <p className="mb-4 text-sm text-text-muted">{selected.email}</p>

            <div className="mb-4 flex rounded-xl border border-border p-1">
              {(["add", "remove"] as CreditMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                    mode === m
                      ? m === "add"
                        ? "bg-accent-oxblood text-white"
                        : "bg-red-500 text-white"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {m === "add" ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                  {m === "add" ? "Add" : "Deduct"}
                </button>
              ))}
            </div>

            <p className="mb-1 text-xs text-text-muted">Current balance</p>
            <p className="mb-4 font-mono text-2xl font-bold text-instock">
              {formatPrice(Number(selected.credits_balance ?? 0))}
            </p>
            <label className="mb-1.5 block text-sm text-text-muted">Amount (USDT)</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={mode === "add" ? "50.00" : "10.00"}
              className="mb-3 w-full rounded-xl border border-border bg-bg px-4 py-2.5 font-mono text-sm text-text-primary transition focus:border-accent-chrome focus:outline-none focus:ring-2 focus:ring-accent-chrome/15"
            />
            <label className="mb-1.5 block text-sm text-text-muted">Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={mode === "add" ? "e.g. Bank transfer received" : "e.g. Refund / correction"}
              className="mb-4 w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text-primary transition focus:border-accent-chrome focus:outline-none focus:ring-2 focus:ring-accent-chrome/15"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || !amount}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition duration-200 active:scale-[0.98] disabled:opacity-60 ${
                  mode === "add"
                    ? "bg-accent-oxblood hover:bg-accent-oxblood/90"
                    : "bg-red-600 hover:bg-red-500"
                }`}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "add" ? "Add Credits" : "Deduct Credits"}
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted hover:border-accent-chrome/50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Recent transactions */}
        <div className="overflow-hidden rounded-lg border border-border bg-surface lg:col-span-3">
          <div className="border-b border-border px-5 py-4">
            <p className="font-bold text-text-primary">Recent credit movements</p>
          </div>
          {transactions.length === 0 ? (
            <p className="p-8 text-center text-sm text-text-muted">No movements yet.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {transactions.slice(0, 50).map((t) => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm text-text-primary">
                      {t.reason || "Movement"}
                      <span className="ml-2 text-xs text-text-muted">
                        {users.find((u) => u.id === t.user_id)?.email ?? t.user_id.slice(0, 8)}
                      </span>
                    </p>
                    <p className="text-xs text-text-muted">{new Date(t.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`font-mono font-bold ${Number(t.amount) >= 0 ? "text-instock" : "text-red-400"}`}>
                    {Number(t.amount) >= 0 ? "+" : ""}
                    {formatPrice(Number(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
