"use client";
import { useActionState } from "react";
import { confirmBankRow, ignoreBankRow, type ResolveState } from "@/app/actions/bank";
import { formatINR } from "@/lib/billing";
import { SubmitButton } from "./submit-button";
import { Chip, Notice, inputClass } from "./ui";

export interface RowView {
  id: string; date: string; amount: number; narration: string; status: "REVIEW" | "UNMATCHED";
  reasons: string[]; suggested: { flatId: string; who: string } | null; others: { flatId: string; who: string; score: number }[];
}

export function BankRowCard({ row }: { row: RowView }) {
  const [confirmState, confirm] = useActionState(confirmBankRow, {} as ResolveState);
  const [ignoreState, ignore] = useActionState(ignoreBankRow, {} as ResolveState);
  const done = confirmState.ok || ignoreState.ok;
  const error = confirmState.error ?? ignoreState.error;
  if (done) return <li className="py-4"><Notice tone="ok">{confirmState.ok ? "Posted to the flat's ledger." : "Marked as not a maintenance payment."}</Notice></li>;

  return (
    <li className="py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="t-h3 tnum">{formatINR(row.amount)}</p>
        <p className="t-small text-fg-3">{row.date}</p>
      </div>
      <p className="mt-1 break-words font-mono text-[13px] leading-5 text-fg-2">{row.narration}</p>
      <p className="mt-2 flex flex-wrap gap-1.5">
        <Chip tone={row.status === "REVIEW" ? "warn" : "neutral"}>{row.status === "REVIEW" ? "Needs review" : "Unmatched"}</Chip>
        {row.reasons.map((r) => <Chip key={r}>{r}</Chip>)}
      </p>

      <div className="mt-4 space-y-3">
        {row.suggested && (
          <form action={confirm} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="rowId" value={row.id} />
            <input type="hidden" name="flatId" value={row.suggested.flatId} />
            <SubmitButton variant="accent" small pending="Posting…">Post to {row.suggested.flatId}</SubmitButton>
            <span className="t-small text-fg-2">{row.suggested.who}</span>
          </form>
        )}
        {row.others.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-small text-fg-3">Or:</span>
            {row.others.map((o) => (
              <form key={o.flatId} action={confirm}>
                <input type="hidden" name="rowId" value={row.id} /><input type="hidden" name="flatId" value={o.flatId} />
                <SubmitButton variant="outline" small pending="…">{o.flatId} · {o.who}</SubmitButton>
              </form>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <form action={confirm} className="flex items-end gap-2">
            <input type="hidden" name="rowId" value={row.id} />
            <label><span className="sr-only">Flat ID</span>
              <input name="flatId" placeholder="Other flat, e.g. T12-0408" pattern="[Tt]\d{2}-\d{4}" required className={inputClass + " h-10 w-56 text-[15px]"} />
            </label>
            <SubmitButton variant="outline" small pending="Posting…">Post</SubmitButton>
          </form>
          <form action={ignore}>
            <input type="hidden" name="rowId" value={row.id} />
            <SubmitButton variant="ghost" small pending="…">Not a maintenance payment</SubmitButton>
          </form>
        </div>
        {error && <Notice>{error}</Notice>}
      </div>
    </li>
  );
}
