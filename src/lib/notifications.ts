import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/types/database";

export type Notification = {
  id: string;
  tone: "warning" | "urgent";
  text: string;
  href: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Alerts are derived from live data on every request — nothing is stored,
// so there's no read/unread state to drift out of sync with reality.
export async function getNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: Enums<"user_role">,
): Promise<Notification[]> {
  const now = Date.now();
  const items: Notification[] = [];

  let followUps = supabase
    .from("prospects")
    .select("id, last_contacted_at, companies(name)")
    .in("status", ["qualified", "contacted", "interested"])
    .order("last_contacted_at", { ascending: true, nullsFirst: true });
  // Sales staff are only nagged about prospects that are theirs to act on.
  if (role === "sales") followUps = followUps.eq("assigned_to", userId);

  const { data: prospects } = await followUps;
  const stale = (prospects ?? []).filter(
    (p) => !p.last_contacted_at || now - new Date(p.last_contacted_at).getTime() > 7 * DAY_MS,
  );

  for (const p of stale.slice(0, 5)) {
    const company = Array.isArray(p.companies) ? p.companies[0] : p.companies;
    items.push({
      id: `followup-${p.id}`,
      tone: "warning",
      text: `${company?.name ?? "A prospect"} needs a follow-up${
        p.last_contacted_at ? " (no contact in 7+ days)" : " (never contacted)"
      }`,
      href: `/prospects/${p.id}`,
    });
  }
  if (stale.length > 5) {
    items.push({
      id: "followup-more",
      tone: "warning",
      text: `${stale.length - 5} more prospects need a follow-up`,
      href: role === "sales" ? "/prospects?mine=1" : "/prospects",
    });
  }

  if (role === "admin") {
    const { data: requests } = await supabase
      .from("popia_requests")
      .select("id, subject_email, due_at")
      .eq("status", "open")
      .lte("due_at", new Date(now + 7 * DAY_MS).toISOString())
      .order("due_at", { ascending: true });

    for (const r of requests ?? []) {
      const overdue = new Date(r.due_at).getTime() < now;
      items.unshift({
        id: `popia-${r.id}`,
        tone: "urgent",
        text: `POPIA request for ${r.subject_email} is ${overdue ? "overdue" : "due within 7 days"}`,
        href: "/settings/popia",
      });
    }
  }

  return items;
}
