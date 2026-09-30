import { describe, expect, it } from "vitest";
import { extractLeadTokenFromRecipient, extractRecipientAddresses, leadReplyToAddress } from "./reply-to";

const token = "a756cc6f-f6fe-467a-bb21-be60668bb1b7";

describe("leadReplyToAddress", () => {
  it("builds a plus-addressed reply-to when a reply domain is configured", () => {
    expect(leadReplyToAddress(token, { LEAD_REPLY_DOMAIN: "reply.akani.example" })).toBe(
      `reply+${token}@reply.akani.example`,
    );
  });

  it("returns undefined when no reply domain is configured", () => {
    expect(leadReplyToAddress(token, {})).toBeUndefined();
    expect(leadReplyToAddress(token, { LEAD_REPLY_DOMAIN: "" })).toBeUndefined();
  });
});

describe("extractLeadTokenFromRecipient", () => {
  it("round-trips a real token", () => {
    expect(extractLeadTokenFromRecipient(`reply+${token}@reply.akani.example`)).toBe(token);
  });

  it("returns null for an address with no plus tag", () => {
    expect(extractLeadTokenFromRecipient("reply@reply.akani.example")).toBeNull();
  });

  it("returns null for a malformed tag", () => {
    expect(extractLeadTokenFromRecipient("reply+not-a-token@reply.akani.example")).toBeNull();
  });

  it("returns null for an address with no @", () => {
    expect(extractLeadTokenFromRecipient(`reply+${token}`)).toBeNull();
  });
});

describe("extractRecipientAddresses", () => {
  it("handles a single string", () => {
    expect(extractRecipientAddresses("a@b.co")).toEqual(["a@b.co"]);
  });

  it("handles an array of strings", () => {
    expect(extractRecipientAddresses(["a@b.co", "c@d.co"])).toEqual(["a@b.co", "c@d.co"]);
  });

  it("handles an array of {email} objects", () => {
    expect(extractRecipientAddresses([{ email: "a@b.co" }, { email: "c@d.co" }])).toEqual(["a@b.co", "c@d.co"]);
  });

  it("handles an array of {address} objects", () => {
    expect(extractRecipientAddresses([{ address: "a@b.co" }])).toEqual(["a@b.co"]);
  });

  it("returns an empty list for anything unrecognised", () => {
    expect(extractRecipientAddresses(undefined)).toEqual([]);
    expect(extractRecipientAddresses(null)).toEqual([]);
    expect(extractRecipientAddresses(42)).toEqual([]);
    expect(extractRecipientAddresses({})).toEqual([]);
  });
});
