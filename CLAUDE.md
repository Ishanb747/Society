# Isocode take-home: township resident app

- Brief: `readme.md`. Plan, scope, data model and rules: `PLAN.md`. Visual system: `DESIGN.md`. Follow both; don't re-plan.
- Deadline 9 Nov 2026, 11:59 pm IST. Build only the CORE BUILD in PLAN.md and keep the deployed app working after every step.
- Stack: Next.js App Router + TS, Prisma + Neon, Tailwind v4 tokens from DESIGN.md, Radix primitives. **Do not use shadcn.**
- Every screen needs loading, empty and error states. No dead buttons: hide what isn't built.
- Role checks and flat scoping on the server for every route and server action. Zod on all inputs.
- Matching engine and complaint classification are pure functions in `lib/` with Vitest tests.
- Label assumptions with `// ASSUMPTION:` so they can be collected into the TDD.
- Never commit secrets; keep `.env.example` current. Small commits after each working step.
- Model split: Sonnet implements; Opus for planning, the TDD and final review.
