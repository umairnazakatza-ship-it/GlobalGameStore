import { createClient } from "./supabase/server";
import type { Profile } from "./types";

/** Returns the signed-in profile or null. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile) ?? null;
}

/** Returns the profile or throws for unauthenticated access. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("UNAUTHENTICATED");
  return profile;
}

/** Returns the admin profile or throws. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") throw new Error("FORBIDDEN");
  return profile;
}

export async function requireCatalogManager(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "sub_admin") {
    throw new Error("FORBIDDEN");
  }
  return profile;
}

export function authError(e: unknown) {
  if (e instanceof Error && e.message === "UNAUTHENTICATED") {
    return Response.json({ error: "Please log in" }, { status: 401 });
  }
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return Response.json({ error: "Admins only" }, { status: 403 });
  }
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}
