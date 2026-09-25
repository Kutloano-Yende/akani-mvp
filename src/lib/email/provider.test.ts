import { describe, expect, it } from "vitest";
import { sendingUnavailable } from "./provider";

describe("sendingUnavailable", () => {
  it("holds lead emails in production when no email provider is configured", () => {
    expect(sendingUnavailable({ NODE_ENV: "production" })).toBe(true);
    expect(sendingUnavailable({ NODE_ENV: "production", RESEND_API_KEY: "k" })).toBe(true);
    expect(sendingUnavailable({ NODE_ENV: "production", EMAIL_FROM: "a@b.co" })).toBe(true);
  });

  it("allows sending in production once both settings exist", () => {
    expect(sendingUnavailable({ NODE_ENV: "production", RESEND_API_KEY: "k", EMAIL_FROM: "a@b.co" })).toBe(false);
  });

  it("keeps the simulation available outside production", () => {
    expect(sendingUnavailable({ NODE_ENV: "development" })).toBe(false);
    expect(sendingUnavailable({})).toBe(false);
  });
});
