"use client";
import { useActionState } from "react";
import { uploadStatement, type UploadState } from "@/app/actions/bank";
import { SubmitButton } from "./submit-button";
import { Notice, inputClass } from "./ui";

export function BankUpload() {
  const [state, action] = useActionState(uploadStatement, {} as UploadState);
  const s = state.summary;
  return (
    <div>
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="t-label mb-2 block text-fg-2">Bank statement (CSV)</span>
          <input type="file" name="file" accept=".csv,text/csv" required className={inputClass + " py-2.5 file:mr-3 file:rounded-sm file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-[14px] file:font-medium"} />
        </label>
        <SubmitButton pending="Matching…">Upload and match</SubmitButton>
      </form>
      <p className="t-small mt-2 text-fg-3">
        No file handy? <a href="/samples/bank-statement.csv" download className="link font-medium text-fg">Download the sample statement</a>.
      </p>
      <div aria-live="polite" className="mt-4 space-y-3">
        {state.error && <Notice>{state.error}</Notice>}
        {s && s.alreadyImported && <Notice tone="warn">This exact file was already imported, so nothing was posted twice.</Notice>}
        {s && !s.alreadyImported && !state.error && (
          <>
            <Notice tone="ok">
              Matched {s.total} credits: <b>{s.autoPosted}</b> posted automatically, <b>{s.review}</b> need a look, <b>{s.unmatched}</b> unmatched.
              {s.duplicatesSkipped > 0 && ` ${s.duplicatesSkipped} duplicate row${s.duplicatesSkipped > 1 ? "s" : ""} skipped.`}
              {s.debitsSkipped > 0 && ` ${s.debitsSkipped} debit${s.debitsSkipped > 1 ? "s" : ""} ignored.`}
            </Notice>
            {s.errors.length > 0 && <Notice tone="warn">{s.errors.length} row{s.errors.length > 1 ? "s" : ""} couldn&apos;t be read: {s.errors.slice(0, 2).join(" ")}</Notice>}
          </>
        )}
      </div>
    </div>
  );
}
