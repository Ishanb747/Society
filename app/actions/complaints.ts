"use server";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireResident, requireStaff } from "@/lib/auth";
import { classifyComplaint } from "@/lib/complaints/classify";
import { type CategoryKey, type StatusKey } from "@/lib/constants";
import { tooMany } from "@/lib/rate-limit";
import { addNote, assignTo, createComplaint, rateAndClose, recategorise, reopen, resolveLinked, setStatus } from "@/lib/services/complaints";
import { db } from "@/lib/db";
import { categorySchema, complaintTextSchema, noteSchema, photoDataUrlSchema, ratingSchema, statusSchema } from "@/lib/validation";

export type SuggestState = { category: CategoryKey; urgency: string; safety: boolean; unsure: boolean; by: string } | null;

/** Live hint while the resident types. Never blocks submission and is only a suggestion. */
export async function suggestClassification(text: string): Promise<SuggestState> {
  const { user } = await requireResident();
  const parsed = complaintTextSchema.safeParse(text);
  if (!parsed.success || tooMany(`suggest:${user.id}`, 20, 60_000)) return null;
  const c = await classifyComplaint(parsed.data);
  return { category: c.category, urgency: c.urgency, safety: c.safetyEscalated, unsure: c.needsReview, by: c.classifiedBy };
}

export type ComplaintFormState = { error?: string };

export async function submitComplaint(_: ComplaintFormState, formData: FormData): Promise<ComplaintFormState> {
  const { user, flat } = await requireResident();
  if (tooMany(`complaint:${user.id}`, 10, 10 * 60_000)) return { error: "You're sending complaints very quickly. Please wait a few minutes." };
  const text = complaintTextSchema.safeParse(formData.get("text"));
  if (!text.success) return { error: text.error.issues[0].message };

  let photoUrl: string | null = null;
  const rawPhoto = formData.get("photo");
  if (typeof rawPhoto === "string" && rawPhoto) {
    const photo = photoDataUrlSchema.safeParse(rawPhoto);
    if (!photo.success) return { error: photo.error.issues[0].message };
    photoUrl = photo.data;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const [, mime, b64] = photo.data.match(/^data:(image\/\w+);base64,(.+)$/)!;
        const blob = await put(`complaints/${flat.id}/${randomUUID()}.${mime.split("/")[1]}`, Buffer.from(b64, "base64"), { access: "public", contentType: mime });
        photoUrl = blob.url;
      } catch {
        /* keep the small inline copy rather than losing the photo */
      }
    }
  }
  const c = await createComplaint({ userId: user.id, flatId: flat.id, text: text.data, photoUrl });
  revalidatePath("/complaints");
  revalidatePath("/home");
  redirect(`/complaints/${c.id}`);
}

export async function rateComplaint(formData: FormData) {
  const { flat } = await requireResident();
  const id = z.string().min(1).parse(formData.get("id"));
  const rating = ratingSchema.parse(formData.get("rating"));
  await rateAndClose(id, flat.id, rating);
  revalidatePath(`/complaints/${id}`);
  revalidatePath("/complaints");
}

export async function reopenComplaint(formData: FormData) {
  const { flat } = await requireResident();
  const id = z.string().min(1).parse(formData.get("id"));
  const reason = noteSchema.parse(formData.get("reason") || undefined);
  await reopen(id, flat.id, reason);
  revalidatePath(`/complaints/${id}`);
  revalidatePath("/complaints");
  revalidatePath("/desk");
}

// ---- help desk ----
function refresh(id: string) {
  revalidatePath("/desk");
  revalidatePath(`/desk/${id}`);
  revalidatePath("/committee");
}

export async function changeCategory(formData: FormData) {
  const staff = await requireStaff("desk");
  const id = z.string().min(1).parse(formData.get("id"));
  await recategorise(id, categorySchema.parse(formData.get("category")), staff.id);
  refresh(id);
}

export async function changeStatus(formData: FormData) {
  const staff = await requireStaff("desk");
  const id = z.string().min(1).parse(formData.get("id"));
  const status: StatusKey = statusSchema.parse(formData.get("status"));
  await setStatus(id, status, staff.id, noteSchema.parse(formData.get("note") || undefined));
  refresh(id);
}

export async function assignComplaint(formData: FormData) {
  const staff = await requireStaff("desk");
  const id = z.string().min(1).parse(formData.get("id"));
  const assigneeId = z.string().min(1).parse(formData.get("assigneeId"));
  await assignTo(id, assigneeId, staff.id);
  refresh(id);
}

export async function addComplaintNote(formData: FormData) {
  const staff = await requireStaff("desk");
  const id = z.string().min(1).parse(formData.get("id"));
  const note = z.string().trim().min(1).max(500).parse(formData.get("note"));
  await addNote(id, note, staff.id);
  refresh(id);
}

export async function resolveLinkedComplaints(formData: FormData) {
  const staff = await requireStaff("desk");
  const id = z.string().min(1).parse(formData.get("id"));
  await resolveLinked(id, staff.id);
  refresh(id);
}

export async function dismissReview(formData: FormData) {
  await requireStaff("desk");
  const id = z.string().min(1).parse(formData.get("id"));
  await db.complaint.update({ where: { id }, data: { needsReview: false } });
  refresh(id);
}
