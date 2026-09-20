"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  ShieldAlert,
  Loader2,
  LogOut,
  ShoppingBag,
} from "lucide-react";
import type { Profile } from "@/lib/types";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminProducts from "@/components/admin/AdminProducts";
import AdminOrders from "@/components/admin/AdminOrders";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminSoldCodes from "@/components/admin/AdminSoldCodes";

type Tab = "dashboard" | "products" | "orders" | "sold" | "users" | "settings";

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const nextProfile = d.profile ?? null;
        setProfile(nextProfile);
        if (nextProfile?.role === "sub_admin") setTab("products");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-chrome" />
      </div>
    );
  }

  if (!profile || (profile.role !== "admin" && profile.role !== "sub_admin")) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <ShieldAlert className="mx-auto h-16 w-16 text-red-400" />
        <h1 className="mt-4 font-serif text-2xl font-bold text-text-primary">Admins only</h1>
        <p className="mt-2 text-text-muted">
          This area is restricted. Ask the store admin to promote your account.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-accent-oxblood px-6 py-3 font-semibold text-white hover:bg-accent-oxblood/90"
        >
          Go Home
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Package }[] =
    profile.role === "sub_admin"
      ? [{ id: "products", label: "Products & Prices", icon: Package }]
      : [
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "products", label: "Products", icon: Package },
          { id: "orders", label: "Orders", icon: ShoppingCart },
          { id: "sold", label: "Sold Codes", icon: ShoppingBag },
          { id: "users", label: "Users & Credits", icon: Users },
          { id: "settings", label: "Settings", icon: Settings },
        ];

  const adminName = profile?.full_name?.split(" ")[0] || profile?.email?.split("@")[0] || "Admin";
  const adminInitial = (profile?.full_name?.[0] || profile?.email?.[0] || "A").toUpperCase();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-chrome font-mono text-lg font-bold text-bg shadow-lg shadow-accent-chrome/20">
            {adminInitial}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-3xl font-bold text-text-primary">Admin Panel</h1>
              <span className="rounded-full border border-accent-chrome/40 bg-accent-chrome/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-accent-chrome">
                {profile.role === "sub_admin" ? "Sub-admin" : "Admin"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-text-muted">
              {adminName} · {profile?.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl border border-red-500/60 bg-red-500/15 px-4 py-2.5 text-sm font-bold text-red-400 shadow-sm shadow-red-500/20 transition duration-200 hover:border-red-500 hover:bg-red-500 hover:text-white hover:shadow-red-500/40 active:scale-[0.97]"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-accent-chrome text-bg"
                : "border border-border text-text-muted hover:border-accent-chrome/50"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <AdminDashboard />}
      {tab === "products" && <AdminProducts isSubAdmin={profile.role === "sub_admin"} />}
      {tab === "orders" && <AdminOrders />}
      {tab === "sold" && <AdminSoldCodes />}
      {tab === "users" && <AdminUsers />}
      {tab === "settings" && <AdminSettings />}
    </div>
  );
}
