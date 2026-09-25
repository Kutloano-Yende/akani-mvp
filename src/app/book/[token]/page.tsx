import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { cancelBooking, bookSlot, getBookingPage } from "@/lib/booking/rpc";
import { sendBookingEmails, sendCancellationEmails } from "@/lib/booking/emails";
import { formatDateTime, generateSlots, timezoneLabel } from "@/lib/booking/slots";
import { getAppUrl } from "@/lib/email/provider";
import { rateLimit } from "@/lib/rate-limit";
import { TOKEN_PATTERN } from "@/lib/unsubscribe";

export const metadata = { title: "Book a call" };
export const dynamic = "force-dynamic";

async function requestContext() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const host = h.get("host");
  const origin = h.get("origin") ?? (host ? `https://${host}` : "http://localhost:3000");
  return { ip, appUrl: getAppUrl(origin) };
}

const MESSAGES: Record<string, { tone: "good" | "bad"; text: string }> = {
  booked: { tone: "good", text: "You're booked. We've emailed you a confirmation with a calendar invite." },
  moved: { tone: "good", text: "Your call has been moved. We've emailed you the new details." },
  cancelled: { tone: "good", text: "Your call has been cancelled. You're welcome to choose a new time whenever you're ready." },
  taken: { tone: "bad", text: "Sorry, that time was just taken. Please choose another." },
  invalid: { tone: "bad", text: "That time isn't available. Please choose another." },
  busy: { tone: "bad", text: "Too many attempts. Please wait a minute and try again." },
  failed: { tone: "bad", text: "Something went wrong. Please try again." },
};

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const { token } = await params;
  const { result } = await searchParams;

  async function book(formData: FormData) {
    "use server";
    const { ip, appUrl } = await requestContext();
    if (!rateLimit(`book:${ip}`, 20, 60_000).allowed) redirect(`/book/${token}?result=busy`);

    const hadBooking = !!(await getBookingPage(token))?.booking;
    const outcome = await bookSlot(token, String(formData.get("start") ?? ""));
    if (!outcome.ok) redirect(`/book/${token}?result=${outcome.reason === "not_found" ? "failed" : outcome.reason}`);

    // The booking is saved; a problem sending emails must not undo it.
    await sendBookingEmails(outcome.booked, token, appUrl).catch((e) => console.error("Booking emails failed", e));
    redirect(`/book/${token}?result=${hadBooking ? "moved" : "booked"}`);
  }

  async function cancel() {
    "use server";
    const { ip, appUrl } = await requestContext();
    if (!rateLimit(`book:${ip}`, 20, 60_000).allowed) redirect(`/book/${token}?result=busy`);

    const cancelled = await cancelBooking(token);
    if (!cancelled) redirect(`/book/${token}?result=failed`);
    await sendCancellationEmails(cancelled, appUrl).catch((e) => console.error("Cancellation emails failed", e));
    redirect(`/book/${token}?result=cancelled`);
  }

  const page = TOKEN_PATTERN.test(token) ? await getBookingPage(token) : null;
  const message = result ? MESSAGES[result] : undefined;

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-akani-page-bg px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-center">
          <BrandLogo />
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-akani-text-muted">Akani BEE Ratings &middot; Together we build</p>
      </div>
    </main>
  );

  if (!page) {
    return shell(
      <div className="rounded-xl border border-akani-card-border bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-akani-text-primary">This link isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-akani-text-secondary">
          It may have expired. Please reply to the email we sent you and we&apos;ll sort out a time.
        </p>
      </div>,
    );
  }

  const tz = page.settings.timezone;
  const days = generateSlots(page.settings, page.taken);
  const name = page.lead.firstName?.trim();
  const booked = page.booking ? new Date(page.booking.start) : null;

  return shell(
    <div className="space-y-4">
      {message && (
        <div
          role="status"
          className={`rounded-md px-4 py-3 text-sm ${
            message.tone === "good" ? "bg-akani-success-bg text-akani-success" : "bg-akani-error-bg text-akani-error"
          }`}
        >
          {message.text}
        </div>
      )}

      {booked && (
        <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-akani-text-muted">Your booked call</p>
          <p className="mt-1 text-lg font-semibold text-akani-text-primary">{formatDateTime(booked, tz)}</p>
          <p className="mt-1 text-sm text-akani-text-secondary">
            {page.settings.slot_minutes} minutes. {page.settings.meeting_details}
          </p>
          <p className="mt-3 text-sm text-akani-text-secondary">Need a different time? Choose another below, or cancel this one.</p>
          <form action={cancel} className="mt-3">
            <button
              type="submit"
              className="rounded-md border border-akani-card-border px-4 py-2 text-sm font-medium text-akani-error hover:bg-akani-page-bg"
            >
              Cancel this call
            </button>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-akani-text-primary">
          {booked ? "Move your call" : "Choose a time for a call"}
        </h1>
        <p className="mt-1 text-sm text-akani-text-secondary">
          {name ? `Hi ${name}, pick` : "Pick"} a time that suits you. Calls are {page.settings.slot_minutes} minutes and times
          are in {timezoneLabel(new Date(), tz)}.
        </p>

        {days.length === 0 ? (
          <p className="mt-6 rounded-md bg-akani-warning-bg px-4 py-3 text-sm text-akani-warning">
            There are no free times in the next {page.settings.max_days_ahead} days. Please reply to our email and we&apos;ll
            find a time that works.
          </p>
        ) : (
          <form action={book} className="mt-6 space-y-5">
            {days.map((day) => (
              <fieldset key={day.date}>
                <legend className="mb-2 text-sm font-semibold text-akani-text-primary">{day.label}</legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {day.slots.map((slot) => (
                    <button
                      key={slot.start}
                      type="submit"
                      name="start"
                      value={slot.start}
                      className="rounded-md border border-akani-card-border px-3 py-2 text-sm font-medium text-akani-navy hover:border-akani-gold hover:bg-akani-page-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-akani-gold"
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </form>
        )}
      </section>
    </div>,
  );
}
