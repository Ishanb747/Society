"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchFlat } from "@/app/actions/auth";

type Flat = { flatId: string; area: number };

/** Switches the active flat, then refreshes so every screen is re-read with the new session cookie. */
function useSwitch() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (formData: FormData) =>
    start(async () => {
      await switchFlat(formData);
      router.push("/home");
      router.refresh();
    });
  return { run, pending };
}

export function FlatDropdown({ flats, current }: { flats: Flat[]; current: string }) {
  const { run, pending } = useSwitch();
  return (
    <details className="relative">
      <summary className="t-label cursor-pointer list-none rounded-full bg-surface-3 px-3 py-1.5">{current} ▾</summary>
      <form action={run} className="absolute right-0 z-30 mt-2 w-44 rounded-md border border-line bg-surface p-1 shadow-[0_8px_24px_rgba(9,10,10,0.12)]">
        {flats.map((f) => (
          <button key={f.flatId} name="flatId" value={f.flatId} disabled={pending} className="flex h-11 w-full items-center justify-between rounded-sm px-3 text-left text-[15px] hover:bg-surface-2 disabled:opacity-50">
            {f.flatId}
            {f.flatId === current && <span aria-label="current">✓</span>}
          </button>
        ))}
      </form>
    </details>
  );
}

export function FlatList({ flats, current }: { flats: Flat[]; current: string }) {
  const { run, pending } = useSwitch();
  return (
    <form action={run} className="grid gap-2">
      {flats.map((f) => (
        <button key={f.flatId} name="flatId" value={f.flatId} disabled={pending} aria-pressed={f.flatId === current} className={`flex h-12 items-center justify-between rounded-sm border px-4 text-left disabled:opacity-50 ${f.flatId === current ? "border-ink" : "border-line-2"}`}>
          {f.flatId}
          <span className="t-small text-fg-2">{f.area} sq ft{f.flatId === current ? " · current" : ""}</span>
        </button>
      ))}
    </form>
  );
}
