# Deployment

## Run it locally

Needs Node 20+ and a Postgres database (a free [Neon](https://neon.com) project works).

```bash
git clone https://github.com/Ishanb747/Society.git
cd Society
npm install

cp .env.example .env
# fill in DATABASE_URL and SESSION_SECRET (see below). The other two are optional.

npm run build      # generates the Prisma client, applies migrations, loads the demo data, builds
npm run start      # http://localhost:3000
```

For development with hot reload use `npm run dev` after one `npm run build` (the build is what loads the demo data).

Other commands: `npm test` (Vitest), `npm run lint`, `npx prisma db seed` (reset the demo data).

## Environment variables

Names only. Never commit values.

| Name | Required | What it is |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. On Neon use the **pooled** one (host contains `-pooler`). Used by the running app. |
| `DATABASE_URL_UNPOOLED` | recommended | Direct (non-pooled) Neon connection string. Used for migrations and the seed. Falls back to `DATABASE_URL` if not set. |
| `SESSION_SECRET` | yes | 32+ random characters that sign the login cookie. Generate with `openssl rand -base64 32`. |
| `ANTHROPIC_API_KEY` | optional | Enables the AI complaint classifier (Claude Haiku). Without it the app falls back to keyword rules, so everything still works. |
| `BLOB_READ_WRITE_TOKEN` | optional | Vercel Blob token for complaint photos. Without it small photos are stored inline in the database. |

## How it is deployed

- **App**: Vercel, imported from the GitHub repo. Every push to `main` deploys.
- **Database**: Neon Postgres (project `little-bar-84960437`, branch `production`).
- **Build command** (already in `package.json`): `prisma generate && prisma migrate deploy && prisma db seed && next build`. So each deploy applies migrations and **resets the demo data**, which keeps the sample data fresh and dated relative to the day of the deploy.
- Set the four variables above in Vercel → Project → Settings → Environment Variables.
- Put the Vercel function region close to the database (Neon here is in `us-east-2`, so `iad1`).

## Demo logins

There is no SMS. Every account uses the demo code **123456**, shown on the sign-in screen. All phone numbers are made up.

| Role | Phone | Notes |
|---|---|---|
| Resident, paid up | `9000000001` | Neeraj Kulkarni, T07-1203. Nothing due. |
| Resident, tenant, overdue | `9000000002` | Swati Joshi, T12-0408. Three months unpaid, late fee, open water-leak complaint. |
| Resident, part paid | `9000000003` | Aamir Shaikh, T21-1601. |
| Resident with two flats | `9000000004` | Meera Kapoor, T04-0302 and T18-0905. Shows the flat switcher. |
| Help desk and accounts | `9000000010` | Complaint queue and payment matching. |
| Committee | `9000000020` | Read-only report. |
| Duty manager | `9000000030` | Complaint queue (safety escalations land here). |
| Technician | `9000000031` | Complaint queue. |

## A five-minute tour for a reviewer

1. Sign in as **Swati** → home shows what is due and the open complaint → **Pay now** → checkout (test mode) → receipt → Bills shows the ledger.
2. Still as Swati → **Complaints → New** → type "smell of gas near the staircase". The safety hint appears while typing; after sending, it is marked critical and escalated.
3. Sign in as the **help desk** → the gas complaint is pinned on top → open "Needs review" and change a category in one tap → open the lift outage (nine flats, one linked group).
4. Help desk → **Payments** → download the sample statement (also at `/samples/bank-statement.csv`) → upload it. Six rows post automatically, five wait for review, four are unmatched, one duplicate and two debits are skipped. Upload it again: nothing posts twice.
5. Sign in as the **committee** → collections, dues ageing, complaint times, and the reconciliation check.

## Things to know

- **Mocked on purpose**: OTP delivery, the payment gateway ("test mode" checkout) and outside systems.
- **Bank sample and the 10th**: the sample statement uses each flat's exact bill. Maintenance is due on the 10th; after that, late fees accrue, an exact-amount payment no longer equals the total due, and those rows correctly go to review instead of posting automatically. Redeploying or running `npx prisma db seed` resets the dates.
- **Not built** (cut for time, see the design document): visitor management and the guard tablet, amenity booking, full Marathi/Hindi translation (the home screen and tab bar are translated), the 90-day visitor photo deletion job.
