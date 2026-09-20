import { requireAdmin, requireCatalogManager, authError } from "@/lib/auth";
import { requireAdminClient } from "@/lib/supabase/admin";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, ctx: RouteContext) {
  try {
    const profile = await requireCatalogManager();
    const { id } = await ctx.params;
    const admin = requireAdminClient();
    const body = await req.json();

    const allowed: Record<string, unknown> = {};
    const allowedKeys =
      profile.role === "sub_admin"
        ? ["price", "original_price"]
        : ["name", "price", "original_price", "active", "sold_out", "price_on_request"];
    for (const key of allowedKeys) {
      if (key in body) allowed[key] = body[key];
    }
    if (Object.keys(allowed).length === 0) {
      return Response.json({ error: "Only variant prices can be changed" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("product_variants")
      .update(allowed)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    revalidateTag("catalog", { expire: 0 });
    return Response.json({ variant: data });
  } catch (e) {
    return authError(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const admin = requireAdminClient();
    await admin.from("product_variants").delete().eq("id", id);
    revalidateTag("catalog", { expire: 0 });
    return Response.json({ ok: true });
  } catch (e) {
    return authError(e);
  }
}