import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/ui";
import { homeFor } from "@/lib/access";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

async function Content({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const s = await getSession();
  if (s) redirect(s.k === "staff" ? homeFor(s.role) : "/home");
  const raw = (await searchParams).phone;
  const phone = typeof raw === "string" && /^\d{10}$/.test(raw) ? raw : undefined;

  return (
    <main className="grid min-h-screen flex-1 lg:grid-cols-[minmax(420px,5fr)_6fr]">
      <section className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16 lg:py-12">
        <span className="flex items-center gap-3"><Logo /><span className="font-semibold tracking-[-0.02em]">Society</span></span>
        <div className="my-14 max-w-[400px] lg:my-0">
          <h1 className="t-display">Home, handled.</h1>
          <p className="mb-10 mt-5 text-[17px] leading-7 text-fg-2">Pay maintenance, raise complaints and follow them to the end. One app for all 2,400 flats.</p>
          <LoginForm defaultPhone={phone} />
        </div>
        <p className="t-small text-fg-3">Resident data is personal data under the DPDP Act 2023 and is only used to run your society.</p>
      </section>

      <aside className="relative flex flex-col justify-between gap-16 overflow-hidden bg-ink bg-[radial-gradient(90%_70%_at_100%_0%,#14224f_0%,#090a0a_60%)] px-6 py-12 text-on-ink sm:px-12 lg:min-h-screen lg:px-16 lg:py-12">
        <p className="t-label text-on-ink-2">Society · Pune</p>

        <div>
          <h2 className="max-w-[14ch] text-[clamp(36px,4.2vw,64px)] font-semibold leading-[1] tracking-[-0.045em]">Everything about your flat, <span className="text-on-ink-2">in one place.</span></h2>
          <ul className="mt-12 grid max-w-[520px] gap-0">
            {[
              ["Pay maintenance in two taps", "See exactly what you owe and get a receipt straight away."],
              ["Raise a complaint, follow it to the end", "Urgent issues like gas or a stuck lift go straight to the duty manager."],
              ["Notices from the management office", "Water shut-offs, servicing and committee decisions."],
            ].map(([t, d]) => (
              <li key={t} className="border-t border-on-ink/15 py-4 last:border-b">
                <p className="font-medium">{t}</p>
                <p className="t-small mt-1 text-on-ink-2">{d}</p>
              </li>
            ))}
          </ul>
        </div>

        <dl className="grid max-w-[520px] grid-cols-3 gap-6">
          {[["2,400", "flats"], ["28", "towers"], ["₹22 cr", "billed a year"]].map(([n, l]) => (
            <div key={l} className="flex flex-col-reverse">
              <dt className="t-small mt-1 text-on-ink-2">{l}</dt>
              <dd className="tnum text-[32px] font-semibold leading-9 tracking-[-0.04em]">{n}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </main>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
