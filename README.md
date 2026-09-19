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
- `BDM_DATAFINDER_API_KEY` / `BDM_DATAFINDER_BASE_URL` — the real business
  data provider. Until these are set, **Discover Businesses** searches a
  built-in mock catalogue instead (see `src/lib/data/provider.ts`), so the
  full discover → qualify → pipeline flow works without a live integration.

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
provisioned directly in Supabase Auth until an admin "invite user" screen
ships (planned for Sprint 4 alongside RBAC).

## What's built (Sprint 1)

**Screens:** Login, 2FA verify, Dashboard, Discover Businesses, Prospects
(list + detail), Pipeline (kanban), Settings → Security (2FA enrollment).

**Data model:** `companies`, `contacts`, `prospects`, `opportunity_signals`,
`activities`, `profiles` — see the migration history in Supabase (project
`akani-mvp`) for the full schema, or `src/types/database.ts` for the
generated types.

**API routes:** the data-provider proxy (`/api/data-provider/search`) and
mutations that need server-side logic (`/api/prospects/import`,
`/api/prospects/[id]/status`, `/api/dashboard/summary`). Reads for
server-rendered pages go straight through the Supabase server client under
RLS — standard practice for Next + Supabase, and it means the browser never
talks to Postgres or any provider API directly.

**Auth:** Supabase Auth (email/password + TOTP 2FA), enforced by
`src/proxy.ts` (Next 16's replacement for `middleware.ts`), which redirects
unauthenticated requests to `/login` and holds MFA'd accounts at `/login/verify`.

## Not built yet (later sprints, per the MVP plan)

- Real BDM DataFinder integration (currently mocked)
- Campaigns/outreach, email templates
- Applications and conversions tracking (with the Akani/Bantu confidentiality
  split)
- Admin user management, audit logs, suppression list, POPIA controls
- Rate limiting, security headers, monitoring
