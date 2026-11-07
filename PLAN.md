# Build plan: township resident app

Brief: [docs/brief.md](docs/brief.md) (problem 3, gated township). **Deadline: 9 Nov 2026, 11:59 pm IST.**
Ship the CORE BUILD slice only, end to end, deployed from the first hour.

## Scope

**In (CORE BUILD):** resident OTP login → maintenance bills + mock payment + receipt + ledger → bank CSV matching with accounts queue → complaints with AI category/urgency, auto-assignment, status timeline, rating → help desk queue → committee dashboard.
Roles: `RESIDENT`, `HELPDESK` (also does accounts matching), `COMMITTEE` (read-only).

**Cut (write up as "next" in the TDD):** gate/visitor management, guard tablet offline mode, amenity booking, real SMS + payment gateway, full Marathi/Hindi (only the resident home gets a language switch), 90-day visitor photo deletion job.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router) + TypeScript, server actions + route handlers |
| DB | Neon Postgres + Prisma |
| Hosting | Vercel (deploys on every push) |
| Auth | Phone + OTP, **mocked** (OTP `123456`, shown on login screen), signed httpOnly cookie (`jose`) |
| Payments | Mock checkout page → success / failure / pending → callback writes Payment + LedgerEntry |
| Photos | Vercel Blob |
| AI | Anthropic SDK, `claude-haiku-5-5`, structured JSON output validated with Zod; keyword fallback |
| UI | Tailwind v4 with tokens from [DESIGN.md](DESIGN.md), Radix primitives (headless) for dialog / select / tabs, `lucide-react` icons. **No shadcn.** |
| Validation | Zod on every input |
| Tests | Vitest |
| PWA | `app/manifest.ts` + minimal service worker (installable; offline shell only) |

Env vars (names only): `DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_API_KEY` (optional), `BLOB_READ_WRITE_TOKEN`.
Vercel build: `prisma migrate deploy && prisma db seed && next build`.

## Data model

```
Flat(id "T12-0408", tower int, number, areaSqft)
User(id, phone unique, name, locale)
Membership(userId, flatId, kind OWNER|TENANT|FAMILY)
Staff(id, phone, name, role HELPDESK|COMMITTEE|DUTY_MANAGER|TECHNICIAN, skills Category[])
Bill(id, flatId, period "2026-11", principal, dueDate, status)
LedgerEntry(id, flatId, type BILL|LATE_FEE|PAYMENT|ADJUSTMENT|CREDIT, amount signed, refType, refId, createdAt)  -- append-only, balance is derived
Payment(id, flatId, amount, method UPI|NEFT|CHEQUE|GATEWAY, status, source GATEWAY|BANK, utr, receiptNo)
KnownUpiId(flatId, vpa)
BankImport(id, fileName, fileHash unique, uploadedBy, rowCount, createdAt)
BankRow(id, importId, rowHash unique, txnDate, amount, narration, utr, vpa, status AUTO_POSTED|REVIEW|UNMATCHED|IGNORED|POSTED,
        suggestedFlatId, score, reasons Json, resolvedBy, resolvedAt)
Complaint(id, flatId, raisedBy, text, photoUrl, category, urgency LOW|MEDIUM|HIGH|CRITICAL,
          aiCategory, aiUrgency, aiConfidence, classifiedBy AI|RULE|FALLBACK|STAFF, safetyEscalated bool,
          assigneeId, status NEW|ASSIGNED|IN_PROGRESS|RESOLVED|CLOSED|REOPENED,
          parentId (duplicate link), dueBy, firstResponseAt, resolvedAt, rating, reopenCount)
ComplaintEvent(id, complaintId, actor, kind, note, createdAt)   -- timeline
Notice(id, title, body, publishedAt)
```

## Business rules (label as assumptions in the TDD)

- Bill = `areaSqft × ₹6.50`, issued on the 1st, due on the 10th. Check: 1150→7475, 980→6370, 1640→10660.
- **Assumed** late fee: 21% p.a. simple interest on overdue principal, accrued daily, posted monthly. One config constant.
- Payment allocation: oldest late fee first, then the oldest bill. Overpayment becomes `CREDIT`.
- Response targets: CRITICAL 30 min, HIGH 4 h, MEDIUM 24 h, LOW 72 h.

## Hard part: bank CSV matching (`lib/matching/`, pure functions, fully tested)

1. **Parse** with Papaparse. Normalize headers (common Indian bank exports: Date, Narration/Description, Ref/Chq No, Withdrawal, Deposit/Credit). Skip debits. Hash each row (date+amount+narration+utr) → idempotent re-import.
2. **Extract** from narration: flat IDs (`T12-0408`, `T120408`, `T12/408`, `TWR12 FLT408`, `12-0408`), UTR, UPI VPA (`x@okhdfc`).
3. **Score** each candidate flat:
   - flat ID in narration +60
   - VPA in `KnownUpiId` for that flat +50
   - amount == current outstanding +30, == one month's bill +25, < outstanding (partial) +10
   - payer name token matches a member surname +10
   - more than one candidate flat within 15 points → mark ambiguous
4. **Decide:** `score ≥ 90 && !ambiguous` → `AUTO_POSTED` (writes Payment + LedgerEntry). `40–89` or ambiguous → `REVIEW` with top-3 suggestions and reasons. `< 40` → `UNMATCHED`. **Nothing uncertain posts to a flat automatically.**
5. Accounts queue: confirm suggestion / pick another flat / mark ignored (e.g. bank interest). Every resolution is audited.
6. Ship `samples/bank-statement-nov-2026.csv` (~40 rows: clean, typo'd flat IDs, VPA-only, partial, overpay, duplicate import, ambiguous same-amount, non-resident credit).

## Complaint AI (`lib/complaints/`)

1. **Safety rule first:** regex for fire, smoke, gas, leak + gas, lift stuck, trapped, shock, spark, short circuit (+ Marathi/Hindi: आग, गॅस/गैस, शॉक, लिफ्ट अडकली/फंसी). Match → urgency CRITICAL, `safetyEscalated`, assign duty manager. **The AI cannot override this.**
2. **Claude classify:** text → `{category, urgency, confidence, summary}`. Categories: PLUMBING, ELECTRICAL, LIFT, SECURITY, HOUSEKEEPING, PEST, PARKING, NOISE, OTHER. Timeout 6 s.
3. **Fallback:** no key / error / timeout / confidence < 0.6 → keyword classifier, `classifiedBy=FALLBACK`, "Needs review" chip in the help desk.
4. **Duplicates:** same tower + same category + within 24 h + token similarity ≥ 0.5 (or LIFT in the same tower) → set `parentId`, show "Linked to #123 (9 others)". Never auto-closed. Resolving the parent notifies the children.
5. **Assignment:** category → staff with that skill and the fewest open tickets.
6. Help desk changes category in one tap, which writes `classifiedBy=STAFF` (log it as AI feedback).

## Screens (mobile-first, resident uses a bottom tab bar)

| # | Route | Who | Notes |
|---|---|---|---|
| 1 | `/login` | all | phone → OTP → flat picker if more than one membership. Demo accounts listed below the form. |
| 2 | `/` | resident | dark dues card (amount, due date, Pay), open complaints, notices. Every action ≤ 2 taps. |
| 3 | `/bills` + `/bills/[id]` + `/pay/[id]` | resident | bill breakdown (area × rate, late fee), mock checkout, receipt, ledger |
| 4 | `/complaints` + `/complaints/new` + `/complaints/[id]` | resident | AI suggestion shown while typing (debounced), photo, timeline, response timer, rating on close, reopen |
| 5 | `/desk` | helpdesk | queue: SLA timer, urgency, safety badge, duplicates, one-tap recategorize, assign, status |
| 6 | `/desk/payments` | helpdesk | upload CSV → summary counts → review queue with reasons |
| 7 | `/committee` | committee, helpdesk | collections vs billed, ageing buckets (0–30/31–60/61–90/90+), complaint response/resolve times, reopen rate, safety escalations |

Every screen gets loading (skeleton), empty and error states. No dead buttons: anything not built is not shown.

## Seed

- The 3 brief flats exactly (Neeraj paid; Swati tenant, 47 days overdue, open water leak; Aamir partial ₹5,000, 18 days overdue).
- About 80 generated flats across 28 towers with 6 months of bills and payments (about 70% on time, matching the brief's baseline), about 120 complaints with realistic text including one lift outage reported by 9 flats in T14.
- Staff: 1 help desk, 1 committee, 1 duty manager, 4 technicians. Deterministic (seeded RNG) so screenshots stay stable.

## Demo logins (OTP `123456` for all)

| Role | Phone | Who |
|---|---|---|
| Resident | 90000 00001 | Neeraj Kulkarni, T07-1203 |
| Resident (tenant) | 90000 00002 | Swati Joshi, T12-0408 |
| Resident | 90000 00003 | Aamir Shaikh, T21-1601 |
| Help desk | 90000 00010 | Help desk staff |
| Committee | 90000 00020 | Committee member |

Fake numbers; the OTP is mocked.

## Tests (Vitest)

Matching (~15 cases), billing + late fee, payment allocation, safety override, classifier fallback, duplicate linking, route access control (resident cannot read another flat), Zod rejects.

## Security

No secrets in the repo (`.env.example` only). Server-side role checks on every route and action, scoped by flat membership. Rate-limit OTP verify. Upload limits: CSV 2 MB, image 5 MB, mime checked. Personal data stays fake in the seed.

## Build order and model to use

| Phase | Work | Model |
|---|---|---|
| 0 | Planning, design direction, this file | **Opus** ✅ done |
| 1 | Scaffold Next + Prisma + Tailwind tokens, push to GitHub, deploy to Vercel + Neon (live URL) | Sonnet |
| 2 | Schema, seed, mocked OTP auth, roles, app shell + design system components | Sonnet |
| 3 | Bills, ledger, mock payment, receipt | Sonnet |
| 4 | Matching engine + tests → upload + review screens | Sonnet (switch to Opus if the tests fight back) |
| 5 | Complaints: safety rule, Claude classify, fallback, duplicates, assignment, desk queue | Sonnet |
| 6 | Committee dashboard | Sonnet |
| 7 | Polish: states, mobile pass, PWA, a11y, security pass | Sonnet |
| 8 | TDD + deployment.md + final review against the brief's checklist | **Opus** |

Commit after each working step (reviewers read the history).
