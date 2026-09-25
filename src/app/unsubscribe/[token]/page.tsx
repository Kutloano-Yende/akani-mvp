import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rateLimit } from "@/lib/rate-limit";
import { TOKEN_PATTERN, unsubscribeByToken } from "@/lib/unsubscribe";

export const metadata = { title: "Unsubscribe" };

// The link opens a confirmation page rather than unsubscribing on load:
// mail scanners and link previewers fetch URLs automatically, and that must
// never silently unsubscribe someone.
export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const { token } = await params;
  const { result } = await searchParams;
  const valid = TOKEN_PATTERN.test(token);

  async function confirm() {
    "use server";
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!rateLimit(`unsubscribe:${ip}`, 30, 60_000).allowed) {
      redirect(`/unsubscribe/${token}?result=busy`);
    }
    const ok = await unsubscribeByToken(token);
    redirect(`/unsubscribe/${token}?result=${ok ? "done" : "failed"}`);
  }

  let heading = "Unsubscribe from Akani emails";
  let message = "Confirm below and we won't email this address again.";
  let showForm = valid;

  if (!valid) {
    message = "This unsubscribe link isn't valid.";
  } else if (result === "done") {
    heading = "You're unsubscribed";
    message = "We won't email this address again.";
    showForm = false;
  } else if (result === "failed") {
    message = "We couldn't process that link. It may be out of date.";
    showForm = false;
  } else if (result === "busy") {
    message = "Too many attempts. Please wait a minute and try again.";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-akani-page-bg px-4">
      <div className="w-full max-w-md rounded-xl border border-akani-card-border bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-akani-text-primary">{heading}</h1>
        <p className="mt-2 text-sm text-akani-text-secondary">{message}</p>
        {showForm && (
          <form action={confirm} className="mt-6">
            <button
              type="submit"
              className="rounded-md bg-akani-navy px-5 py-2 text-sm font-medium text-white hover:bg-akani-deep-blue"
            >
              Confirm unsubscribe
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
