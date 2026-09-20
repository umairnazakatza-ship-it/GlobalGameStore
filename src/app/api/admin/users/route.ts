import { requireAdmin, authError } from "@/lib/auth";
import { requireAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const admin = requireAdminClient();

    const { data: users } = await admin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    // Per-user credit history
    const { data: transactions } = await admin
      .from("credit_transactions")
      .select("*")
      .order("created_at", { ascending: false });

    return Response.json({ users, transactions });
  } catch (e) {
    return authError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const adminProfile = await requireAdmin();
    const body = await req.json();
    const userId = typeof body?.user_id === "string" ? body.user_id : "";
    const role = body?.role;

    if (!userId || !["user", "sub_admin"].includes(role)) {
      return Response.json({ error: "A valid user id and role are required" }, { status: 400 });
    }
    if (userId === adminProfile.id) {
      return Response.json({ error: "You cannot change your own role" }, { status: 400 });
    }

    const admin = requireAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", userId)
      .select("id, email, full_name, role")
      .single();
    if (error) throw error;
    return Response.json({ profile: data });
  } catch (e) {
    return authError(e);
  }
}
