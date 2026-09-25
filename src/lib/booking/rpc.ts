import { createClient } from "@/lib/supabase/server";
import { TOKEN_PATTERN } from "@/lib/unsubscribe";
import type { Json } from "@/types/database";
import type { BookingSettings } from "./slots";

export type BookingPage = {
  lead: { firstName: string | null; company: string | null };
  settings: BookingSettings & { host_name: string; meeting_details: string };
  taken: string[];
  booking: { start: string; end: string } | null;
};

export type BookedSlot = {
  bookingId: string;
  start: Date;
  end: Date;
  email: string;
  firstName: string | null;
  name: string | null;
  company: string | null;
  phone: string | null;
  message: string | null;
  timezone: string;
  hostName: string;
  hostEmail: string | null;
  meetingDetails: string;
};

const obj = (v: Json | undefined): Record<string, Json> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, Json>) : {};
const str = (v: Json | undefined) => (typeof v === "string" ? v : null);

export async function getBookingPage(token: string): Promise<BookingPage | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booking_page_data", { p_token: token });
  if (error || !data) return null;

  const d = obj(data);
  const lead = obj(d.lead);
  const s = obj(d.settings);
  const booking = d.booking ? obj(d.booking) : null;

  return {
    lead: { firstName: str(lead.first_name), company: str(lead.company) },
    settings: {
      host_name: String(s.host_name),
      timezone: String(s.timezone),
      slot_minutes: Number(s.slot_minutes),
      working_days: (Array.isArray(s.working_days) ? s.working_days : []).map(Number),
      start_hour: Number(s.start_hour),
      end_hour: Number(s.end_hour),
      min_notice_hours: Number(s.min_notice_hours),
      max_days_ahead: Number(s.max_days_ahead),
      meeting_details: String(s.meeting_details ?? ""),
    },
    taken: (Array.isArray(d.taken) ? d.taken : []).map(String),
    booking: booking ? { start: String(booking.start_at), end: String(booking.end_at) } : null,
  };
}

export type BookResult = { ok: true; booked: BookedSlot } | { ok: false; reason: "taken" | "invalid" | "not_found" };

export async function bookSlot(token: string, startIso: string): Promise<BookResult> {
  if (!TOKEN_PATTERN.test(token) || Number.isNaN(Date.parse(startIso))) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_slot", { p_token: token, p_start: new Date(startIso).toISOString() });
  if (error) return { ok: false, reason: "invalid" };

  const r = obj(data);
  if (r.ok !== true) {
    const reason = r.reason === "taken" || r.reason === "not_found" ? r.reason : "invalid";
    return { ok: false, reason };
  }
  return {
    ok: true,
    booked: {
      bookingId: String(r.booking_id),
      start: new Date(String(r.start_at)),
      end: new Date(String(r.end_at)),
      email: String(r.email),
      firstName: str(r.first_name),
      name: str(r.name),
      company: str(r.company),
      phone: str(r.phone),
      message: str(r.message),
      timezone: String(r.timezone),
      hostName: String(r.host_name),
      hostEmail: str(r.host_email),
      meetingDetails: String(r.meeting_details ?? ""),
    },
  };
}

export type CancelledBooking = {
  bookingId: string;
  start: Date;
  end: Date;
  email: string;
  firstName: string | null;
  name: string | null;
  company: string | null;
  timezone: string;
  hostName: string;
  hostEmail: string | null;
};

// Cancels the lead's confirmed booking. Null if there was nothing to cancel.
export async function cancelBooking(token: string): Promise<CancelledBooking | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_booking", { p_token: token });
  if (error || !data) return null;

  const r = obj(data);
  return {
    bookingId: String(r.booking_id),
    start: new Date(String(r.start_at)),
    end: new Date(String(r.end_at)),
    email: String(r.email),
    firstName: str(r.first_name),
    name: str(r.name),
    company: str(r.company),
    timezone: String(r.timezone),
    hostName: String(r.host_name),
    hostEmail: str(r.host_email),
  };
}
