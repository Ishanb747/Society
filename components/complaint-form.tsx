"use client";
import { Camera, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { submitComplaint, suggestClassification, type ComplaintFormState, type SuggestState } from "@/app/actions/complaints";
import { CATEGORY_LABEL, URGENCY_LABEL, type UrgencyKey } from "@/lib/constants";
import { SubmitButton } from "./submit-button";
import { Chip, Field, Notice, buttonClass } from "./ui";

async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  for (const q of [0.7, 0.5, 0.35]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length < 560_000) return url;
  }
  throw new Error("too large");
}

export function ComplaintForm() {
  const [state, action] = useActionState(submitComplaint, {} as ComplaintFormState);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState("");
  const [photoErr, setPhotoErr] = useState("");
  const [hint, setHint] = useState<SuggestState>(null);
  const [, start] = useTransition();
  const seq = useRef(0);
  const shown = text.trim().length >= 15 ? hint : null; // a stale hint is never shown for short text

  // Ask for a category suggestion once the resident pauses typing.
  useEffect(() => {
    if (text.trim().length < 15) return;
    const mine = ++seq.current;
    const id = setTimeout(() => start(async () => {
      const r = await suggestClassification(text);
      if (mine === seq.current) setHint(r);
    }), 900);
    return () => clearTimeout(id);
  }, [text]);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setPhotoErr("");
    if (!f) return;
    try {
      setPhoto(await shrink(f));
    } catch {
      setPhoto("");
      setPhotoErr("We couldn't use that photo. Try another one.");
    }
  }

  return (
    <form action={action} className="space-y-6">
      <Field label="What's the problem?" htmlFor="text" error={state.error} hint="English, मराठी or हिन्दी all work.">
        <textarea
          id="text" name="text" rows={5} required minLength={10} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Water is leaking from the bathroom ceiling since last night"
          className="block w-full resize-y rounded-sm border border-line-2 bg-surface p-3.5 text-[16px] placeholder:text-fg-3 focus:border-ink focus:outline-none"
        />
      </Field>

      <div aria-live="polite" className="min-h-[44px]">
        {shown?.safety ? (
          <Notice tone="danger">This sounds urgent. The duty manager will be alerted straight away.</Notice>
        ) : shown && !shown.unsure ? (
          <p className="t-small flex flex-wrap items-center gap-2 text-fg-2">
            Looks like <Chip tone="accent">{CATEGORY_LABEL[shown.category]}</Chip> <Chip>{URGENCY_LABEL[shown.urgency as UrgencyKey]}</Chip>
            <span className="text-fg-3">The help desk can change this.</span>
          </p>
        ) : shown ? (
          <p className="t-small text-fg-2">We&apos;re not sure which team this is for, so the help desk will sort it. You don&apos;t need to do anything.</p>
        ) : null}
      </div>

      <div>
        <p className="t-label mb-2 text-fg-2">Photo (optional)</p>
        {photo ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Attached" className="h-32 w-auto rounded-sm border border-line" />
            <button type="button" onClick={() => setPhoto("")} aria-label="Remove photo" className="absolute -right-3 -top-3 flex size-11 items-center justify-center rounded-full bg-ink text-on-ink">
              <X size={18} />
            </button>
          </div>
        ) : (
          <label className={buttonClass({ variant: "outline" }) + " cursor-pointer"}>
            <Camera size={20} aria-hidden /> Add a photo
            <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="sr-only" />
          </label>
        )}
        {photoErr && <p className="t-small mt-2 text-danger">{photoErr}</p>}
        <input type="hidden" name="photo" value={photo} />
      </div>

      <SubmitButton full pending="Sending…">Send complaint</SubmitButton>
    </form>
  );
}
