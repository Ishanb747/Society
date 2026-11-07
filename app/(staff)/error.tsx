"use client";
import { ErrorPanel } from "@/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <ErrorPanel reset={reset} />;
}
