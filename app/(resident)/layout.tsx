import { Suspense } from "react";
import { setLanguage, signOut } from "@/app/actions/auth";
import { FlatDropdown } from "@/components/flat-switcher";
import { ResidentSidebarNav, ResidentTabs } from "@/components/nav";
import { Avatar, Logo, PageSkeleton } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { LANGS, LANG_LABEL, getLang, translator } from "@/lib/i18n";

async function Shell({ children }: { children: React.ReactNode }) {
  const { user, flat, memberships } = await requireResident();
  const lang = await getLang();
  const t = translator(lang);
  const labels = { home: t("nav.home"), bills: t("nav.bills"), complaints: t("nav.complaints"), more: t("nav.more") };
  const flats = memberships.map((m) => ({ flatId: m.flatId, area: m.flat.areaSqft }));
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[264px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col justify-between border-r border-line bg-surface-2 p-5 lg:flex print:hidden">
        <div>
          <div className="flex items-center gap-3 px-1 pb-8 pt-1">
            <Logo />
            <div className="leading-tight">
              <p className="font-semibold tracking-[-0.02em]">Sahyadri</p>
              <p className="t-small text-fg-3">Greens</p>
            </div>
          </div>
          <div className="mb-6 flex items-center gap-3 rounded-md border border-line bg-surface p-3">
            <Avatar name={user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{user.name}</p>
              <p className="t-small text-fg-3">{flat.id}</p>
            </div>
          </div>
          {memberships.length > 1 && <div className="mb-4 px-1"><FlatDropdown flats={flats} current={flat.id} /></div>}
          <ResidentSidebarNav labels={labels} />
        </div>
        <div className="space-y-3">
          <form action={setLanguage} className="flex gap-1" aria-label="Language">
            {LANGS.map((l) => (
              <button key={l} name="lang" value={l} aria-pressed={l === lang} className={`t-small h-9 flex-1 rounded-sm ${l === lang ? "bg-surface font-semibold text-fg shadow-[0_0_0_1px_var(--line-1)]" : "text-fg-3 hover:text-fg"}`}>
                {LANG_LABEL[l]}
              </button>
            ))}
          </form>
          <form action={signOut}><button className="t-small h-10 w-full rounded-sm text-fg-2 hover:bg-surface-3">Sign out</button></form>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile header */}
        <header className="mx-auto flex w-full max-w-[560px] items-center justify-between px-5 pt-5 lg:hidden print:hidden">
          <span className="flex items-center gap-2.5"><Logo size={30} /><span className="t-label text-fg-2">Sahyadri Greens</span></span>
          {memberships.length > 1 ? <FlatDropdown flats={flats} current={flat.id} /> : <p className="t-label text-fg-2">{flat.id}</p>}
        </header>
        <main className="mx-auto w-full max-w-[560px] px-5 pb-28 pt-4 lg:max-w-[1080px] lg:px-12 lg:pb-16 lg:pt-10" data-user={user.id}>
          {children}
        </main>
        <ResidentTabs labels={labels} />
      </div>
    </div>
  );
}

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-[560px] px-5 pt-16"><PageSkeleton /></div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
