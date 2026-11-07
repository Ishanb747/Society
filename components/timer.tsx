"use client";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { fmtMinutes } from "@/lib/format";

/** Counts down to the response target. Rendered after mount so server and client agree. */
export function ResponseTimer({ dueBy, createdAt }: { dueBy: string; createdAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <span className="tnum t-small text-fg-3">&nbsp;</span>;
  const due = new Date(dueBy).getTime();
  const total = due - new Date(createdAt).getTime();
  const left = due - now;
  const breached = left < 0;
  const low = !breached && left < total * 0.25;
  return (
    <span className={clsx("tnum t-small font-medium", breached ? "text-danger" : low ? "text-warn" : "text-fg-2")}>
      {breached ? `Response overdue ${fmtMinutes(-left / 60_000)}` : `Response due in ${fmtMinutes(left / 60_000)}`}
    </span>
  );
}
