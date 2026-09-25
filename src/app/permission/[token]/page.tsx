import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { rateLimit } from "@/lib/rate-limit";
import { getAppUrl } from "@/lib/email/provider";
import { startLead } from "@/lib/leads/start";
import { answerPermission, parseAnswer } from "@/lib/permission";
import { TOKEN_PATTERN } from "@/lib/unsubscribe";

export const metadata = { title: "Keep in touch?" };

// The email buttons open this page rather than recording an answer directly:
// mail scanners and link previewers fetch every link in a message, and that
// must never register a yes or a no on someone's behalf.
export default async function PermissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ answer?: string; result?: string }>;
}) {
  const { token } = await params;
  const { answer, result } = await searchParams;
  const valid = TOKEN_PATTERN.test(token);
  const suggested = parseAnswer(answer);

  async function choose(formData: FormData) {
    "use server";
    const picked = parseAnswer(String(formData.get("answer") ?? ""));
    if (!picked) redirect(`/permission/${token}`);

    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!rateLimit(`permission:${ip}`, 30, 60_000).allowed) {
      redirect(`/permission/${token}?result=busy`);
    }

    const outcome = await answerPermission(token, picked);

    // Someone who says yes has asked to hear from us, so they become a lead: an
    // instant reply with a link to book a call, then the follow-ups. Recording
    // their answer is what matters, so a problem here never fails the page.
    if (outcome && picked === "yes" && outcome.changed) {
      try {
        const h = await headers();
        const host = h.get("host");
        const appUrl = getAppUrl(h.get("origin") ?? (host ? `https://${host}` : "http://localhost:3000"));
        await startLead(
          {
            source: "permission",
            name: outcome.firstName,
            email: outcome.email,
            company: outcome.company,
            prospectId: outcome.prospectId,
          },
          appUrl,
        );
      } catch (err) {
        console.error("Couldn't start a lead from a permission yes", err);
      }
    }

    redirect(`/permission/${token}?result=${outcome ? picked : "failed"}`);
  }

  let heading = "May we keep in touch?";
  let message = "Let us know whether you're happy for Akani to contact you about B-BBEE services.";
  let showForm = valid;

  if (!valid) {
    message = "This link isn't valid.";
  } else if (result === "yes") {
    heading = "Thank you";
    message = "Great, we'll be in touch. Check your inbox for a link to book a short call. You can unsubscribe at any time.";
    showForm = false;
  } else if (result === "no") {
    heading = "Understood";
    message = "We won't contact you again.";
    showForm = false;
  } else if (result === "failed") {
    message = "We couldn't record that. The link may be out of date.";
    showForm = false;
  } else if (result === "busy") {
    message = "Too many attempts. Please wait a minute and try again.";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-akani-page-bg px-4">
      <div className="w-full max-w-md rounded-xl border border-akani-card-border bg-white p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <BrandLogo />
        </div>
        <h1 className="text-lg font-semibold text-akani-text-primary">{heading}</h1>
        <p className="mt-2 text-sm text-akani-text-secondary">{message}</p>
        {showForm && (
          <form action={choose} className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="submit"
              name="answer"
              value="yes"
              className={
                suggested === "no"
                  ? "rounded-md border-2 border-akani-navy px-5 py-2.5 text-sm font-semibold text-akani-navy hover:bg-akani-page-bg"
                  : "rounded-md bg-akani-gold px-5 py-2.5 text-sm font-semibold text-akani-navy hover:bg-akani-gold-bright"
              }
            >
              Yes, keep in touch
            </button>
            <button
              type="submit"
              name="answer"
              value="no"
              className={
                suggested === "no"
                  ? "rounded-md bg-akani-gold px-5 py-2.5 text-sm font-semibold text-akani-navy hover:bg-akani-gold-bright"
                  : "rounded-md border-2 border-akani-navy px-5 py-2.5 text-sm font-semibold text-akani-navy hover:bg-akani-page-bg"
              }
            >
              No, thanks
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
