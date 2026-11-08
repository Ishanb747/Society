import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { StaffTabs } from "@/components/nav";
import { PageSkeleton } from "@/components/ui";
import { staffCan } from "@/lib/access";
import { requireStaff } from "@/lib/auth";

const ROLE_LABEL = { HELPDESK: "Help desk", COMMITTEE: "Committee", DUTY_MANAGER: "Duty manager", TECHNICIAN: "Technician" } as const;

async function Shell({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const items = [
    ...(staffCan(staff.role, "desk") ? [{ href: "/desk", label: "Complaints" }] : []),
    ...(staffCan(staff.role, "payments") ? [{ href: "/desk/payments", label: "Payments" }] : []),
    ...(staffCan(staff.role, "committee") ? [{ href: "/committee", label: "Committee" }] : []),
  ];
  return (
    <>
      <div className="bg-ink text-on-ink">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 pt-4 md:px-10 md:pb-4">
          <div className="flex items-baseline gap-3">
            <p className="t-label text-on-ink-2">Society</p>
            <p className="t-label text-on-ink-2">· {ROLE_LABEL[staff.role]}</p>
          </div>
          <form action={signOut}>
            <button className="t-small h-11 text-on-ink-2 hover:text-on-ink">Sign out</button>
          </form>
          <div className="w-full md:order-none md:w-auto md:flex-1"><StaffTabs items={items} /></div>
        </div>
      </div>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 pb-16 pt-6 md:px-10">{children}</main>
    </>
  );
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-[1200px] px-5 pt-16 md:px-10"><PageSkeleton /></div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
