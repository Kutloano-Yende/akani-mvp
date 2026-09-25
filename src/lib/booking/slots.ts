export type BookingSettings = {
  timezone: string;
  slot_minutes: number;
  // ISO weekdays: 1 = Monday ... 7 = Sunday
  working_days: number[];
  start_hour: number;
  end_hour: number;
  min_notice_hours: number;
  max_days_ahead: number;
};

export type Slot = { start: string; label: string };
export type SlotDay = { date: string; label: string; slots: Slot[] };

const partsFormat = (timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

function readParts(date: Date, timeZone: string) {
  const out: Record<string, number> = {};
  for (const p of partsFormat(timeZone).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

// Minutes the zone is ahead of UTC at a given instant.
function offsetMinutes(at: Date, timeZone: string): number {
  const p = readParts(at, timeZone);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at.getTime() / 1000) * 1000) / 60000;
}

// The UTC instant at which the wall clock in `timeZone` reads y-m-d h:min.
export function zonedTimeToUtc(y: number, m: number, d: number, h: number, min: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = offsetMinutes(new Date(guess), timeZone);
  let utc = guess - first * 60000;
  // Around a clock change the offset differs at the corrected instant.
  const second = offsetMinutes(new Date(utc), timeZone);
  if (second !== first) utc = guess - second * 60000;
  return new Date(utc);
}

// Calendar date and ISO weekday as seen in `timeZone`.
export function localDate(at: Date, timeZone: string) {
  const p = readParts(at, timeZone);
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() || 7;
  return { year: p.year, month: p.month, day: p.day, isoWeekday: weekday };
}

export function formatTime(at: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-ZA", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}

// "South Africa Standard Time" rather than the raw zone id "Africa/Johannesburg".
export function timezoneLabel(at: Date, timeZone: string) {
  const part = new Intl.DateTimeFormat("en-ZA", { timeZone, timeZoneName: "long" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone.replace(/_/g, " ");
}

export function formatDay(at: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-ZA", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(at);
}

export function formatDateTime(at: Date, timeZone: string) {
  return `${formatDay(at, timeZone)}, ${formatTime(at, timeZone)}`;
}

// Every bookable slot in the coming days, grouped by local date. Mirrors the
// rules the database enforces in book_slot(), which is the real authority.
export function generateSlots(settings: BookingSettings, takenIso: string[], now: Date = new Date()): SlotDay[] {
  const tz = settings.timezone;
  const taken = new Set(takenIso.map((t) => new Date(t).getTime()));
  const earliest = now.getTime() + settings.min_notice_hours * 3_600_000;
  const latest = now.getTime() + settings.max_days_ahead * 86_400_000;

  const today = localDate(now, tz);
  const days: SlotDay[] = [];

  for (let offset = 0; offset <= settings.max_days_ahead; offset++) {
    // Date arithmetic on the calendar date alone, so a clock change can't skip a day.
    const cal = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const isoWeekday = cal.getUTCDay() || 7;
    if (!settings.working_days.includes(isoWeekday)) continue;

    const slots: Slot[] = [];
    for (let mins = settings.start_hour * 60; mins + settings.slot_minutes <= settings.end_hour * 60; mins += settings.slot_minutes) {
      const start = zonedTimeToUtc(cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(), Math.floor(mins / 60), mins % 60, tz);
      const t = start.getTime();
      if (t < earliest || t > latest || taken.has(t)) continue;
      slots.push({ start: start.toISOString(), label: formatTime(start, tz) });
    }
    if (slots.length > 0) {
      const iso = `${cal.getUTCFullYear()}-${String(cal.getUTCMonth() + 1).padStart(2, "0")}-${String(cal.getUTCDate()).padStart(2, "0")}`;
      days.push({ date: iso, label: formatDay(new Date(slots[0].start), tz), slots });
    }
  }
  return days;
}
