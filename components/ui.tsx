import { clsx } from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_LABEL, URGENCY_LABEL, type StatusKey, type UrgencyKey } from "@/lib/constants";

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger";
export function buttonClass({ variant = "primary", full, small }: { variant?: Variant; full?: boolean; small?: boolean } = {}) {
  return clsx(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium tracking-[-0.01em] transition-[background,transform,opacity] duration-[160ms] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
    small ? "h-10 px-4 text-[14px]" : "h-12 px-5 text-[16px] md:h-11",
    full && "w-full",
    variant === "primary" && "bg-ink text-on-ink hover:bg-ink-3",
    variant === "accent" && "bg-accent text-white hover:bg-accent-hover",
    variant === "outline" && "border border-ink bg-surface text-fg hover:bg-surface-2",
    variant === "ghost" && "text-fg hover:bg-surface-2",
    variant === "danger" && "border border-danger text-danger hover:bg-danger-soft",
  );
}

export function ButtonLink({ href, children, ...o }: { href: string; children: ReactNode; variant?: Variant; full?: boolean; small?: boolean }) {
  return (
    <Link href={href} className={buttonClass(o)}>
      {children}
    </Link>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("rounded-md border border-line bg-surface p-5", className)}>{children}</section>;
}

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "ink";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-3 text-fg-2",
  accent: "bg-accent-soft text-accent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  ink: "bg-ink text-on-ink",
};
export function Chip({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx("t-label inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1", TONES[tone], className)}>{children}</span>;
}

const STATUS_TONE: Record<StatusKey, Tone> = { NEW: "neutral", ASSIGNED: "accent", IN_PROGRESS: "warn", RESOLVED: "ok", CLOSED: "neutral", REOPENED: "danger" };
export function StatusChip({ status }: { status: StatusKey }) {
  return <Chip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Chip>;
}

const URGENCY_TONE: Record<UrgencyKey, Tone> = { LOW: "neutral", MEDIUM: "neutral", HIGH: "warn", CRITICAL: "danger" };
export function UrgencyChip({ urgency }: { urgency: UrgencyKey }) {
  return <Chip tone={URGENCY_TONE[urgency]}>{URGENCY_LABEL[urgency]}</Chip>;
}

export function PageHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 pb-6 pt-2">
      <div>
        {eyebrow && <p className="t-label mb-2 text-fg-3">{eyebrow}</p>}
        <h1 className="t-h1">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx("mb-3 mt-10 flex items-baseline justify-between", className)}>
      <h2 className="t-h2">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-line-2 px-5 py-10 text-center">
      <p className="t-h3">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-fg-2">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "danger", children }: { tone?: "danger" | "ok" | "warn" | "accent"; children: ReactNode }) {
  const t = { danger: "bg-danger-soft text-danger", ok: "bg-ok-soft text-ok", warn: "bg-warn-soft text-warn", accent: "bg-accent-soft text-accent" }[tone];
  return (
    <p role="status" className={clsx("t-small rounded-sm px-3 py-2.5", t)}>
      {children}
    </p>
  );
}

export const inputClass =
  "block w-full rounded-sm border border-line-2 bg-surface px-3.5 text-[16px] text-fg placeholder:text-fg-3 focus:border-ink focus:outline-none h-12";

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="t-label mb-2 block text-fg-2">
        {label}
      </label>
      {children}
      {hint && !error && <p className="t-small mt-1.5 text-fg-3">{hint}</p>}
      {error && <p className="t-small mt-1.5 text-danger">{error}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("skeleton", className)} />;
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4 pt-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="mt-6 h-44 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

export function ErrorPanel({ reset, message }: { reset?: () => void; message?: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="t-h2">Something went wrong</h1>
      <p className="mt-2 text-fg-2">{message ?? "We couldn't load this page. Your data is safe. Please try again."}</p>
      {reset && (
        <button onClick={reset} className={buttonClass({ variant: "primary" }) + " mt-6"}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Logo({ size = 36, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <span aria-hidden className={clsx("inline-flex items-center justify-center rounded-[10px]", dark ? "bg-on-ink text-ink" : "bg-ink text-on-ink")} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6.5 10.5V19h4v-5h3v5h4v-8.5" />
      </svg>
    </span>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.replace(/\(.*\)/, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}
