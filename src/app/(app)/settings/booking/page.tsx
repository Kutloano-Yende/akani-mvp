import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getEmailMode } from "@/lib/email/provider";
import { leadsSecret } from "@/lib/leads/db";
import { BookingSettingsForm } from "./booking-settings-form";
import { LeadFormGuide } from "./lead-form-guide";

export default async function BookingSettingsPage() {
  const check = await requireRole(["admin", "manager"]);
  if (!check.authorized) redirect("/settings/security");

  const supabase = await createClient();
  const { data: settings } = await supabase.from("booking_settings").select("*").maybeSingle();
  if (!settings) redirect("/settings/security");

  const appUrl = (process.env.APP_URL?.trim() || "https://your-akani-address").replace(/\/+$/, "");

  return (
    <div className="max-w-3xl space-y-6">
      <section data-tour="booking-settings" className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Call booking</h2>
        <p className="mb-4 text-sm text-akani-text-secondary">
          When people can book a call with you. These times are shown to leads on their booking page.
        </p>
        <BookingSettingsForm settings={settings} />
      </section>

      <LeadFormGuide
        endpoint={`${appUrl}/api/public/leads`}
        allowedOrigins={process.env.LEAD_ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? []}
        secretConfigured={!!leadsSecret()}
        cronConfigured={!!process.env.CRON_SECRET}
        appUrlConfigured={!!process.env.APP_URL}
        liveEmail={getEmailMode() === "live"}
      />
    </div>
  );
}
