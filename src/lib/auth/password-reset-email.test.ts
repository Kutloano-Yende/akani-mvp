import { describe, expect, it } from "vitest";
import { buildPasswordResetEmail } from "./password-reset-email";

const app = "https://akani.example.co.za";
const link = "https://ydumzwuzygebvqbknowd.supabase.co/auth/v1/verify?token=abc&type=recovery&redirect_to=https://akani.example.co.za/auth/callback";

describe("buildPasswordResetEmail", () => {
  it("has the right subject and links the reset", () => {
    const e = buildPasswordResetEmail(link, app, {});
    expect(e.subject).toBe("Reset your Akani password");
    expect(e.text).toContain(`Reset password: ${link}`);
    expect(e.text).toContain("If you didn't request this");
  });

  it("has no unsubscribe link, since it's a direct transactional notice", () => {
    const e = buildPasswordResetEmail(link, app, {});
    expect(e.html).not.toContain("Unsubscribe");
  });

  it("uses the official brand", () => {
    const e = buildPasswordResetEmail(link, app, {});
    expect(e.html).toContain("#050058");
    expect(e.html).toContain(`${app}/email/akani-logo.png`);
  });
});
