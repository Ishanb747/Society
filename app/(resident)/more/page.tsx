import type { Metadata } from "next";
import { setLanguage, signOut } from "@/app/actions/auth";
import { FlatList } from "@/components/flat-switcher";
import { Card, Chip, PageHeader, SectionTitle, buttonClass } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateLong } from "@/lib/format";
import { LANGS, LANG_LABEL, getLang } from "@/lib/i18n";

export const metadata: Metadata = { title: "More" };

export default async function More() {
  const { user, flat, memberships } = await requireResident();
  const lang = await getLang();
  const [household, notices] = await Promise.all([
    db.membership.findMany({ where: { flatId: flat.id }, include: { user: true }, orderBy: { kind: "asc" } }),
    db.notice.findMany({ orderBy: { publishedAt: "desc" } }),
  ]);
  return (
    <div>
      <PageHeader title="More" eyebrow={user.name} />

      <Card>
        <p className="t-label text-fg-2">Household · {flat.id}</p>
        <ul className="mt-3 divide-y divide-line">
          {household.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3">
              <span className="font-medium">{m.user.name}{m.userId === user.id && <span className="text-fg-3"> (you)</span>}</span>
              <Chip>{m.kind === "OWNER" ? "Owner" : m.kind === "TENANT" ? "Tenant" : "Family"}</Chip>
            </li>
          ))}
        </ul>
      </Card>

      {memberships.length > 1 && (
        <>
          <SectionTitle>Your flats</SectionTitle>
          <FlatList flats={memberships.map((m) => ({ flatId: m.flatId, area: m.flat.areaSqft }))} current={flat.id} />
        </>
      )}

      <SectionTitle>Language</SectionTitle>
      <form action={setLanguage} className="grid grid-cols-3 gap-2">
        {LANGS.map((l) => (
          <button key={l} name="lang" value={l} aria-pressed={l === lang} className={`h-12 rounded-sm border text-[15px] font-medium ${l === lang ? "border-ink bg-ink text-on-ink" : "border-line-2"}`}>{LANG_LABEL[l]}</button>
        ))}
      </form>
      <p className="t-small mt-2 text-fg-3">Home and the tab bar are translated in this version.</p>

      <SectionTitle>Notices</SectionTitle>
      <ul className="divide-y divide-line border-y border-line">
        {notices.map((n) => (
          <li key={n.id} className="py-4">
            <p className="t-small text-fg-3">{fmtDateLong(n.publishedAt)}</p>
            <p className="mt-1 font-medium">{n.title}</p>
            <p className="t-small mt-1 text-fg-2">{n.body}</p>
          </li>
        ))}
      </ul>

      <form action={signOut} className="mt-10"><button className={buttonClass({ variant: "outline", full: true })}>Sign out</button></form>
    </div>
  );
}
