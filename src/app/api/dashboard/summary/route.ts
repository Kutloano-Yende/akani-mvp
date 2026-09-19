import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ count: businessesFound }, { data: prospects }] = await Promise.all([
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("prospects").select("status"),
  ]);

  const funnel = {
    identified: 0,
    qualified: 0,
    contacted: 0,
    interested: 0,
    application: 0,
    won: 0,
    lost: 0,
  };
  for (const p of prospects ?? []) {
    funnel[p.status as keyof typeof funnel] += 1;
  }

  const qualifiedProspects =
    funnel.qualified +
    funnel.contacted +
    funnel.interested +
    funnel.application +
    funnel.won;

  return NextResponse.json({
    businessesFound: businessesFound ?? 0,
    qualifiedProspects,
    applications: funnel.application + funnel.won,
    payingClients: funnel.won,
    funnel,
  });
}
