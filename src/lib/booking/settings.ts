export type BookingSettingsInput = {
  host_name: string;
  host_email: string | null;
  timezone: string;
  slot_minutes: number;
  working_days: number[];
  start_hour: number;
  end_hour: number;
  min_notice_hours: number;
  max_days_ahead: number;
  meeting_details: string;
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const SLOT_LENGTHS = [15, 20, 30, 45, 60, 90];

function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN);

// Validates settings from the staff form. The database has its own checks too;
// this gives people a clear message instead of a database error.
export function parseBookingSettings(
  raw: Record<string, unknown>,
): { ok: true; value: BookingSettingsInput } | { ok: false; error: string } {
  const host_name = typeof raw.host_name === "string" ? raw.host_name.trim().slice(0, 120) : "";
  if (!host_name) return { ok: false, error: "Enter the name calls are booked under." };

  const hostEmailRaw = typeof raw.host_email === "string" ? raw.host_email.trim().toLowerCase() : "";
  if (hostEmailRaw && !EMAIL.test(hostEmailRaw)) return { ok: false, error: "That notification email address isn't valid." };

  const timezone = typeof raw.timezone === "string" ? raw.timezone.trim() : "";
  if (!validTimezone(timezone)) return { ok: false, error: "That time zone isn't recognised (e.g. Africa/Johannesburg)." };

  const slot_minutes = int(raw.slot_minutes);
  if (!SLOT_LENGTHS.includes(slot_minutes)) return { ok: false, error: "Choose a call length from the list." };

  const days = Array.isArray(raw.working_days) ? raw.working_days.map(int) : [];
  const working_days = [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort();
  if (working_days.length === 0 || working_days.length !== days.length) {
    return { ok: false, error: "Choose at least one day people can book." };
  }

  const start_hour = int(raw.start_hour);
  const end_hour = int(raw.end_hour);
  if (!(start_hour >= 0 && start_hour <= 23) || !(end_hour >= 1 && end_hour <= 24)) {
    return { ok: false, error: "Hours must be between 0 and 24." };
  }
  if (end_hour <= start_hour) return { ok: false, error: "Closing time must be after opening time." };
  if ((end_hour - start_hour) * 60 < slot_minutes) return { ok: false, error: "The working day is shorter than one call." };

  const min_notice_hours = int(raw.min_notice_hours);
  if (!(min_notice_hours >= 0 && min_notice_hours <= 240)) return { ok: false, error: "Minimum notice must be 0 to 240 hours." };

  const max_days_ahead = int(raw.max_days_ahead);
  if (!(max_days_ahead >= 1 && max_days_ahead <= 90)) return { ok: false, error: "Booking window must be 1 to 90 days." };

  const meeting_details = typeof raw.meeting_details === "string" ? raw.meeting_details.trim().slice(0, 500) : "";
  if (!meeting_details) return { ok: false, error: "Add a line telling people what to expect on the call." };

  return {
    ok: true,
    value: {
      host_name,
      host_email: hostEmailRaw || null,
      timezone,
      slot_minutes,
      working_days,
      start_hour,
      end_hour,
      min_notice_hours,
      max_days_ahead,
      meeting_details,
    },
  };
}
