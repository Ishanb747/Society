import { Bell, CreditCard, MessageSquarePlus, ReceiptText } from "lucide-react";
import Link from "next/link";
import { setLanguage } from "@/app/actions/auth";
import { ComplaintItem } from "@/components/complaint-item";
import { QuickPay } from "@/components/pay-form";
import { ButtonLink, Card, Chip, SectionTitle } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { formatINR } from "@/lib/billing";
import { OPEN_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { fmtDate, fmtDateLong, fmtMonth } from "@/lib/format";
import { LANGS, LANG_LABEL, getLang, translator } from "@/lib/i18n";
import { loadAccount } from "@/lib/services/ledger";

export default async function Home() {
  const { user, flat } = await requireResident();
  const lang = await getLang();
  const t = translator(lang);
  const [account, open, notices] = await Promise.all([
    loadAccount(flat.id),
    db.complaint.findMany({ where: { flatId: flat.id, status: { in: OPEN_STATUSES } }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.notice.findMany({ orderBy: { publishedAt: "desc" }, take: 3 }),
  ]);
  const unpaid = account.periods.find((p) => p.outstanding > 0);
  const lateFees = account.periods.reduce((s, p) => s + p.lateFeeOutstanding, 0);
  const latest = account.periods.at(-1);
  const paidPct = latest && latest.principal > 0 ? Math.min(100, Math.round(((latest.principal - latest.principalOutstanding) / latest.principal) * 100)) : 0;
  const firstName = user.name.split(" ")[0];
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));

  const actions = [
    { href: "/bills", label: "Pay dues", Icon: CreditCard },
    { href: "/complaints/new", label: t("complaints.raise"), Icon: MessageSquarePlus },
    { href: "/bills", label: "Receipts", Icon: ReceiptText },
    { href: "/more", label: t("notices"), Icon: Bell },
  ];

  return (
    <div>
      <div className="pb-6 pt-2 lg:pb-8">
        <p className="t-label mb-2 text-fg-3">{flat.id} · {flat.areaSqft} sq ft</p>
        <h1 className="t-h1 text-[28px] leading-8 lg:text-[40px] lg:leading-[44px]">{lang === "en" ? (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening") : t("greeting")}, {firstName}</h1>
        <form action={setLanguage} className="-ml-2 mt-2 flex gap-0.5 lg:hidden" aria-label="Language">
          {LANGS.map((l) => (
            <button key={l} name="lang" value={l} aria-pressed={l === lang} className={`t-small h-11 min-w-11 rounded-sm px-2 ${l === lang ? "font-semibold text-fg" : "text-fg-3"}`}>
              {LANG_LABEL[l]}
            </button>
          ))}
        </form>
      </div>

      <div className="lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-12">
        <div>
          {account.totalDue > 0 ? (
            <section className="relative overflow-hidden rounded-md bg-ink p-6 text-on-ink bg-[radial-gradient(120%_140%_at_100%_0%,#14224f_0%,#090a0a_58%)] lg:p-8">
              <p className="t-label text-on-ink-2">
                {t("dues.title")}
                {unpaid ? ` · ${t("dues.dueBy")} ${fmtDate(unpaid.dueDate)}` : ""}
              </p>
              <p className="t-display tnum mt-4 lg:text-[72px]">{formatINR(account.totalDue)}</p>
              <p className="t-small mt-3 text-on-ink-2">
                {account.overdueDays > 0 ? `${account.overdueDays} days ${t("dues.overdue")}` : latest ? `${fmtMonth(latest.period)} bill` : ""}
                {lateFees > 0 && ` · ${t("dues.late")} ${formatINR(lateFees)}`}
              </p>
              {latest && (
                <div className="mt-6">
                  <div className="mb-2 flex justify-between text-[13px] text-on-ink-2"><span>{fmtMonth(latest.period)}</span><span className="tnum">{paidPct}% paid</span></div>
                  <div className="h-1 rounded-full bg-on-ink/15"><div className="h-1 rounded-full bg-on-ink" style={{ width: `${paidPct}%` }} /></div>
                </div>
              )}
              <div className="mt-6"><QuickPay amount={account.totalDue} label={`${t("dues.pay")} · ${formatINR(account.totalDue)}`} /></div>
            </section>
          ) : (
            <section className="rounded-md bg-surface-2 p-6 lg:p-8">
              <p className="t-label text-fg-2">{t("dues.title")}</p>
              <p className="t-display mt-4 flex items-center gap-3 lg:text-[64px]"><span aria-hidden className="text-ok">✓</span> {t("dues.allPaid")}</p>
              <p className="mt-3 text-fg-2">{t("dues.upToDate")}</p>
              {account.credit > 0 && <p className="t-small mt-2 text-fg-2">{formatINR(account.credit)} {t("dues.credit")}</p>}
            </section>
          )}

          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {actions.map(({ href, label, Icon }) => (
              <li key={label}>
                <Link href={href} className="group flex h-full min-h-[92px] flex-col justify-between rounded-md border border-line p-4 transition-[border-color,transform] duration-[280ms] hover:border-ink active:scale-[0.98]">
                  <Icon size={22} strokeWidth={1.75} className="text-fg-2 transition-colors group-hover:text-accent" aria-hidden />
                  <span className="mt-4 text-[15px] font-medium leading-5">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SectionTitle className="lg:!mt-0" action={open.length > 0 ? <Link href="/complaints" className="t-small link text-fg-2">{t("seeAll")}</Link> : undefined}>{t("complaints.open")}</SectionTitle>
          {open.length === 0 ? (
            <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-fg-2">{t("complaints.none")}</p>
              <ButtonLink href="/complaints/new" variant="outline" small>{t("complaints.raise")}</ButtonLink>
            </Card>
          ) : (
            <div className="space-y-3">{open.map((c) => <ComplaintItem key={c.id} c={c} />)}</div>
          )}

          <SectionTitle action={<Link href="/more" className="t-small link text-fg-2">{t("seeAll")}</Link>}>{t("notices")}</SectionTitle>
          <ul className="divide-y divide-line border-y border-line">
            {notices.map((n) => (
              <li key={n.id} className="py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{n.title}</p>
                  <Chip>{fmtDateLong(n.publishedAt).replace(/ \d{4}$/, "")}</Chip>
                </div>
                <p className="t-small mt-1 line-clamp-2 text-fg-2">{n.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
