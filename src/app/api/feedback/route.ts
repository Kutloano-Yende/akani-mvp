import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, getAppUrl, sendingUnavailable } from "@/lib/email/provider";
import { supportEmail } from "@/components/public-page";
import { buildFeedbackNotification } from "@/lib/feedback/email";

const MAX_MESSAGE_CHARS = 2000;

// Any signed-in user can submit feedback from the button in the app shell.
// The database row is the durable record; the email is a best-effort
// convenience on top of it, so a mail failure never loses the feedback.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit(`feedback:${user.id}`, 5, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too much feedback at once — please wait a while before sending more." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_CHARS) : "";
  if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });
  const pagePath = typeof body?.pagePath === "string" ? body.pagePath.slice(0, 300) : null;

  const { data: feedback, error } = await supabase
    .from("feedback")
    .insert({ submitted_by: user.id, message, page_path: pagePath })
    .select("id")
    .single();
  if (error || !feedback) {
    console.error("Feedback insert failed", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  const to = supportEmail();
  if (to && !sendingUnavailable()) {
    const { data: profile } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
    const appUrl = getAppUrl(new URL(request.url).origin);
    const notice = buildFeedbackNotification(
      { name: profile?.name ?? "A user", role: profile?.role ?? "sales", email: user.email ?? "unknown", message, pagePath },
      appUrl,
    );
    const result = await sendEmail({ to, subject: notice.subject, html: notice.html, text: notice.text, replyTo: user.email });
    if (result.ok) {
      await supabase.from("feedback").update({ email_sent: true }).eq("id", feedback.id);
    }
  }

  return NextResponse.json({ ok: true });
}
