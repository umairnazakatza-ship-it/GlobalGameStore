import { requireAdmin, requireCatalogManager, authError } from "@/lib/auth";
import { requireAdminClient } from "@/lib/supabase/admin";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCatalogManager();
    const admin = requireAdminClient();

    const [
      { data: products },
      { data: categories },
      { data: regions },
      { data: codes },
    ] = await Promise.all([
      admin
        .from("products")
        .select(
          "*, category:categories(name), region:regions(code, name), variants:product_variants(*)"
        )
        .order("created_at", { ascending: false }),
      admin.from("categories").select("*").order("sort_order"),
      admin.from("regions").select("*").order("sort_order"),
      admin.from("codes").select("variant_id").eq("status", "available"),
    ]);

    const available_codes: Record<string, number> = {};
    for (const row of codes ?? []) {
      available_codes[row.variant_id] = (available_codes[row.variant_id] ?? 0) + 1;
    }

    return Response.json({ products, categories, regions, available_codes });
  } catch (e) {
    return authError(e);
  }
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

interface CreateBody {
  name: string;
  description?: string;
  image_url?: string;
  category_id?: string | null;
  region_id?: string | null;
  featured?: boolean;
  active?: boolean;
  sold_out?: boolean;
  variants?: { name: string; price: number; original_price?: number | null; codes?: string[] }[];
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const admin = requireAdminClient();
    const body: CreateBody = await req.json();

    if (!body.name?.trim()) {
      return Response.json({ error: "Product name is required" }, { status: 400 });
    }

    let slug = slugify(body.name);
    const { data: existing } = await admin
      .from("products")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const { data: product, error } = await admin
      .from("products")
      .insert({
        name: body.name.trim(),
        slug,
        description: body.description ?? null,
        image_url: body.image_url ?? null,
        category_id: body.category_id || null,
        region_id: body.region_id || null,
        featured: !!body.featured,
        active: body.active ?? true,
        sold_out: !!body.sold_out,
      })
      .select()
      .single();

    if (error || !product) {
      console.error("create product error:", error);
      return Response.json(
        { error: `Could not create product: ${error?.message ?? "unknown"}` },
        { status: 500 }
      );
    }

    if (Array.isArray(body.variants)) {
      for (const v of body.variants) {
        if (!v.name || !v.price) continue;
        const { data: variant } = await admin
          .from("product_variants")
          .insert({
            product_id: product.id,
            name: v.name,
            price: v.price,
            original_price: v.original_price ?? null,
          })
          .select()
          .single();
        const codes = (v.codes ?? [])
          .map((c) => c.trim())
          .filter(Boolean)
          .map((code) => ({ variant_id: variant!.id, code }));
        if (codes.length > 0) await admin.from("codes").insert(codes);
      }
    }

    revalidateTag("catalog", { expire: 0 });
    return Response.json({ product });
  } catch (e) {
    return authError(e);
  }
}
