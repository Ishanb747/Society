"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { confirmRow, ignoreRow, importStatement, type ImportSummary } from "@/lib/services/bank";
import { MAX_CSV_BYTES, flatIdSchema } from "@/lib/validation";

export type UploadState = { error?: string; summary?: ImportSummary };

export async function uploadStatement(_: UploadState, formData: FormData): Promise<UploadState> {
  const staff = await requireStaff("payments");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file first." };
  if (file.size > MAX_CSV_BYTES) return { error: "That file is over 2 MB. Export a shorter date range." };
  if (!/\.csv$/i.test(file.name) && !file.type.includes("csv") && !file.type.includes("excel") && file.type !== "text/plain") return { error: "Please upload a .csv bank statement." };
  const summary = await importStatement(file.name.slice(0, 120), await file.text(), staff.id);
  revalidatePath("/desk/payments");
  revalidatePath("/committee");
  if (summary.total === 0 && !summary.alreadyImported && !summary.duplicatesSkipped) {
    return { error: summary.errors[0] ?? "No credit rows found in that file.", summary };
  }
  return { summary };
}

export type ResolveState = { error?: string; ok?: boolean };

export async function confirmBankRow(_: ResolveState, formData: FormData): Promise<ResolveState> {
  const staff = await requireStaff("payments");
  const rowId = z.string().min(1).parse(formData.get("rowId"));
  const flat = flatIdSchema.safeParse(formData.get("flatId"));
  if (!flat.success) return { error: flat.error.issues[0].message };
  const r = await confirmRow(rowId, flat.data, staff.id);
  revalidatePath("/desk/payments");
  revalidatePath("/committee");
  return r.ok ? { ok: true } : { error: r.error };
}

export async function ignoreBankRow(_: ResolveState, formData: FormData): Promise<ResolveState> {
  const staff = await requireStaff("payments");
  const r = await ignoreRow(z.string().min(1).parse(formData.get("rowId")), staff.id);
  revalidatePath("/desk/payments");
  return r.ok ? { ok: true } : { error: r.error };
}
