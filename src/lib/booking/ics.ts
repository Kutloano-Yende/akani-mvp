export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  organizer?: { name: string; email: string };
  attendee?: { name?: string; email: string };
  method?: "REQUEST" | "CANCEL";
  now?: Date;
};

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// RFC 5545 text escaping.
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Content lines longer than 75 octets must be folded onto continuation lines.
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (size + n > limit) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

// Quoted parameter values may not contain double quotes.
const param = (s: string) => s.replace(/"/g, "'");

export function buildIcs(e: IcsEvent): string {
  const cancelled = e.method === "CANCEL";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Akani BEE Ratings//Call booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${e.method ?? "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${icsDate(e.now ?? new Date())}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(e.end)}`,
    `SUMMARY:${escapeText(e.summary)}`,
    ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
    ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
    ...(e.organizer ? [`ORGANIZER;CN="${param(e.organizer.name)}":mailto:${e.organizer.email}`] : []),
    ...(e.attendee
      ? [`ATTENDEE;CN="${param(e.attendee.name ?? e.attendee.email)}";RSVP=TRUE:mailto:${e.attendee.email}`]
      : []),
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
