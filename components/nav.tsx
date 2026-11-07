"use client";
import { clsx } from "clsx";
import { Home, Menu, MessageSquareWarning, ReceiptText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function ResidentTabs({ labels }: { labels: { home: string; bills: string; complaints: string; more: string } }) {
  const path = usePathname();
  const items = [
    { href: "/", label: labels.home, Icon: Home, match: (p: string) => p === "/" },
    { href: "/bills", label: labels.bills, Icon: ReceiptText, match: (p: string) => p.startsWith("/bills") || p.startsWith("/pay") || p.startsWith("/receipts") },
    { href: "/complaints", label: labels.complaints, Icon: MessageSquareWarning, match: (p: string) => p.startsWith("/complaints") },
    { href: "/more", label: labels.more, Icon: Menu, match: (p: string) => p.startsWith("/more") },
  ];
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-[560px] grid-cols-4">
        {items.map(({ href, label, Icon, match }) => {
          const active = match(path);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={clsx("relative flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-medium", active ? "text-fg" : "text-fg-3")}>
                {active && <span className="absolute inset-x-6 top-0 h-0.5 bg-ink" />}
                <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function StaffTabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
      <ul className="flex gap-1">
        {items.map((i) => {
          const active = i.href === "/desk" ? path === "/desk" || /^\/desk\/(?!payments)/.test(path) : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={active ? "page" : undefined} className={clsx("flex h-11 items-center whitespace-nowrap rounded-sm px-4 text-[15px] font-medium", active ? "bg-on-ink/10 text-on-ink" : "text-on-ink-2 hover:text-on-ink")}>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
