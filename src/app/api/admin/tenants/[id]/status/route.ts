import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requirePlatformAdmin();
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Managing tenants needs SUPABASE_SERVICE_ROLE_KEY configured on the server." },
      { status: 501 },
    );
  }

  const { id } = await params;
  const { status } = await request.json();
  if (status !== "active" && status !== "suspended") {
    return NextResponse.json({ error: "status must be 'active' or 'suspended'" }, { status: 400 });
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: tenant, error } = await admin
    .from("tenants")
    .update({ status, suspended_at: status === "suspended" ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id, name")
    .single();

  if (error || !tenant) {
    return NextResponse.json({ error: error?.message ?? "Tenant not found" }, { status: 404 });
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    action: status === "suspended" ? "TENANT_SUSPENDED" : "TENANT_REACTIVATED",
    entityType: "tenant",
    entityId: tenant.id,
    metadata: { name: tenant.name },
  });

  return NextResponse.json({ success: true });
}
