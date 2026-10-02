import { describe, expect, it } from "vitest";
import { buildInviteEmail } from "./invite-email";

const app = "https://akani.example.co.za";
const link = "https://ydumzwuzygebvqbknowd.supabase.co/auth/v1/verify?token=abc&type=invite&redirect_to=https://akani.example.co.za/auth/callback";

describe("buildInviteEmail", () => {
  it("greets the invitee by name and links the invite", () => {
    const e = buildInviteEmail("Thandi Nkosi", link, app, {});
    expect(e.subject).toBe("You've been invited to Akani");
    expect(e.text).toContain("Hi Thandi Nkosi,");
    expect(e.text).toContain(`Accept invite: ${link}`);
  });

  it("has no unsubscribe link, since it's a direct transactional invite", () => {
    const e = buildInviteEmail("Thandi Nkosi", link, app, {});
    expect(e.html).not.toContain("Unsubscribe");
  });

  it("uses the official brand", () => {
    const e = buildInviteEmail("Thandi Nkosi", link, app, {});
    expect(e.html).toContain("#050058");
    expect(e.html).toContain(`${app}/email/akani-logo.png`);
  });

  it("cannot be used to inject markup through the name", () => {
    const e = buildInviteEmail("<script>x</script>", link, app, {});
    expect(e.html).not.toContain("<script>x</script>");
  });
});
