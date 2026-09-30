import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { recordLeadReply, recordLeadReplyAck } from "./reply";

const token = "a756cc6f-f6fe-467a-bb21-be60668bb1b7";

describe("recordLeadReply", () => {
  beforeEach(() => rpc.mockReset());

  it("never hits the database for a malformed token", async () => {
    expect(await recordLeadReply("not-a-token")).toEqual({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports ackNeeded: false for a lead already out of the active drip", async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true, ack_needed: false, lead_id: "l1" }, error: null });
    expect(await recordLeadReply(token)).toEqual({ ok: true, ackNeeded: false, leadId: "l1" });
    expect(rpc).toHaveBeenCalledWith("lead_reply_received", { p_token: token });
  });

  it("shapes the ack-needed response for a freshly detected reply", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        ok: true,
        ack_needed: true,
        lead_id: "l1",
        email: "thandi@test.local",
        first_name: "Thandi",
        name: "Thandi Nkosi",
        company: "Nkosi Co",
        token,
      },
      error: null,
    });
    expect(await recordLeadReply(token)).toEqual({
      ok: true,
      ackNeeded: true,
      leadId: "l1",
      email: "thandi@test.local",
      firstName: "Thandi",
      name: "Thandi Nkosi",
      company: "Nkosi Co",
      token,
    });
  });

  it("returns ok: false for an unknown token or a database error", async () => {
    rpc.mockResolvedValueOnce({ data: { ok: false, reason: "not_found" }, error: null });
    expect(await recordLeadReply(token)).toEqual({ ok: false });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await recordLeadReply(token)).toEqual({ ok: false });
  });
});

describe("recordLeadReplyAck", () => {
  beforeEach(() => rpc.mockReset());

  it("never hits the database for a malformed token", async () => {
    await recordLeadReplyAck("not-a-token", true, null);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls the RPC with the outcome", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await recordLeadReplyAck(token, true, null);
    expect(rpc).toHaveBeenCalledWith("lead_record_reply_ack", { p_token: token, p_ok: true, p_error: "" });

    rpc.mockResolvedValueOnce({ data: null, error: null });
    await recordLeadReplyAck(token, false, "Send failed");
    expect(rpc).toHaveBeenCalledWith("lead_record_reply_ack", { p_token: token, p_ok: false, p_error: "Send failed" });
  });
});
