import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { logAudit } from "@/lib/audit";
import { collectSubjectData } from "@/lib/popia";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireRole(["admin"]);
  if (!check.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: check.status });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: popiaRequest } = await supabase
    .from("popia_requests")
    .select("id, subject_email, request_type")
    .eq("id", id)
    .maybeSingle();

  if (!popiaRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const data = await collectSubjectData(supabase, popiaRequest.subject_email);

  await logAudit(supabase, {
    action: "POPIA_DATA_EXPORTED",
    entityType: "popia_request",
    entityId: id,
  });

  return new NextResponse(
    JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2),
    {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="popia-export-${id.slice(0, 8)}.json"`,
        "Cache-Control": "no-store",
      },
    },
  );
}
