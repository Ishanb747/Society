import type { Metadata } from "next";
import { ComplaintItem } from "@/components/complaint-item";
import { ButtonLink, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { OPEN_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Complaints" };

export default async function Complaints() {
  const { flat } = await requireResident();
  const all = await db.complaint.findMany({ where: { flatId: flat.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const open = all.filter((c) => OPEN_STATUSES.includes(c.status));
  const past = all.filter((c) => !OPEN_STATUSES.includes(c.status));

  return (
    <div>
      <PageHeader title="Complaints" eyebrow={flat.id} action={<ButtonLink href="/complaints/new" small>New</ButtonLink>} />
      {all.length === 0 ? (
        <EmptyState title="No complaints yet" body="If something needs fixing, tell us here and follow it until it's done." action={<ButtonLink href="/complaints/new">Raise a complaint</ButtonLink>} />
      ) : (
        <>
          {open.length > 0 && <div className="space-y-3">{open.map((c) => <ComplaintItem key={c.id} c={c} />)}</div>}
          {open.length === 0 && <p className="text-fg-2">Nothing open right now.</p>}
          {past.length > 0 && (
            <>
              <SectionTitle>Earlier</SectionTitle>
              <div className="space-y-3">{past.map((c) => <ComplaintItem key={c.id} c={c} />)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
