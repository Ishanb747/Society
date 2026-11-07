import { Suspense } from "react";
import { FlatDropdown } from "@/components/flat-switcher";
import { ResidentTabs } from "@/components/nav";
import { PageSkeleton } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { getLang, translator } from "@/lib/i18n";

async function Shell({ children }: { children: React.ReactNode }) {
  const { user, flat, memberships } = await requireResident();
  const t = translator(await getLang());
  return (
    <>
      <header className="mx-auto flex w-full max-w-[560px] items-center justify-between px-5 pt-5 print:hidden">
        <p className="t-label text-fg-2">Isocode Township</p>
        {memberships.length > 1 ? (
          <FlatDropdown flats={memberships.map((m) => ({ flatId: m.flatId, area: m.flat.areaSqft }))} current={flat.id} />
        ) : (
          <p className="t-label text-fg-2">{flat.id}</p>
        )}
      </header>
      <main className="mx-auto w-full max-w-[560px] flex-1 px-5 pb-28 pt-4" data-user={user.id}>
        {children}
      </main>
      <ResidentTabs labels={{ home: t("nav.home"), bills: t("nav.bills"), complaints: t("nav.complaints"), more: t("nav.more") }} />
    </>
  );
}

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-[560px] px-5 pt-16"><PageSkeleton /></div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
