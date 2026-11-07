"use client";
import { useActionState, useState } from "react";
import { startPayment, type PayState } from "@/app/actions/payments";
import { SubmitButton } from "./submit-button";
import { Field, Notice, inputClass } from "./ui";
import { formatINR } from "@/lib/billing";

/** One-tap payment of the full amount from the home screen. */
export function QuickPay({ amount, label }: { amount: number; label: string }) {
  const [state, action] = useActionState(startPayment, {} as PayState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="amount" value={amount} />
      <SubmitButton variant="accent" full pending="Opening checkout…">{label}</SubmitButton>
      {state.error && <Notice>{state.error}</Notice>}
    </form>
  );
}

export function PayForm({ total }: { total: number }) {
  const [state, action] = useActionState(startPayment, {} as PayState);
  const [custom, setCustom] = useState(false);
  return (
    <form action={action} className="space-y-4">
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Amount</legend>
        <label className={`flex h-12 cursor-pointer items-center justify-center rounded-sm border text-[15px] font-medium ${!custom ? "border-ink bg-ink text-on-ink" : "border-line-2"}`}>
          <input type="radio" name="mode" className="sr-only" checked={!custom} onChange={() => setCustom(false)} />
          Pay full {formatINR(total)}
        </label>
        <label className={`flex h-12 cursor-pointer items-center justify-center rounded-sm border text-[15px] font-medium ${custom ? "border-ink bg-ink text-on-ink" : "border-line-2"}`}>
          <input type="radio" name="mode" className="sr-only" checked={custom} onChange={() => setCustom(true)} />
          Other amount
        </label>
      </fieldset>
      {custom ? (
        <Field label="Amount (₹)" htmlFor="amount" error={state.error} hint={`Up to ${formatINR(total)}`}>
          <input id="amount" name="amount" type="number" inputMode="numeric" min={1} max={total} step={1} defaultValue={Math.min(total, 1000)} className={inputClass + " tnum"} required />
        </Field>
      ) : (
        <>
          <input type="hidden" name="amount" value={total} />
          {state.error && <Notice>{state.error}</Notice>}
        </>
      )}
      <SubmitButton variant="accent" full pending="Opening checkout…">Pay now</SubmitButton>
    </form>
  );
}
