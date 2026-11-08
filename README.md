# Society

A resident app and back office for a 2,400-flat gated township in Pune: maintenance bills and payments, complaints with AI triage, bank statement matching, and a monthly committee report.

- **Public site** at `/`: what the app does, live notices, sign in.
- **Resident app** (mobile-first, installable): dues, payments, receipts, complaints, notices.
- **Management side** (desktop): help desk complaint queue, accounts payment matching, committee report.

Built for the Isocode take-home, problem 3. Brief: [docs/brief.md](docs/brief.md). Plan: [PLAN.md](PLAN.md). Visual system: [DESIGN.md](DESIGN.md). Run and deploy details: [deployment.md](deployment.md).

Repository: https://github.com/Ishanb747/Society

## Demo logins

There is no SMS. Every account uses the code **123456**. All people and numbers are made up. `/login?phone=<number>` pre-fills the number.

| Role | Phone | Notes |
|---|---|---|
| Resident, paid up | `9000000001` | Neeraj Kulkarni, T07-1203 |
| Resident, tenant, overdue | `9000000002` | Swati Joshi, T12-0408. Three months unpaid, open water-leak complaint |
| Resident, part paid | `9000000003` | Aamir Shaikh, T21-1601 |
| Resident with two flats | `9000000004` | Meera Kapoor, shows the flat switcher |
| Help desk and accounts | `9000000010` | Complaint queue, Payments (bank statement matching), report |
| Committee | `9000000020` | Read-only report |
| Duty manager | `9000000030` | Complaint queue, safety escalations land here |
| Technician | `9000000031` | Complaint queue |

## What works

| Who | What |
|---|---|
| Resident | Phone and code login linked to a flat, dues and late fee, payment with receipt, ledger, complaints with a photo, status timeline, rate or reopen, notices, English / मराठी / हिन्दी on the home screen and tab bar |
| Help desk | Complaint queue with response timers, one-tap recategorise, linked duplicates, assignment, status and notes |
| Accounts | Upload a bank statement CSV, automatic matching, review queue for anything unclear (sample: `/samples/bank-statement.csv`) |
| Committee | Collections, dues ageing, complaint times, reopen rate, a ledger reconciliation check, CSV export |

## How the hard parts behave

- **Payment matching** scores each credit on flat ID, registered UPI ID, amount and payer name. A row posts automatically only with a clear identity signal, the right amount and no close runner-up. Everything else goes to a person. Re-uploading a file never posts twice.
- **Complaints**: a safety rule (fire, gas, stuck lift, shock) always escalates to the duty manager, whatever the AI says. Claude classifies category and urgency; if it is unavailable or unsure, keyword rules take over and the complaint is flagged for review. Duplicates are linked, never closed.

## Mocked on purpose

OTP delivery (fixed code), the payment gateway (no money moves), and outside systems. The checkout page has a small link to simulate a failed payment.

## Not built

Visitor management and guard tablet, amenity booking, full Marathi and Hindi translation, the 90-day visitor photo deletion job.

## Run locally

Needs Node 20+ and a Postgres database (a free [Neon](https://neon.com) project works).

```bash
git clone https://github.com/Ishanb747/Society.git
cd Society
npm install
cp .env.example .env     # fill in DATABASE_URL, DATABASE_URL_UNPOOLED, SESSION_SECRET
npm run build            # generates the Prisma client, applies migrations, loads the demo data, builds
npm run start            # http://localhost:3000
```

`npm run dev` for hot reload (after one `npm run build`, which loads the demo data). `npm test` runs the Vitest suite. `npx prisma db seed` resets the demo data.

## Deploy (Vercel + Neon)

1. Create a Neon project. Copy the **pooled** and the **direct** connection strings.
2. Push this repo to GitHub (it is public) and import it at https://vercel.com/new. The framework (Next.js) and region (`iad1`, next to Neon `us-east-2`) are preset by `vercel.json`.
3. Add the environment variables below, then deploy. The build applies migrations and loads the demo data, so the first deploy is ready to use.

| Name | Required | Value |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | yes | Neon direct connection string (migrations and seed) |
| `SESSION_SECRET` | yes | 32+ random characters (`openssl rand -base64 32`) |
| `ANTHROPIC_API_KEY` | optional | Turns on the Claude complaint classifier; without it keyword rules are used |
| `BLOB_READ_WRITE_TOKEN` | optional | Vercel Blob token for complaint photos |

Every deploy re-seeds the demo data, so dates stay relative to the deploy day. Check `/api/health` after deploying.

## Stack

Next.js 16 (App Router, Cache Components), TypeScript, Tailwind v4, Prisma 7 on Neon Postgres, Zod, jose, Lenis, Vitest. AI: Claude Haiku through the Anthropic SDK.

## Tests

```bash
npm test     # 83 tests: billing, allocation, matching, complaints, access control, validation
```
