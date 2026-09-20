import { requireProfile, authError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await requireProfile();
    const supabase = await createClient();

    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        "*, items:order_items(*, codes:order_codes(*)), delivered_codes:order_codes(product_name, variant_name, code)"
      )
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Response.json({ orders });
  } catch (e) {
    return authError(e);
  }
}
