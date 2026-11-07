import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { DEMO_OTP } from "@/lib/constants";
import { homeFor } from "@/lib/access";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

const DEMO = [
  { who: "Resident, paid up", name: "Neeraj Kulkarni", phone: "9000000001" },
  { who: "Tenant, overdue, open complaint", name: "Swati Joshi", phone: "9000000002" },
  { who: "Resident, part paid", name: "Aamir Shaikh", phone: "9000000003" },
  { who: "Owns two flats", name: "Meera Kapoor", phone: "9000000004" },
  { who: "Help desk and accounts", name: "Anita Deshmukh", phone: "9000000010" },
  { who: "Committee", name: "Rajan Phadke", phone: "9000000020" },
];

async function Redirector() {
  const s = await getSession();
  if (s) redirect(s.k === "staff" ? homeFor(s.role) : "/");
  return null;
}

export default function LoginPage() {
  return (
    <main className="mx-auto grid w-full max-w-[1000px] flex-1 gap-12 px-5 py-10 md:grid-cols-2 md:gap-20 md:px-10 md:py-20">
      <Suspense><Redirector /></Suspense>
      <section className="flex flex-col justify-between gap-12">
        <p className="t-label text-fg-2">Isocode Township</p>
        <div>
          <h1 className="t-display">Home, handled.</h1>
          <p className="mt-5 max-w-sm text-fg-2">Pay maintenance, raise complaints and follow them to the end. One app for all 2,400 flats.</p>
        </div>
        <div className="max-w-sm">
          <LoginForm demoOtp={DEMO_OTP} />
        </div>
      </section>
      <aside className="self-end">
        <p className="t-label mb-3 text-fg-3">Demo accounts · code {DEMO_OTP}</p>
        <ul className="divide-y divide-line border-y border-line">
          {DEMO.map((d) => (
            <li key={d.phone} className="flex items-baseline justify-between gap-4 py-3">
              <span>
                <span className="block font-medium">{d.name}</span>
                <span className="t-small text-fg-2">{d.who}</span>
              </span>
              <span className="tnum t-small text-fg-2">{d.phone}</span>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
