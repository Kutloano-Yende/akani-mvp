import { describe, expect, it } from "vitest";
import { buildReplyAckEmail } from "./reply-ack-email";

const app = "https://akani.example.co.za";
const token = "a756cc6f-f6fe-467a-bb21-be60668bb1b7";

describe("buildReplyAckEmail", () => {
  it("thanks the lead and points to the booking page", () => {
    const e = buildReplyAckEmail({ firstName: "Thandi", token }, app, {});
    expect(e.subject).toBe("Thanks for your reply");
    expect(e.text).toContain("Thandi");
    expect(e.text).toContain(`${app}/book/${token}`);
  });

  it("copes without a name", () => {
    const e = buildReplyAckEmail({ firstName: null, token }, app, {});
    expect(e.text).toContain("Hi there,");
  });

  it("has no unsubscribe link, since it's a direct reply not a bulk send", () => {
    const e = buildReplyAckEmail({ firstName: "Thandi", token }, app, {});
    expect(e.html).not.toContain("Unsubscribe");
  });

  it("sets a per-lead reply-to when a reply domain is configured", () => {
    const withDomain = buildReplyAckEmail({ firstName: "Thandi", token }, app, { LEAD_REPLY_DOMAIN: "reply.akani.example" });
    expect(withDomain.replyTo).toBe(`reply+${token}@reply.akani.example`);

    const withoutDomain = buildReplyAckEmail({ firstName: "Thandi", token }, app, {});
    expect(withoutDomain.replyTo).toBeUndefined();
  });

  it("cannot be used to inject markup through the name", () => {
    const e = buildReplyAckEmail({ firstName: "<script>x</script>", token }, app, {});
    expect(e.html).not.toContain("<script>x</script>");
  });
});
