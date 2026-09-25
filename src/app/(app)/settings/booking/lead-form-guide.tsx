function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        aria-hidden="true"
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-akani-success" : "bg-akani-warning"}`}
      />
      <span className={ok ? "text-akani-text-secondary" : "text-akani-text-primary"}>{children}</span>
    </li>
  );
}

export function LeadFormGuide({
  endpoint,
  allowedOrigins,
  secretConfigured,
  cronConfigured,
  appUrlConfigured,
  liveEmail,
}: {
  endpoint: string;
  allowedOrigins: string[];
  secretConfigured: boolean;
  cronConfigured: boolean;
  appUrlConfigured: boolean;
  liveEmail: boolean;
}) {
  const snippet = `<form id="akani-lead">
  <input name="name" placeholder="Your name" required>
  <input name="email" type="email" placeholder="Email" required>
  <input name="phone" placeholder="Phone">
  <input name="company" placeholder="Company">
  <textarea name="message" placeholder="How can we help?"></textarea>
  <!-- hidden from people; bots fill it in -->
  <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px">
  <button>Send</button>
</form>
<script>
  document.getElementById("akani-lead").addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await fetch("${endpoint}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
    });
    alert(res.ok ? "Thanks! Check your email." : "Sorry, something went wrong.");
  });
</script>`;

  return (
    <section className="rounded-xl border border-akani-card-border bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-akani-text-primary">Website lead form</h2>
      <p className="mb-4 text-sm text-akani-text-secondary">
        Add this form to your website. Each enquiry gets an instant branded reply with a link to book a call, then up to
        three follow-ups.
      </p>

      <ul className="mb-4 space-y-1.5">
        <Status ok={secretConfigured}>
          {secretConfigured ? "Lead handling is set up." : "Lead handling isn't set up: LEADS_SECRET is missing on the server."}
        </Status>
        <Status ok={allowedOrigins.length > 0}>
          {allowedOrigins.length > 0
            ? `Accepting forms from ${allowedOrigins.join(", ")}.`
            : "No website is allowed yet. Set LEAD_ALLOWED_ORIGINS to your site's address (e.g. https://akanibee.co.za)."}
        </Status>
        <Status ok={appUrlConfigured}>
          {appUrlConfigured ? "Links in emails point to your public address." : "Set APP_URL so links in emails work for recipients."}
        </Status>
        <Status ok={liveEmail}>
          {liveEmail ? "Emails are being sent for real." : "Email is in simulation mode: nothing is actually sent until RESEND_API_KEY and EMAIL_FROM are set."}
        </Status>
        <Status ok={cronConfigured}>
          {cronConfigured ? "Follow-ups run automatically every morning (about 08:00)." : "Follow-ups won't run until CRON_SECRET is set."}
        </Status>
      </ul>

      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-akani-text-muted">Endpoint</p>
      <code className="mb-4 block overflow-x-auto rounded-md bg-akani-page-bg px-3 py-2 text-xs text-akani-text-primary">
        POST {endpoint}
      </code>

      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-akani-text-muted">Example form</p>
      <pre className="overflow-x-auto rounded-md bg-akani-page-bg p-3 text-xs leading-relaxed text-akani-text-primary">
        <code>{snippet}</code>
      </pre>
    </section>
  );
}
