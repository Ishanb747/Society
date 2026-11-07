"use client";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./ui";

export function SubmitButton({
  children,
  pending: pendingLabel,
  variant = "primary",
  full,
  small,
  name,
  value,
}: {
  children: React.ReactNode;
  pending?: string;
  variant?: "primary" | "accent" | "outline" | "ghost" | "danger";
  full?: boolean;
  small?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending} className={buttonClass({ variant, full, small })}>
      {pending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}
