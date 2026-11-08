"use client";
import { useEffect } from "react";
import { ErrorPanel } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return <ErrorPanel reset={reset} message={error.digest ? `We couldn't load this page. Please try again. (ref ${error.digest})` : undefined} />;
}
