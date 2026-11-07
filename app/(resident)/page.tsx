import Link from "next/link";
import { setLanguage } from "@/app/actions/auth";
import { ComplaintItem } from "@/components/complaint-item";
import { QuickPay } from "@/components/pay-form";
import { ButtonLink, Card, Chip, SectionTitle } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { formatINR } from "@/lib/billing";
import { OPEN_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { fmtDate, fmtDateLong } from "@/lib/format";
import { LANGS, LANG_LABEL, getLang, translator } from "@/lib/i18n";
import { loadAccount } from "@/lib/services/ledger";

export default async function Home() {
  const { user, flat } = await requireResident();
  const lang = await getLang();
  const t = translator(lang);
  const [account, open, notices] = await Promise.all([
    loadAccount(flat.id),
    db.complaint.findMany({ where: { flatId: flat.id, status: { in: OPEN_STATUSES } }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.notice.findMany({ orderBy: { publishedAt: "desc" }, take: 3 }),
  ]);
  const unpaid = account.periods.find((p) => p.outstanding > 0);
  const lateFees = account.periods.reduce((s, p) => s + p.lateFeeOutstanding, 0);
  const firstName = user.name.split(" ")[0];

  return (
    <div>
      <div className="flex items-end justify-between gap-4 pb-6 pt-2">
        <div>
          <p className="t-label mb-2 text-fg-3">{flat.id} · {flat.areaSqft} sq ft</p>
          <h1 className="t-h1">{t("greeting")}, {firstName}</h1>
        </div>
        <form action={setLanguage} className="flex gap-0.5" aria-label="Language">
          {LANGS.map((l) => (
            <button key={l} name="lang" value={l} aria-pressed={l === lang} className={`t-small h-11 min-w-11 rounded-sm px-2 ${l === lang ? "font-semibold text-fg" : "text-fg-3"}`}>
              {LANG_LABEL[l]}
            </button>
          ))}
        </form>
      </div>

      {account.totalDue > 0 ? (
        <section className="rounded-md bg-ink p-6 text-on-ink">
          <p className="t-label text-on-ink-2">
            {t("dues.title")}
            {unpaid ? ` · ${t("dues.dueBy")} ${fmtDate(unpaid.dueDate)}` : ""}
          </p>
          <p className="t-display tnum mt-4">{formatINR(account.totalDue)}</p>
          <p className="t-small mt-3 text-on-ink-2">
            {account.overdueDays > 0 ? `${account.overdueDays} days ${t("dues.overdue")}` : unpaid ? `${new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(new Date(unpaid.dueDate))} bill` : ""}
            {lateFees > 0 && ` · ${t("dues.late")} ${formatINR(lateFees)}`}
          </p>
          <div className="mt-6">
            <QuickPay amount={account.totalDue} label={`${t("dues.pay")} · ${formatINR(account.totalDue)}`} />
          </div>
          <Link href="/bills" className="t-small link mt-4 inline-block text-on-ink-2">Bills and receipts</Link>
        </section>
      ) : (
        <section className="rounded-md bg-surface-2 p-6">
          <p className="t-label text-fg-2">{t("dues.title")}</p>
          <p className="t-display mt-4 flex items-center gap-3"><span aria-hidden className="text-ok">✓</span> {t("dues.allPaid")}</p>
          <p className="mt-3 text-fg-2">{t("dues.upToDate")}</p>
          {account.credit > 0 && <p className="t-small mt-2 text-fg-2">{formatINR(account.credit)} {t("dues.credit")}</p>}
          <Link href="/bills" className="t-small link mt-4 inline-block text-fg-2">Bills and receipts</Link>
        </section>
      )}

      <SectionTitle action={open.length > 0 ? <Link href="/complaints" className="t-small link text-fg-2">{t("seeAll")}</Link> : undefined}>{t("complaints.open")}</SectionTitle>
      {open.length === 0 ? (
        <Card className="flex items-center justify-between gap-4">
          <p className="text-fg-2">{t("complaints.none")}</p>
          <ButtonLink href="/complaints/new" variant="outline" small>{t("complaints.raise")}</ButtonLink>
        </Card>
      ) : (
        <div className="space-y-3">
          {open.map((c) => <ComplaintItem key={c.id} c={c} />)}
          <ButtonLink href="/complaints/new" variant="outline" full>{t("complaints.raise")}</ButtonLink>
        </div>
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
  );
}
