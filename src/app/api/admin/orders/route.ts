import { requireAdmin, authError } from "@/lib/auth";
import { requireAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const admin = requireAdminClient();

    const { data: orders } = await admin
      .from("orders")
      .select(
        "*, items:order_items(*, codes:order_codes(product_name, variant_name, code)), delivered_codes:order_codes(product_name, variant_name, code), user:profiles(email, full_name)"
      )
      .order("created_at", { ascending: false });

    return Response.json({ orders });
  } catch (e) {
    return authError(e);
  }
}
