import { describe, expect, it } from "vitest";
import { parseBookingSettings } from "./settings";

const valid = {
  host_name: "Akani BEE Ratings",
  host_email: "Hello@Akani.co.za",
  timezone: "Africa/Johannesburg",
  slot_minutes: 30,
  working_days: [1, 2, 3, 4, 5],
  start_hour: 9,
  end_hour: 17,
  min_notice_hours: 4,
  max_days_ahead: 14,
  meeting_details: "We'll call you.",
};

const err = (patch: Record<string, unknown>) => {
  const r = parseBookingSettings({ ...valid, ...patch });
  return r.ok ? null : r.error;
};

describe("parseBookingSettings", () => {
  it("accepts valid settings and tidies them", () => {
    const r = parseBookingSettings(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.host_email).toBe("hello@akani.co.za");
  });

  it("accepts numbers sent as strings, as form fields are", () => {
    const r = parseBookingSettings({ ...valid, slot_minutes: "45", start_hour: "8", working_days: ["1", "2"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.working_days).toEqual([1, 2]);
  });

  it("allows no notification email", () => {
    const r = parseBookingSettings({ ...valid, host_email: "" });
    expect(r.ok && r.value.host_email).toBeNull();
  });

  it.each([
    [{ host_name: "  " }, /name/i],
    [{ host_email: "nope" }, /email/i],
    [{ timezone: "Mars/Olympus" }, /time zone/i],
    [{ slot_minutes: 7 }, /call length/i],
    [{ working_days: [] }, /at least one day/i],
    [{ working_days: [1, 9] }, /at least one day/i],
    [{ start_hour: 17, end_hour: 9 }, /after opening/i],
    [{ start_hour: 9, end_hour: 9 }, /after opening/i],
    [{ start_hour: 9, end_hour: 25 }, /between 0 and 24/i],
    [{ start_hour: 9, end_hour: 10, slot_minutes: 90 }, /shorter than one call/i],
    [{ min_notice_hours: -1 }, /notice/i],
    [{ max_days_ahead: 0 }, /window/i],
    [{ max_days_ahead: 400 }, /window/i],
    [{ meeting_details: " " }, /what to expect/i],
  ])("rejects %j", (patch, message) => {
    expect(err(patch)).toMatch(message);
  });

  it("de-duplicates and orders the days", () => {
    const r = parseBookingSettings({ ...valid, working_days: [5, 1, 1, 3] });
    // Duplicates are a malformed submission rather than something to guess at.
    expect(r.ok).toBe(false);
    const ok = parseBookingSettings({ ...valid, working_days: [5, 1, 3] });
    expect(ok.ok && ok.value.working_days).toEqual([1, 3, 5]);
  });
});
