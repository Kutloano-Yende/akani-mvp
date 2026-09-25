import { PublicPage, supportEmail } from "@/components/public-page";

export const metadata = { title: "Contact support" };

export default function ContactSupportPage() {
  const email = supportEmail();
  return (
    <PublicPage title="Contact support">
      <p>
        Akani Sales Intelligent System is an internal tool. If you can&apos;t sign in, have lost
        access to your authenticator app, or need a role changed, contact your Akani administrator.
      </p>
      {email ? (
        <p>
          You can also email{" "}
          <a href={`mailto:${email}`} className="font-medium text-akani-gold hover:underline">
            {email}
          </a>
          .
        </p>
      ) : null}
    </PublicPage>
  );
}
