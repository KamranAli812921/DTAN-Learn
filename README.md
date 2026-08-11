# DTAN Learn

A role-based Learning & Training Management System built with Next.js 14 (App Router), TypeScript, MongoDB/Mongoose, NextAuth, Cloudinary, Resend, and the Zoom API. Three roles — **Admin**, **Teacher**, **Student** — with strict server-side ownership checks on every request.


## Tech stack

- Next.js 14 (App Router) + TypeScript
- MongoDB Atlas via Mongoose
- NextAuth.js (Credentials provider, JWT sessions)
- bcryptjs for password hashing
- Zod for server-side validation on every API route
- Tailwind CSS + shadcn/ui-style components
- Cloudinary for file uploads (assignments, materials, submissions, avatars)
- Resend for transactional email (password-reset codes)
- Zoom Server-to-Server OAuth for meeting creation + attendance sync (webhook + polling fallback)

## Prerequisites

- Node.js 18.18+ (Node 20+ recommended)
- A MongoDB Atlas cluster (a free M0 tier works — Atlas clusters run as replica sets, which this app relies on for multi-document transactions on account creation)
- A Cloudinary account (free tier is fine)
- A Resend account with a verified sending domain (or use their sandbox sender for local testing)
- A Zoom account with a Server-to-Server OAuth app created in the Zoom Marketplace, and a Webhook app subscribed to `meeting.participant_joined` / `meeting.participant_left`

## Environment setup

1. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

2. Fill in every value in `.env.local`:

   | Variable | Where to get it |
   |---|---|
   | `MONGODB_URI` | Atlas → Connect → Drivers |
   | `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | `http://localhost:3000` locally; your deployed URL in production |
   | `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary dashboard |
   | `RESEND_API_KEY` | Resend dashboard → API Keys |
   | `EMAIL_FROM` | A verified sender on your Resend domain |
   | `ZOOM_ACCOUNT_ID` / `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` | Zoom Marketplace → Server-to-Server OAuth app |
   | `ZOOM_WEBHOOK_SECRET_TOKEN` | Zoom Marketplace → your Webhook app → Secret Token |
   | `SEED_ADMIN_USERNAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Credentials for the first admin account (seed script) |

## Install & run

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000` and redirects `/` to `/login`.

## Seed the first admin account

Once `MONGODB_URI` and the `SEED_ADMIN_*` variables are set in `.env.local`:

```bash
npm run seed
```

This creates a single active admin user (idempotent — running it again is a no-op if that username/email already exists). Log in at `/login` and change the password immediately via the account menu → **Change password**.

From the admin dashboard you can then create teacher accounts, which can in turn create student accounts within their assigned batches.

## Zoom webhook setup

Zoom needs a publicly reachable URL to deliver webhook events, so this only works once deployed (or via a tunnel like `ngrok` for local testing):

1. In the Zoom Marketplace, create a **Webhook Only** app (or add event subscriptions to your Server-to-Server OAuth app).
2. Set the event notification endpoint to `https://<your-domain>/api/attendance/zoom-webhook`.
3. Subscribe to `Meeting > Participant/Host joined meeting` and `Meeting > Participant/Host left meeting`.
4. Copy the app's **Secret Token** into `ZOOM_WEBHOOK_SECRET_TOKEN`.
5. Zoom will send a one-time `endpoint.url_validation` event to confirm the endpoint — the webhook route handles this automatically.

If the webhook ever misses an event (network blip, app not yet deployed, etc.), teachers/admins can hit **Sync attendance** on a live class from the Attendance page, which pulls the full participant report from Zoom's REST API and backfills anything missing.

## Project structure

```
app/
  (auth)/login, forgot-password        — public auth pages
  admin/…                               — admin-only pages (role-guarded)
  teacher/…                             — teacher-only pages
  student/…                             — student-only pages
  api/…                                 — all backend routes (Zod-validated, session + ownership checked)
lib/                                    — db connection, auth config, permissions, Cloudinary/Resend/Zoom clients, validators
models/                                 — Mongoose schemas
components/                             — shadcn-style UI primitives + shared feature components
scripts/seed.ts                         — creates the first admin account
```

## Security model

- Every password is hashed with bcrypt; plain-text passwords are never stored or logged.
- `middleware.ts` blocks cross-role route access at the edge; every API route independently re-checks `session.user.role` **and** record ownership (a teacher's session must own the batch/course/student it's touching; a student can only ever read/write their own records) before touching the database — the middleware check is a UX convenience, not the security boundary.
- All API input is validated server-side with Zod.
- File uploads are proxied through a server route to Cloudinary (the API secret never reaches the browser), with extension and size (20MB) validation.
- The forgot-password flow uses a bcrypt-hashed 6-digit code with a 10-minute expiry, a 5-attempt lockout, and single-use tokens — never a reusable link. It also returns an identical response whether or not the email exists, and is rate-limited (3 requests / 15 min) per email and per IP.
- Deactivation is soft (`status: inactive`) rather than hard-deleting user accounts.
- Every manual attendance mark or override writes an `AttendanceAuditLog` entry — no exceptions.

## Deploying to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Vercel, import the repo as a new project (framework preset: Next.js — auto-detected).
3. Add every variable from `.env.local` to the Vercel project's Environment Variables (Production + Preview).
4. Set `NEXTAUTH_URL` to your production URL (e.g. `https://dtan-learn.vercel.app`).
5. Deploy. Run `npm run seed` once locally against the **production** `MONGODB_URI` (or temporarily point your local `.env.local` at it) to create the first admin account — there's no seed step in the Vercel build itself.
6. Point your Zoom webhook subscription at `https://<your-vercel-domain>/api/attendance/zoom-webhook`.

MongoDB Atlas: allow-list `0.0.0.0/0` (or Vercel's specific egress IPs, if you've pinned them) under Atlas → Network Access so serverless functions can connect.
