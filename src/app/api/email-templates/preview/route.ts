import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderBrandedEmail } from "@/lib/email/branded";
import { renderSubject, renderTemplate } from "@/lib/email/render";

// Renders a template exactly as recipients will see it, with sample data.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, body, includePermission } = await request.json();
  if (typeof subject !== "string" || typeof body !== "string") {
    return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
  }

  // The preview renders in a sandboxed frame, which can't always load images by
  // address (the site's security policy treats it as a different origin), so the
  // logo is embedded in the preview itself. Real emails link to the hosted file.
  const logoAddress = `${new URL(request.url).origin}/email/akani-logo.png`;
  let logoSource = logoAddress;
  try {
    const png = await readFile(path.join(process.cwd(), "public", "email", "akani-logo.png"));
    logoSource = `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    // Fall back to the address if the file can't be read.
  }

  const vars = { firstName: "Anele", companyName: "Cape Coastal Engineering" };
  const renderedSubject = renderSubject(subject, vars);
  const { html } = renderBrandedEmail({
    subject: renderedSubject,
    preheader: includePermission ? "A quick yes or no is all we need." : undefined,
    bodyText: renderTemplate(body, vars),
    permission: includePermission
      ? { yesUrl: "https://example.com/preview?answer=yes", noUrl: "https://example.com/preview?answer=no" }
      : undefined,
    signOff: process.env.EMAIL_SIGN_OFF || "Warm regards,\nThe Akani team",
    reason: `You're receiving this because ${vars.companyName} was identified as a possible fit for Akani's B-BBEE services.`,
    unsubscribeUrl: "https://example.com/preview-unsubscribe",
    senderName: process.env.EMAIL_SENDER_NAME || "Akani BEE Ratings",
    logoUrl: logoAddress,
    address: process.env.EMAIL_FOOTER_ADDRESS || null,
  });

  // Links in a preview must not navigate anywhere.
  const inert = html
    .replace(logoAddress, logoSource)
    .replace("</head>", "<style>a{pointer-events:none;cursor:default}</style></head>");
  return NextResponse.json({ subject: renderedSubject, html: inert });
}
