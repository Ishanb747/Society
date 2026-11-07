import type { Metadata } from "next";
import Link from "next/link";
import { ComplaintForm } from "@/components/complaint-form";
import { PageHeader } from "@/components/ui";
import { requireResident } from "@/lib/auth";

export const metadata: Metadata = { title: "New complaint" };

export default async function NewComplaint() {
  const { flat } = await requireResident();
  return (
    <div>
      <Link href="/complaints" className="t-small link mb-4 inline-block text-fg-2">← Complaints</Link>
      <PageHeader title="Raise a complaint" eyebrow={flat.id} />
      <ComplaintForm />
    </div>
  );
}
