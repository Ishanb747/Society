"use client";
import { useActionState } from "react";
import { requestOtp, verifyOtp, type LoginState } from "@/app/actions/auth";
import { SubmitButton } from "./submit-button";
import { Field, inputClass } from "./ui";

export function LoginForm({ defaultPhone }: { defaultPhone?: string }) {
  const [state, action] = useActionState(requestOtp, { step: "phone" } as LoginState);
  if (state.step === "otp" && state.phone) return <OtpStep phone={state.phone} />;
  return (
    <form action={action} className="space-y-5" noValidate>
      <Field label="Mobile number" htmlFor="phone" hint="The number linked to your flat" error={state.error}>
        <input id="phone" name="phone" inputMode="numeric" autoComplete="tel" placeholder="98765 43210" defaultValue={defaultPhone} key={defaultPhone} className={inputClass + " tnum"} required />
      </Field>
      <SubmitButton full pending="Sending…">Send code</SubmitButton>
    </form>
  );
}

function OtpStep({ phone }: { phone: string }) {
  const [state, action] = useActionState(verifyOtp, { step: "otp", phone } as LoginState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="phone" value={phone} />
      <Field label={`Code for ${phone}`} htmlFor="otp" error={state.error}>
        <input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" className={inputClass + " tnum tracking-[0.3em]"} autoFocus required />
      </Field>
      <SubmitButton full pending="Checking…">Sign in</SubmitButton>
      <a href="/login" className="t-small link block text-center text-fg-2">Use a different number</a>
    </form>
  );
}
