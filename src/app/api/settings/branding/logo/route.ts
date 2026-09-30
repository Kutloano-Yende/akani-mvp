import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

async function requireBrandableTenant() {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: check.status }) } as const;
  }
  const supabase = await createClient();
  const { data: tenantId } = await supabase.rpc("current_tenant_id");
  if (!tenantId) {
    return { error: NextResponse.json({ error: "No active tenant found for your account" }, { status: 400 }) } as const;
  }
  const { data: tenant } = await supabase.from("tenants").select("allow_custom_branding").eq("id", tenantId).single();
  if (!tenant?.allow_custom_branding) {
    return {
      error: NextResponse.json({ error: "Custom branding isn't enabled for your tenant" }, { status: 403 }),
    } as const;
  }
  return { supabase, tenantId } as const;
}

/**
 * Uploads (or replaces) the caller's own tenant's logo. Same fixed-path /
 * upsert / remove-old-extensions shape as the personal avatar route, keyed
 * by tenant_id instead of user_id. Both the storage write and the tenants
 * table update go through the service-role client -- see the colors route
 * for why (no RLS write policy on tenants, by design).
 */
export async function POST(request: Request) {
  const result = await requireBrandableTenant();
  if ("error" in result) return result.error;
  const { supabase, tenantId } = result;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP or SVG images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 3MB or smaller" }, { status: 400 });
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  await admin.storage.from("tenant-logos").remove(Object.values(ALLOWED).map((e) => `${tenantId}/logo.${e}`));

  const path = `${tenantId}/logo.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("tenant-logos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("tenant-logos").getPublicUrl(path);
  const url = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await admin.from("tenants").update({ brand_logo_url: url }).eq("id", tenantId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logAudit(supabase, { action: "TENANT_BRANDING_LOGO_UPDATED", entityType: "tenant", entityId: tenantId });

  return NextResponse.json({ logoUrl: url });
}

export async function DELETE() {
  const result = await requireBrandableTenant();
  if ("error" in result) return result.error;
  const { supabase, tenantId } = result;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  await admin.storage.from("tenant-logos").remove(Object.values(ALLOWED).map((e) => `${tenantId}/logo.${e}`));

  const { error } = await admin.from("tenants").update({ brand_logo_url: null }).eq("id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(supabase, { action: "TENANT_BRANDING_LOGO_REMOVED", entityType: "tenant", entityId: tenantId });

  return NextResponse.json({ success: true });
}
