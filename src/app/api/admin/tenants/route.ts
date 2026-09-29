import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/require-role";
import { inviteUser } from "@/lib/auth/invite-user";
import { logAudit } from "@/lib/audit";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  const check = await requirePlatformAdmin();
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Creating tenants needs SUPABASE_SERVICE_ROLE_KEY configured on the server." },
      { status: 501 },
    );
  }

  const { name, adminName, adminEmail } = await request.json();
  if (!name?.trim() || !adminName?.trim() || !adminEmail?.trim()) {
    return NextResponse.json(
      { error: "Company name, tenant admin name, and tenant admin email are required" },
      { status: 400 },
    );
  }

  const slug = slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "That company name doesn't produce a usable slug" }, { status: 400 });
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  // tenants has RLS-enabled-with-zero-policies for INSERT (platform admins
  // can only SELECT it) -- this write must go through the service-role
  // client, same as the invite below.
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({ name: name.trim(), slug })
    .select("id, name, slug")
    .single();

  if (tenantError || !tenant) {
    const message = tenantError?.code === "23505" ? "A tenant with a similar name already exists" : tenantError?.message;
    return NextResponse.json({ error: message ?? "Failed to create tenant" }, { status: 400 });
  }

  const h = await headers();
  const { error: inviteError } = await inviteUser(admin, {
    email: adminEmail.trim(),
    name: adminName.trim(),
    tenantId: tenant.id,
    originHeader: h.get("origin"),
    hostHeader: h.get("host"),
  });

  const supabase = await createClient();
  await logAudit(supabase, {
    action: "TENANT_CREATED",
    entityType: "tenant",
    entityId: tenant.id,
    metadata: { name: tenant.name, slug: tenant.slug, adminEmail: adminEmail.trim() },
  });

  // The tenant itself was created fine even if the invite below failed
  // (e.g. that email already has an account) -- report that as a warning,
  // not a hard error, so it's clear the tenant isn't lost, just needs its
  // admin invited again from here.
  return NextResponse.json({
    success: true,
    tenant,
    warning: inviteError ? `Tenant created, but the admin invite failed: ${inviteError.message}` : undefined,
  });
}
