import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AvatarUpload } from "./avatar-upload";
import { RestartOnboardingButton } from "./restart-onboarding-button";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Profile picture</h2>
        <p className="mb-4 text-sm text-akani-text-secondary">
          Shown next to your name in the sidebar and wherever your activity appears.
        </p>
        <AvatarUpload name={profile?.name ?? user.email ?? "User"} avatarUrl={profile?.avatar_url ?? null} />
      </section>

      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Getting started</h2>
        <p className="mb-4 text-sm text-akani-text-secondary">
          A walkthrough of how prospects, campaigns, leads and bookings fit together.
        </p>
        <RestartOnboardingButton />
      </section>
    </div>
  );
}
