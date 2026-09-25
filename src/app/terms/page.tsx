import { PublicPage } from "@/components/public-page";

export const metadata = { title: "Terms of use" };

// Internal acceptable-use terms for staff. Not a customer-facing contract —
// have it reviewed before relying on it externally.
export default function TermsPage() {
  return (
    <PublicPage title="Terms of use">
      <p>
        Access to the Akani Sales Intelligent System is limited to authorised Akani staff. By
        signing in you agree to the following.
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>Use the system only for Akani&apos;s business purposes.</li>
        <li>Keep your password and authenticator app private; don&apos;t share your account.</li>
        <li>
          Treat prospect and contact information as confidential. Export it only when you need to,
          as exports are logged.
        </li>
        <li>
          Respect unsubscribe and do-not-contact requests. Never email an address on the
          suppression list.
        </li>
        <li>Report a suspected security problem to your administrator straight away.</li>
      </ul>
      <p>Your activity in the system is recorded for security and audit purposes.</p>
    </PublicPage>
  );
}
