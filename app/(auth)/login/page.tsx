import type { Metadata } from "next";
import { Building2, ReceiptText, ShieldCheck } from "lucide-react";
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
        <span className="flex items-center gap-3"><Logo /><span className="font-semibold tracking-[-0.02em]">Sahyadri Greens</span></span>
        <div className="my-14 max-w-[400px] lg:my-0">
          <h1 className="t-display">Home, handled.</h1>
          <p className="mb-10 mt-5 text-[17px] leading-7 text-fg-2">Pay maintenance, raise complaints and follow them to the end. One app for all 2,400 flats.</p>
          <LoginForm defaultPhone={phone} />
        </div>
        <p className="t-small text-fg-3">Resident data is personal data under the DPDP Act 2023 and is only used to run your society.</p>
      </section>

      <aside className="bg-ink px-6 py-10 text-on-ink bg-[radial-gradient(90%_70%_at_100%_0%,#14224f_0%,#090a0a_60%)] sm:px-12 lg:px-16 lg:py-12">
        <dl className="grid max-w-[560px] grid-cols-3 gap-6 border-b border-on-ink/15 pb-8">
          {[["2,400", "flats", Building2], ["28", "towers", ShieldCheck], ["₹22 cr", "billed a year", ReceiptText]].map(([n, l, Icon]) => {
            const I = Icon as typeof Building2;
            return (
              <div key={l as string}>
                <I size={18} className="mb-4 text-on-ink-2" aria-hidden />
                <dt className="sr-only">{l as string}</dt>
                <dd className="tnum text-[28px] font-semibold leading-8 tracking-[-0.03em]">{n as string}</dd>
                <p className="t-small mt-1 text-on-ink-2">{l as string}</p>
              </div>
            );
          })}
        </dl>

        <ul className="mt-8 grid max-w-[560px] gap-5">
          {[
            ["Pay maintenance in two taps", "See exactly what you owe and get a receipt straight away."],
            ["Raise a complaint, follow it to the end", "Urgent issues like gas or a stuck lift go straight to the duty manager."],
            ["Notices from the management office", "Water shut-offs, servicing and committee decisions in one place."],
          ].map(([t, d]) => (
            <li key={t} className="border-t border-on-ink/15 pt-4">
              <p className="font-medium">{t}</p>
              <p className="t-small mt-1 text-on-ink-2">{d}</p>
            </li>
          ))}
        </ul>
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
