import { requireProfile, authError } from "@/lib/auth";
import { requireAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ratelimit";

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

export async function DELETE(req: Request) {
  try {
    const profile = await requireProfile();
    const body = await req.json().catch(() => null);
    const orderIds = Array.isArray(body?.orderIds)
      ? [...new Set(body.orderIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0))]
      : [];

    if (orderIds.length === 0 || orderIds.length > 50) {
      return Response.json({ error: "Select between 1 and 50 orders" }, { status: 400 });
    }

    const rl = await rateLimit(`delete-orders:${profile.id}`, 10, 3600);
    if (!rl.allowed) {
      return Response.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const admin = requireAdminClient();
    const { data: ownedOrders, error: lookupError } = await admin
      .from("orders")
      .select("id")
      .eq("user_id", profile.id)
      .in("id", orderIds);

    if (lookupError) throw lookupError;
    if ((ownedOrders?.length ?? 0) !== orderIds.length) {
      return Response.json({ error: "One or more selected orders could not be found" }, { status: 404 });
    }

    const ownedIds = ownedOrders!.map((order) => order.id);
    const { error: codesError } = await admin
      .from("order_codes")
      .delete()
      .in("order_id", ownedIds);
    if (codesError) throw codesError;

    const { error: itemsError } = await admin
      .from("order_items")
      .delete()
      .in("order_id", ownedIds);
    if (itemsError) throw itemsError;

    const { error: ordersError } = await admin
      .from("orders")
      .delete()
      .eq("user_id", profile.id)
      .in("id", ownedIds);
    if (ordersError) throw ordersError;

    return Response.json({ ok: true, deleted: ownedIds.length });
  } catch (e) {
    console.error("account orders delete error:", e);
    return authError(e);
  }
}
