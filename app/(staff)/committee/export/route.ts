import { connection } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getDashboard } from "@/lib/services/dashboard";

export async function GET() {
  await connection();
  await requireStaff("committee");
  const d = await getDashboard();
  const lines = [
    "Month,Billed (Rs),Collected (Rs),Collection %,Bills,Paid on time",
    ...d.byMonth.map((m) => [m.period, m.billed, m.collected, m.billed ? Math.round((m.collected / m.billed) * 100) : 0, m.billedCount, m.onTime].join(",")),
    "",
    "Ageing bucket,Outstanding (Rs),Bills",
    ...d.ageing.map((a) => [a.label, a.amount, a.bills].join(",")),
  ];
  return new Response(lines.join("\n") + "\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="committee-report.csv"' },
  });
}
