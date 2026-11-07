"use client";
import { Printer } from "lucide-react";
import { buttonClass } from "./ui";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className={buttonClass({ variant: "outline", full: true })}>
      <Printer size={18} aria-hidden /> Print or save as PDF
    </button>
  );
}
