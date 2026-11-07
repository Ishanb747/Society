import type { Metadata } from "next";
import { ArrowRight, Banknote, BellRing, Languages, MessageSquareWarning, ReceiptText, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo, Skeleton, buttonClass } from "@/components/ui";
import { db } from "@/lib/db";
import { fmtDateLong } from "@/lib/format";

export const metadata: Metadata = {
  title: { absolute: "Isocode Township: pay maintenance, raise complaints, stay informed" },
  description: "The resident portal for a 2,400-flat gated township in Pune. Pay maintenance, track complaints and read notices from your phone.",
};

const NAV = [
  { href: "#residents", label: "For residents" },
  { href: "#office", label: "Management office" },
  { href: "#notices", label: "Notices" },
  { href: "#faq", label: "FAQ" },
];

const FEATURES = [
  { Icon: ReceiptText, title: "Maintenance, without the chase", body: "See exactly what you owe and why: area times rate, late fee, advance credit. Pay in two taps and get a receipt straight away." },
  { Icon: MessageSquareWarning, title: "Complaints that get routed", body: "Describe the problem in your own words. It is categorised, given an urgency and sent to the right person. Gas, fire or a stuck lift go straight to the duty manager." },
  { Icon: BellRing, title: "Notices that reach you", body: "Water shut-offs, lift servicing and committee decisions are posted once and show up on your home screen." },
  { Icon: Languages, title: "English, मराठी, हिंदी", body: "Switch language from the sidebar or the More tab. The home screen and navigation follow." },
  { Icon: Smartphone, title: "Installs like an app", body: "Add it to your home screen on Android or iPhone. It opens full screen and shows a friendly page when you are offline." },
  { Icon: ShieldCheck, title: "Only your flat's data", body: "Every page checks who you are on the server. Owners and tenants see their own flat; nobody sees a neighbour's account." },
];

const STEPS = [
  { n: "01", title: "Sign in with your phone", body: "Use the mobile number registered with the management office. A one-time code confirms it is you." },
  { n: "02", title: "See your flat at a glance", body: "Amount due, due date, open complaints and notices on one screen." },
  { n: "03", title: "Pay or report in two taps", body: "Pay the bill, or describe an issue. You can follow every update until it is closed, then rate the fix." },
];

const OFFICE = [
  { Icon: Banknote, title: "Bank statement matching", body: "Upload the bank CSV. Payments are matched to flats by flat number, UPI ID and amount. Certain matches post on their own; anything doubtful waits for a person." },
  { Icon: MessageSquareWarning, title: "One queue for complaints", body: "A lift outage reported by nine flats shows as one job with nine linked reports. Response-time targets are tracked per urgency." },
  { Icon: ReceiptText, title: "A report for the committee", body: "Collections against billing, dues ageing, response and resolution times, and a reconciliation check that proves the books add up." },
];

const FAQ = [
  { q: "How is my maintenance calculated?", a: "Built-up area in square feet times ₹6.50 per month. It is issued on the 1st and due on the 10th. A late fee applies to overdue amounts." },
  { q: "I am a tenant. Can I use the portal?", a: "Yes. Tenants, owners and family members registered against a flat can sign in. If you are linked to more than one flat, switch between them from the top of the screen." },
  { q: "I paid by bank transfer. When will it show?", a: "When the management office uploads the bank statement, your transfer is matched to your flat. If it cannot be matched with certainty, a person checks it first." },
  { q: "What counts as an emergency?", a: "Gas smell, fire or smoke, electric shock, someone trapped in a lift. Raise it in the app and it is marked critical immediately. For immediate danger, also call the security desk." },
  { q: "Who can see my complaints and payments?", a: "You, the help desk and accounts team who resolve them, and the committee for totals. Other residents cannot." },
];

async function Notices() {
  await connection();
  const notices = await db.notice.findMany({ orderBy: { publishedAt: "desc" }, take: 3 });
  if (notices.length === 0) return <p className="text-fg-2">No notices right now.</p>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {notices.map((n) => (
        <li key={n.id} className="grid gap-1 py-5 md:grid-cols-[160px_1fr] md:gap-8">
          <p className="t-small text-fg-3">{fmtDateLong(n.publishedAt)}</p>
          <div>
            <h3 className="t-h3">{n.title}</h3>
            <p className="mt-1 text-fg-2">{n.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Landing() {
  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 md:px-10">
          <Link href="/" className="flex items-center gap-3" aria-label="Isocode Township home">
            <Logo size={32} />
            <span className="font-semibold tracking-[-0.02em]">Isocode Township</span>
          </Link>
          <nav aria-label="Site" className="hidden items-center gap-8 md:flex">
            {NAV.map((n) => <a key={n.href} href={n.href} className="link t-small text-fg-2 hover:text-fg">{n.label}</a>)}
          </nav>
          <Link href="/login" className={buttonClass({ small: true })}>Sign in</Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-ink text-on-ink">
          <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full opacity-60" style={{ background: "radial-gradient(closest-side, rgba(0,42,207,.55), transparent)" }} />
          <div className="relative mx-auto max-w-[1200px] px-5 pb-20 pt-20 md:px-10 md:pb-32 md:pt-32">
            <p className="t-label text-on-ink-2">Pune · 28 towers · 2,400 homes</p>
            <h1 className="mt-6 max-w-[16ch] text-[clamp(44px,9vw,104px)] font-semibold leading-[0.95] tracking-[-0.05em]">Home, <span className="text-on-ink-2">run properly.</span></h1>
            <p className="mt-8 max-w-[52ch] text-[18px] leading-7 text-on-ink-2 md:text-[20px] md:leading-8">
              One place for your maintenance bill, your complaints and what the management office is up to. Built for residents, owners and tenants, on any phone.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/login" className={`${buttonClass({ variant: "accent" })} md:h-12 md:px-7`}>Sign in to your flat <ArrowRight size={18} aria-hidden /></Link>
              <a href="#residents" className="inline-flex h-12 items-center rounded-sm border border-on-ink/30 px-6 font-medium text-on-ink hover:bg-on-ink/10">See what you can do</a>
            </div>
            <dl className="mt-20 grid grid-cols-2 gap-y-8 border-t border-on-ink/15 pt-8 md:grid-cols-4">
              {[["2,400", "flats"], ["28", "towers"], ["2 taps", "to pay a bill"], ["30 min", "target for critical issues"]].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-[32px] font-semibold leading-none tracking-[-0.04em] md:text-[44px]">{v}</dt>
                  <dd className="t-small mt-2 text-on-ink-2">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Residents */}
        <section id="residents" className="mx-auto max-w-[1200px] scroll-mt-16 px-5 py-20 md:px-10 md:py-32">
          <p className="t-label text-fg-3">For residents</p>
          <h2 className="mt-4 max-w-[20ch] text-[clamp(32px,5vw,56px)] font-semibold leading-[1.02] tracking-[-0.04em]">Everything about your flat, in your pocket.</h2>
          <div className="mt-14 grid gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ Icon, title, body }) => (
              <article key={title} className="bg-surface p-7 md:p-8">
                <Icon size={24} strokeWidth={1.75} aria-hidden />
                <h3 className="t-h3 mt-6">{title}</h3>
                <p className="mt-2 text-fg-2">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="bg-surface-2">
          <div className="mx-auto max-w-[1200px] px-5 py-20 md:px-10 md:py-28">
            <p className="t-label text-fg-3">How it works</p>
            <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-12">
              {STEPS.map((s) => (
                <li key={s.n} className="border-t border-ink pt-5">
                  <p className="tnum text-fg-3">{s.n}</p>
                  <h3 className="t-h2 mt-6">{s.title}</h3>
                  <p className="mt-3 text-fg-2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Office */}
        <section id="office" className="mx-auto max-w-[1200px] scroll-mt-16 px-5 py-20 md:px-10 md:py-32">
          <p className="t-label text-fg-3">Management office</p>
          <h2 className="mt-4 max-w-[22ch] text-[clamp(32px,5vw,56px)] font-semibold leading-[1.02] tracking-[-0.04em]">Fewer spreadsheets. Fewer phone calls.</h2>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {OFFICE.map(({ Icon, title, body }) => (
              <article key={title}>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-accent-soft text-accent"><Icon size={22} aria-hidden /></span>
                <h3 className="t-h3 mt-5">{title}</h3>
                <p className="mt-2 text-fg-2">{body}</p>
              </article>
            ))}
          </div>
          <p className="t-small mt-12 text-fg-3">Staff and committee members sign in the same way, with the number registered for their role.</p>
        </section>

        {/* Notices */}
        <section id="notices" className="mx-auto max-w-[1200px] scroll-mt-16 px-5 pb-20 md:px-10 md:pb-32">
          <p className="t-label text-fg-3">Notices</p>
          <h2 className="mb-10 mt-4 text-[clamp(28px,4vw,44px)] font-semibold leading-[1.05] tracking-[-0.04em]">Latest from the management office</h2>
          <Suspense fallback={<div className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>}>
            <Notices />
          </Suspense>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-surface-2 scroll-mt-16">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-20 md:grid-cols-[1fr_2fr] md:px-10 md:py-28">
            <h2 className="text-[clamp(28px,4vw,44px)] font-semibold leading-[1.05] tracking-[-0.04em]">Questions</h2>
            <div className="divide-y divide-line-2 border-y border-line-2">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="t-h3 flex cursor-pointer list-none items-center justify-between gap-4">
                    {f.q}
                    <span aria-hidden className="text-fg-3 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-[60ch] text-fg-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-ink text-on-ink">
          <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-8 px-5 py-20 md:flex-row md:items-end md:px-10 md:py-28">
            <h2 className="max-w-[16ch] text-[clamp(36px,6vw,72px)] font-semibold leading-[0.98] tracking-[-0.045em]">Your flat is waiting.</h2>
            <Link href="/login" className={`${buttonClass({ variant: "accent" })} md:h-12 md:px-7`}>Sign in <ArrowRight size={18} aria-hidden /></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-10 text-fg-2 md:flex-row md:items-center md:justify-between md:px-10">
          <span className="flex items-center gap-3"><Logo size={28} /><span className="font-medium text-fg">Isocode Township</span></span>
          <p className="t-small">Management office, Pune. Demo portal: all people and numbers shown are made up.</p>
          <Link href="/login" className="link t-small">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
