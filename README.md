# Akani — Sales Intelligence for B-BBEE Prospecting

Sprint 1 MVP: discover South African businesses, score them as B-BBEE
prospects, qualify them, and track them through a pipeline to paying client.

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack) — frontend + API routes in one app
- Supabase (Postgres, Auth with TOTP 2FA, RLS) — project `akani-mvp` (`eu-west-1`)
- Tailwind CSS 4

## Setup

```bash
npm install
```

Supabase credentials are already in `.env.local` (URL + anon key). Two things
are still blank and only needed for features beyond Sprint 1's mock data:

- `SUPABASE_SERVICE_ROLE_KEY` — from the Supabase dashboard → Project Settings
  → API. Only needed for admin-only server operations (none in Sprint 1 use it
  yet).
- `COMPANYDATA_API_KEY` — the real business-data provider
  ([CompanyData](https://companydata.com)). Until it is set, **Discover
  Businesses** searches a built-in mock catalogue instead, so the full
  discover → qualify → pipeline flow works without a live integration.
  Optional: `COMPANYDATA_PAGE_SIZE` (default 10, the most a trial key allows
  per export; paid plans allow more) and `PROVIDER_DAILY_SEARCH_LIMIT`
  (default 60 billable calls per day across all users, so a busy day can't
  use up the plan's credits).

  Business-data search is behind a `DataProvider` interface
  (`src/lib/data/types.ts`) so the Discover screen and its API route never
  change when the provider does. `getProvider()` picks `CompanyDataProvider`
  when the key is set, otherwise `MockProvider`.

  How the CompanyData connector behaves (`src/lib/data/providers/companydata-provider.ts`):
  - It searches South Africa only, and only companies that have an email.
  - It asks for full records (email, phone, website, employees, revenue,
    registration number) from the export endpoint. If the account refuses that
    query (a **trial key refuses combined filters and large pages**), it falls
    back to the basic search endpoint, which returns name, address and province
    only, and the Discover screen says so.
  - When you **import** a company found that way, the app fetches that one
    company's full record by ID, so the prospect gets its contact details. One
    billable lookup per newly imported company.
  - The API returns no industry field, so each Discover industry is searched as
    a curated set of SIC codes (`INDUSTRY_SIC_CODES`) and results are labelled
    with the industry searched. This is an approximation.
  - "Company name" matches from the start of the name, not anywhere in it.

```bash
npm run dev
```

Open http://localhost:3000 (falls back to the next free port if 3000 is busy).

## Logging in

An initial admin account was created directly in Supabase Auth:

- Email: `kutloanoyende@gmail.com`
- Temporary password: `Akani-Sprint1!`

Change this password after first login (Forgot password on the login screen,
or Settings → Security once a password-change screen is added). There's no
public sign-up screen by design — this is an internal tool; new users are
invited from Settings → Users once `SUPABASE_SERVICE_ROLE_KEY` is configured
(inviting and resetting another user's 2FA both need it; until then those
actions return a clear 501).

## What's built

**Screens:** Login, 2FA verify, Dashboard, Discover Businesses, Prospects
(list + detail), Pipeline (kanban), Campaigns (list, detail, templates),
Analytics, Settings → Security (2FA enrollment) and Data Provider (usage).

**Data model:** `companies`, `contacts`, `prospects`, `opportunity_signals`,
`activities`, `profiles`, `api_usage`, `campaigns`, `campaign_prospects`,
`email_templates`, `applications`, `conversions`. Schema + RLS policies are
tracked in `supabase/migrations/` (applied directly to the `akani-mvp`
project via the Supabase MCP tools — this repo isn't yet wired to the
Supabase CLI, so new migrations need to be applied the same way and then
added here for review). `src/types/database.ts` has the generated TS types.

**Campaigns:** creating a campaign, adding prospects, and "sending" all work
end-to-end, but there is no real email provider wired up yet — "send" marks
`campaign_prospects` as sent and logs an activity per prospect; it does not
dispatch an actual email. Swap in a real provider (Resend/SendGrid) behind
`/api/campaigns/[id]/send` when ready; the data model doesn't need to change
for that.

**Conversions:** deliberately minimal — a prospect_id, a status, a date, and
free-text notes the reporting user chooses to include. That's the boundary
the proposal's Akani/Bantu confidentiality split calls for: reporting that a
conversion happened without exposing confidential client-engagement details
through this system.

**Security note:** `profiles.role` cannot be changed by a regular
authenticated user (see `20260919174923_fix_profile_role_escalation.sql`) —
RLS alone only restricts *which row* a user can touch, not *which column*,
so without the column-level `REVOKE`/`GRANT` any signed-in user could have
set their own role to `admin`. Apply the same scrutiny to any new
self-service `UPDATE` policy before shipping it.

Also: `handle_new_user()` and `set_updated_at()` are trigger-only functions
with `EXECUTE` revoked from `PUBLIC` (not just `anon`/`authenticated` — a
function's `EXECUTE` is granted to `PUBLIC` by default at creation, and
revoking from specific roles alone is a no-op while that stands). Triggers
still fire fine; this only blocks calling them directly via
`/rest/v1/rpc/...`.

**One thing you'll need to do manually:** Supabase Auth's leaked-password
protection (checks new passwords against HaveIBeenPwned) is off by default
and isn't something the available tooling could flip — turn it on in the
dashboard under Authentication → Policies.

**API routes:** the data-provider proxy (`/api/data-provider/search`) and
mutations that need server-side logic (`/api/prospects/import`,
`/api/prospects/[id]/status`, `/api/dashboard/summary`). Reads for
server-rendered pages go straight through the Supabase server client under
RLS — standard practice for Next + Supabase, and it means the browser never
talks to Postgres or any provider API directly.

**Auth:** Supabase Auth (email/password + TOTP 2FA), enforced by
`src/proxy.ts` (Next 16's replacement for `middleware.ts`), which redirects
unauthenticated requests to `/login` and holds MFA'd accounts at `/login/verify`.

## Roles

- **Sales** — can view everything, but can only change prospects that are
  unassigned or assigned to them (acting on an unassigned prospect claims it).
  Cannot create or send campaigns.
- **Manager** — can change any prospect, assign prospects, and create/send
  campaigns.
- **Admin** — everything a manager can do, plus Users, Suppression List,
  Audit Logs and POPIA in Settings.

These rules are enforced in Postgres RLS (not just hidden in the UI).

## POPIA

Settings → POPIA is a register of data-subject requests (due 30 days after
logging). **Export** downloads everything linked to the person's email as
JSON. **Erase** anonymises their contact record, clears company-level contact
details matching that email, and adds the address to the suppression list so
they can't be re-imported and contacted. Company, prospect and pipeline
history are kept so reporting still works. Free-text notes typed by staff
(activity descriptions, application notes) are not scanned for names.

## Search, alerts and exports

The header search finds prospects by company or contact name. The bell shows
live alerts (no stored read state): prospects needing a follow-up (sales see
only their own) and, for admins, POPIA requests overdue or due within 7 days.
Prospects can be exported to CSV from the Prospects page (respecting the
current stage and My/All filter) and admins can export the audit log. Both
exports are recorded in the audit log, and text cells that could run as
spreadsheet formulas are neutralised.

## Email sending and unsubscribe

Campaign sends are **simulated** until an email provider is configured. To go
live, set these in `.env.local` (or your host's environment) and restart:

- `RESEND_API_KEY` — API key from resend.com
- `EMAIL_FROM` — a sender on a domain you've verified there, e.g. `Akani <hello@yourdomain.co.za>`
- `APP_URL` — this app's public https address (unsubscribe links point here;
  live sending refuses to start without it)
- `EMAIL_REPLY_TO` — optional

The campaign page shows a "Live sending" or "Simulated sending" badge. Each
email is personalised (`{{firstName}}`, `{{companyName}}`), goes to the
company's first contact with an email (falling back to the company address),
and carries a per-recipient unsubscribe link plus `List-Unsubscribe` headers.
Recipients on the suppression list, by contact or company address, are never
sent to. A row is marked sent only after the provider accepts it; failures stay
pending so they can be retried. Sends go out in batches of 50 per click.

The unsubscribe page (`/unsubscribe/<token>`) is public and asks for
confirmation, so mail scanners that pre-fetch links can't unsubscribe anyone.
It adds the address to the suppression list.

**Before enabling live sending:** the seeded demo companies and contacts use
realistic-looking addresses. Clear them out first, or you'll email real
domains.

## Testing

```bash
npm test                     # unit tests (vitest): CSV export safety, template
                             # rendering, send planning/suppression, rate limiting,
                             # dedupe, prospect ownership, unsubscribe tokens
npx tsc --noEmit && npm run lint
```

Row-level-security rules can't be unit-tested in JS, so
`supabase/tests/rls_checks.sql` exercises them directly as sales, manager,
admin and signed-out users, then rolls back. Run it in the Supabase SQL
editor after any migration that touches policies, grants or auth functions.
GitHub Actions (`.github/workflows/ci.yml`) runs type check, lint, tests and
a build on every push and pull request; it needs no secrets.

## Optional settings

- `SUPPORT_EMAIL` — shown on the public Privacy and Contact pages. Without it
  they tell people to contact their administrator.
- `NEXT_PUBLIC_OAUTH_PROVIDERS` — e.g. `google,azure`. The login page shows
  Google/Microsoft buttons only for providers listed here, so enable a
  provider in Supabase Auth first, then list it. Default: none shown.

The Privacy notice and Terms pages describe what the system actually does,
but they are not legal advice; have them reviewed before relying on them
externally.

## Not built yet

- Employee-size and combined filters returning full contact details on the
  CompanyData trial key (a paid plan or support confirmation is needed)
- Open/reply/bounce tracking (needs provider webhooks); bounces and spam
  complaints don't yet feed the suppression list
- 2FA backup codes (Supabase MFA has no built-in recovery codes; admins can
  reset a user's 2FA instead)
- Consent tracking beyond the suppression list (opt-out register)
- Backups/PITR and monitoring (ops setup in Supabase/hosting, not app code)
- Rate limiting is in-memory, so it only holds on a single server instance
