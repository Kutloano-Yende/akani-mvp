import { describe, expect, it } from "vitest";
import { generateSlots, localDate, timezoneLabel, zonedTimeToUtc, type BookingSettings } from "./slots";

const settings: BookingSettings = {
  timezone: "Africa/Johannesburg",
  slot_minutes: 30,
  working_days: [1, 2, 3, 4, 5],
  start_hour: 9,
  end_hour: 17,
  min_notice_hours: 4,
  max_days_ahead: 14,
};

describe("zonedTimeToUtc", () => {
  it("converts South African time (UTC+2, no daylight saving)", () => {
    expect(zonedTimeToUtc(2026, 9, 28, 10, 0, "Africa/Johannesburg").toISOString()).toBe("2026-09-28T08:00:00.000Z");
    expect(zonedTimeToUtc(2026, 1, 15, 10, 0, "Africa/Johannesburg").toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });

  it("respects daylight saving where a zone has it", () => {
    expect(zonedTimeToUtc(2026, 7, 1, 10, 0, "Europe/London").toISOString()).toBe("2026-07-01T09:00:00.000Z");
    expect(zonedTimeToUtc(2026, 1, 15, 10, 0, "Europe/London").toISOString()).toBe("2026-01-15T10:00:00.000Z");
    expect(zonedTimeToUtc(2026, 7, 1, 9, 0, "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z");
  });
});

describe("localDate", () => {
  it("reads the date and ISO weekday in the zone, not UTC", () => {
    // 23:30 UTC on Sunday is already 01:30 Monday in Johannesburg.
    const d = localDate(new Date("2026-09-27T23:30:00Z"), "Africa/Johannesburg");
    expect(d).toEqual({ year: 2026, month: 9, day: 28, isoWeekday: 1 });
    expect(localDate(new Date("2026-09-27T12:00:00Z"), "Africa/Johannesburg").isoWeekday).toBe(7);
  });
});

describe("generateSlots", () => {
  // Friday 25 Sep 2026, 12:00 in Johannesburg.
  const friday = new Date("2026-09-25T10:00:00Z");

  it("only offers working days and never weekends", () => {
    const days = generateSlots(settings, [], friday);
    expect(days.length).toBeGreaterThan(5);
    for (const day of days) {
      const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
      expect([0, 6]).not.toContain(weekday);
    }
    expect(days.map((d) => d.date)).not.toContain("2026-09-26");
    expect(days.map((d) => d.date)).not.toContain("2026-09-27");
  });

  it("respects the minimum notice on the first day", () => {
    const [first] = generateSlots(settings, [], friday);
    expect(first.date).toBe("2026-09-25");
    // 12:00 + 4h notice: nothing before 16:00, and 16:30 is the last 30-minute slot.
    expect(first.slots.map((s) => s.label)).toEqual(["16:00", "16:30"]);
  });

  it("fills a full working day on later days, ending so the last slot finishes by closing", () => {
    const monday = generateSlots(settings, [], friday).find((d) => d.date === "2026-09-28")!;
    expect(monday.slots[0].label).toBe("09:00");
    expect(monday.slots.at(-1)!.label).toBe("16:30");
    expect(monday.slots).toHaveLength(16);
  });

  it("returns slot starts as UTC instants", () => {
    const monday = generateSlots(settings, [], friday).find((d) => d.date === "2026-09-28")!;
    expect(monday.slots[0].start).toBe("2026-09-28T07:00:00.000Z");
  });

  it("leaves out slots that are already taken", () => {
    const taken = ["2026-09-28T08:00:00.000Z"]; // 10:00 local
    const monday = generateSlots(settings, taken, friday).find((d) => d.date === "2026-09-28")!;
    expect(monday.slots.map((s) => s.label)).not.toContain("10:00");
    expect(monday.slots).toHaveLength(15);
  });

  it("stops after the booking window", () => {
    const days = generateSlots({ ...settings, max_days_ahead: 3 }, [], friday);
    expect(days.at(-1)!.date <= "2026-09-28").toBe(true);
  });

  it("honours other slot lengths and hours", () => {
    const [day] = generateSlots({ ...settings, slot_minutes: 60, start_hour: 8, end_hour: 12 }, [], new Date("2026-09-23T00:00:00Z"));
    expect(day.slots.map((s) => s.label)).toEqual(["08:00", "09:00", "10:00", "11:00"]);
  });

  it("offers nothing when no days are working days", () => {
    expect(generateSlots({ ...settings, working_days: [] }, [], friday)).toEqual([]);
  });
});

describe("timezoneLabel", () => {
  it("gives a readable name instead of the zone id", () => {
    expect(timezoneLabel(new Date("2026-09-28T08:00:00Z"), "Africa/Johannesburg")).toBe("South Africa Standard Time");
  });
});
