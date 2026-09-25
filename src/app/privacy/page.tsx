import { PublicPage, supportEmail } from "@/components/public-page";

export const metadata = { title: "Privacy notice" };

// Describes what the system actually does today. It is a factual summary,
// not legal advice — have it reviewed before relying on it externally.
export default function PrivacyPage() {
  const email = supportEmail();
  return (
    <PublicPage title="Privacy notice">
      <p>
        Akani uses this system to find and contact businesses that may benefit from B-BBEE
        services. This notice explains what personal information it holds and your rights under
        the Protection of Personal Information Act (POPIA).
      </p>

      <h2 className="pt-2 font-semibold text-akani-text-primary">What we hold</h2>
      <p>
        Business contact details from commercial data providers: a company&apos;s name, registration
        number, address and email, and business contacts&apos; names, job titles, work email addresses
        and phone numbers. We also keep a record of the outreach we send and the replies and status
        changes that follow. Staff accounts hold a name, work email and role.
      </p>

      <h2 className="pt-2 font-semibold text-akani-text-primary">Why we hold it</h2>
      <p>
        To identify prospective clients, contact them about Akani&apos;s services, and manage that
        relationship. Actions on personal information, such as sign-ins, exports and erasures, are
        recorded in an audit log for security.
      </p>

      <h2 className="pt-2 font-semibold text-akani-text-primary">Your rights</h2>
      <p>
        You can ask what information we hold about you, and ask us to correct or erase it. Every
        marketing email includes an unsubscribe link; using it stops further emails to that
        address immediately. When we erase your details we keep only your email address, on a
        do-not-contact list, so that you are not contacted again.
      </p>

      <h2 className="pt-2 font-semibold text-akani-text-primary">Making a request</h2>
      <p>
        {email ? (
          <>
            Email{" "}
            <a href={`mailto:${email}`} className="font-medium text-akani-gold hover:underline">
              {email}
            </a>{" "}
            and we will respond within 30 days.
          </>
        ) : (
          <>Contact your Akani administrator, who will respond within 30 days.</>
        )}{" "}
        You may also complain to the Information Regulator of South Africa.
      </p>
    </PublicPage>
  );
}
