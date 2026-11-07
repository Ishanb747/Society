# Sahyadri Greens

A resident app and back office for a 2,400-flat gated township: maintenance bills and payments,
complaints with AI triage, bank statement matching, and a monthly committee report.

Built for the Isocode take-home (problem 3). The client brief is in [docs/brief.md](docs/brief.md),
the build plan in [PLAN.md](PLAN.md) and the visual system in [DESIGN.md](DESIGN.md).
How to run and deploy it, and the demo logins, are in [deployment.md](deployment.md).

## What works

| Who | What |
|---|---|
| Resident (mobile, installable) | OTP login linked to a flat, dues and late fee, test-mode payment, receipts, ledger, raise a complaint with a photo, follow it to the end, rate or reopen, notices, English / मराठी / हिन्दी on the home screen |
| Help desk | Complaint queue with response timers, one-tap recategorise, linked duplicates, assignment, status and notes |
| Accounts | Upload a bank statement CSV, automatic matching, review queue for anything unclear |
| Committee | Collections, dues ageing, complaint times, reopen rate, with a ledger reconciliation check and CSV export |

## How the hard parts behave

- **Payment matching** scores each credit on flat ID, registered UPI ID, amount and payer name. A row is posted automatically only with a clear identity signal *and* the right amount *and* no close runner-up. Everything else goes to a person. Re-importing a file never posts twice.
- **Complaints**: a safety rule (fire, gas, lift stuck, shock...) always escalates to the duty manager whatever the AI says. Claude classifies category and urgency; if it is down or unsure, keyword rules take over and the complaint is flagged for review. Duplicates are linked, never closed.

## Stack

Next.js 16 (App Router), TypeScript, Tailwind v4, Prisma 7 on Neon Postgres, Zod, jose, Vitest. AI: Claude Haiku via the Anthropic SDK.

## Tests

```bash
npm test
```
