import { requireAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateOrderNumber, buildWhatsAppLink, buildWhatsAppOrderMessage } from "@/lib/order";
import { sendOrderCodesEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import type { CartItem } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CheckoutBody {
  items: { variantId: string; quantity: number }[];
  paymentMethod: "credits" | "whatsapp";
  customer: { name: string; email: string; whatsapp: string; country?: string };
  idempotencyKey?: string;
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit(`checkout:${ip}`, 20, 3600);
  if (!rl.allowed) {
    return Response.json(
      { error: "Too many checkout attempts. Please try again later." },
      { status: 429 }
    );
  }

  const body: CheckoutBody = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: "Cart is empty" }, { status: 400 });
  }
  const method = body.paymentMethod === "credits" ? "credits" : "whatsapp";
  const c = body.customer ?? {};

  const admin = requireAdminClient();

  // ---- Validate variants & compute total ----
  const variantIds = body.items.map((i) => i.variantId);
  const { data: variants, error: vErr } = await admin
    .from("product_variants")
    .select("*, product:products(id, name, slug, image_url, active, sold_out)")
    .in("id", variantIds)
    .eq("active", true);

  if (vErr || !variants || variants.length !== variantIds.length) {
    return Response.json({ error: "One or more items are no longer available" }, { status: 400 });
  }

  const soldOut = (variants as unknown as { product: { sold_out?: boolean } }[]).some(
    (v) => v.product?.sold_out
  );
  if (soldOut) {
    return Response.json(
      { error: "One or more items are sold out and cannot be ordered" },
      { status: 400 }
    );
  }

  const variantSoldOut = (variants as unknown as { sold_out?: boolean }[]).some(
    (v) => v.sold_out
  );
  if (variantSoldOut) {
    return Response.json(
      { error: "One or more items are sold out and cannot be ordered" },
      { status: 400 }
    );
  }

  const priceOnRequest = (variants as unknown as { price_on_request?: boolean }[]).some(
    (v) => v.price_on_request
  );
  if (priceOnRequest) {
    return Response.json(
      { error: "One or more items require a price quote on WhatsApp and cannot be ordered directly" },
      { status: 400 }
    );
  }

  const requestedByVariant = new Map<string, number>();
  for (const item of body.items) {
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity))));
    requestedByVariant.set(
      item.variantId,
      (requestedByVariant.get(item.variantId) ?? 0) + quantity
    );
  }
  const { data: availableCodes, error: stockError } = await admin
    .from("codes")
    .select("variant_id")
    .in("variant_id", variantIds)
    .eq("status", "available");
  if (stockError) {
    console.error("checkout stock lookup error:", stockError);
    return Response.json({ error: "Could not verify item availability" }, { status: 500 });
  }

  const availableByVariant = new Map<string, number>();
  for (const code of availableCodes ?? []) {
    availableByVariant.set(
      code.variant_id,
      (availableByVariant.get(code.variant_id) ?? 0) + 1
    );
  }
  for (const [variantId, requested] of requestedByVariant) {
    const available = availableByVariant.get(variantId) ?? 0;
    if (available > 0 && requested > available) {
      return Response.json(
        { error: `Only ${available} code${available === 1 ? "" : "s"} available for one or more selected items` },
        { status: 400 }
      );
    }
  }

  const items: CartItem[] = body.items.map((raw) => {
    const v = variants.find((x) => x.id === raw.variantId)!;
    const product = (v as unknown as {
      product: { id: string; name: string; slug: string; image_url: string | null };
    }).product;
    return {
      variantId: v.id,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      productImage: product.image_url,
      variantName: v.name,
      unitPrice: Number(v.price),
      quantity: Math.max(1, Math.min(99, Math.floor(Number(raw.quantity)))),
    };
  });

  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  // ---- Order number (unique-ish) ----
  let orderNumber = generateOrderNumber();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await admin
      .from("orders")
      .select("id")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (!existing) break;
    orderNumber = generateOrderNumber();
  }

  // ================= WHATSAPP ORDER =================
  if (method === "whatsapp") {
    const { data: settings } = await admin
      .from("settings")
      .select("value")
      .eq("key", "whatsapp_number")
      .maybeSingle();
    // The deployment environment is the source of truth for checkout links.
    // Keep the database value as a fallback for older deployments without the env var.
    const storePhone =
      process.env.WHATSAPP_NUMBER || (settings?.value as string) || "15551234567";

    const message = buildWhatsAppOrderMessage({
      orderNumber,
      items,
      total,
      customerName: c.name || "Guest",
      customerEmail: c.email || "",
      customerWhatsapp: c.whatsapp || "",
      country: c.country,
    });
    const whatsappLink = buildWhatsAppLink(storePhone, message);

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_name: c.name || null,
        customer_email: c.email || null,
        customer_whatsapp: c.whatsapp || null,
        country: c.country || null,
        total,
        payment_method: "whatsapp",
        status: "pending",
        whatsapp_link: whatsappLink,
      })
      .select()
      .single();

    if (orderErr || !order) {
      console.error("checkout whatsapp order error:", orderErr);
      return Response.json({ error: "Could not create order" }, { status: 500 });
    }

    await admin.from("order_items").insert(
      items.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        product_name: i.productName,
        variant_id: i.variantId,
        variant_name: i.variantName,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        total: i.unitPrice * i.quantity,
      }))
    );

    return Response.json({
      ok: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        payment_method: "whatsapp",
        status: order.status,
        whatsapp_link: whatsappLink,
      },
    });
  }

  // ================= CREDITS ORDER (atomic) =================
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Please log in to pay with credits" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const balance = Number(profile?.credits_balance ?? 0);
  if (balance < total) {
    return Response.json(
      { error: `Insufficient credits. Balance: ${balance.toFixed(2)} USDT, total: ${total.toFixed(2)} USDT` },
      { status: 400 }
    );
  }

  // Idempotency key: client-generated so retries reuse the same key.
  const idempotencyKey = body.idempotencyKey ?? `credits:${user.id}:${orderNumber}`;

  const itemsPayload = items.map((i) => ({
    product_id: i.productId,
    product_name: i.productName,
    variant_id: i.variantId,
    variant_name: i.variantName,
    quantity: i.quantity,
    unit_price: i.unitPrice,
  }));

  const { data: result, error: rpcErr } = await admin.rpc("place_credits_order", {
    p_user_id: user.id,
    p_order_number: orderNumber,
    p_customer_name: c.name || profile?.full_name || null,
    p_customer_email: c.email || user.email || null,
    p_customer_whatsapp: c.whatsapp || null,
    p_country: c.country || null,
    p_idempotency_key: idempotencyKey,
    p_items: itemsPayload,
    p_total: total,
  });

  if (rpcErr) {
    const msg = String(rpcErr.message ?? "Could not complete order");
    console.error("checkout rpc error:", rpcErr);
    if (/not enough stock/i.test(msg)) {
      return Response.json({ error: msg }, { status: 400 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }

  if (!result?.ok) {
    if (result?.duplicate) {
      // Already placed under this key: treat as success and return the existing order.
      return Response.json({ ok: true, order: { id: result.order_id, duplicate: true } });
    }
    return Response.json({ error: result?.error ?? "Could not complete order" }, { status: 400 });
  }

  const orderId = result.order_id as string;

  // ---- Load delivered codes for the email ----
  const { data: oc } = await admin
    .from("order_codes")
    .select("product_name, variant_name, code")
    .eq("order_id", orderId);

  const grouped = new Map<string, { productName: string; variantName: string; codes: string[] }>();
  for (const row of oc ?? []) {
    const k = `${row.product_name}|${row.variant_name}`;
    if (!grouped.has(k)) {
      grouped.set(k, {
        productName: row.product_name,
        variantName: row.variant_name,
        codes: [],
      });
    }
    grouped.get(k)!.codes.push(row.code);
  }
  const lines = [...grouped.values()].map((g) => ({ ...g, quantity: g.codes.length }));
  const delivered = (oc ?? []).length;
  const allDelivered = lines.length > 0 && lines.every((l) => l.codes.length > 0);

  if (allDelivered) {
    await admin.from("orders").update({ status: "completed" }).eq("id", orderId);
  }

  // ---- Email codes ----
  // Recipient is ALWAYS the account email the form's email field is
  // ignored for credits orders so codes can't be redirected elsewhere.
  let emailSent = false;
  if (user.email) {
    try {
      const res = await sendOrderCodesEmail({
        to: user.email,
        customerName: profile?.full_name || c.name || "",
        orderNumber,
        total,
        lines,
      });
      emailSent = res.sent;
    } catch (e) {
      console.error("email send failed:", e);
    }
  }

  return Response.json({
    ok: true,
    order: {
      id: orderId,
      order_number: orderNumber,
      payment_method: "credits",
      status: allDelivered ? "completed" : "paid",
      codes_delivered: delivered,
      email_sent: emailSent,
    },
  });
}
