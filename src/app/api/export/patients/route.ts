import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { htmlToPdf } from "@/lib/pdf";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  await requireRole("DOCTOR");

  const sp         = req.nextUrl.searchParams;
  const hospitalId = sp.get("hospitalId") || undefined;
  const category   = sp.get("category")   || undefined;
  const sex        = sp.get("sex")        || undefined;
  const ageMin     = sp.get("ageMin") ? Number(sp.get("ageMin")) : undefined;
  const ageMax     = sp.get("ageMax") ? Number(sp.get("ageMax")) : undefined;
  const fromDate   = sp.get("fromDate") || undefined;
  const toDate     = sp.get("toDate")   || undefined;

  const where: any = hospitalId ? { registeredAtId: hospitalId } : {};
  if (category) where.category = category;
  if (sex)      where.sex = sex;
  if (ageMin !== undefined || ageMax !== undefined) {
    where.age = {};
    if (ageMin !== undefined) where.age.gte = ageMin;
    if (ageMax !== undefined) where.age.lte = ageMax;
  }
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate)   where.createdAt.lte = new Date(toDate + "T23:59:59");
  }

  const patients = await prisma.patient.findMany({
    where,
    select: { name: true, udid: true, uhid: true, age: true, sex: true, mobile: true, category: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  const hospitalName = hospitalId
    ? (await prisma.hospital.findUnique({ where: { id: hospitalId }, select: { name: true } }))?.name ?? "All Hospitals"
    : "All Hospitals";

  const filterParts: string[] = [];
  if (hospitalId) filterParts.push(`Hospital: ${hospitalName}`);
  if (category)   filterParts.push(`Category: ${category}`);
  if (sex)        filterParts.push(`Sex: ${sex}`);
  if (ageMin !== undefined || ageMax !== undefined)
    filterParts.push(`Age: ${ageMin ?? 0}–${ageMax ?? "∞"}`);
  if (fromDate || toDate)
    filterParts.push(`Registered: ${fromDate ?? ""}–${toDate ?? ""}`)

  const rows = patients.map((p, i) => `
    <tr class="${i % 2 === 0 ? "even" : ""}">
      <td class="num">${i + 1}</td>
      <td>${esc(p.name)}</td>
      <td class="mono">${esc(p.udid ?? "")}</td>
      <td class="mono">${esc(p.uhid ?? "")}</td>
      <td class="num">${p.age}</td>
      <td>${esc(p.sex)}</td>
      <td class="mono">${esc(p.mobile)}</td>
      <td>${esc(p.category)}</td>

      <td>${new Date(p.createdAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #111; padding: 20px; }
  h1 { font-size: 15px; font-weight: bold; margin-bottom: 3px; }
  .meta { font-size: 9px; color: #555; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #0d9488; color: #fff; }
  th { padding: 6px 7px; text-align: left; font-size: 9px; font-weight: 600; }
  td { padding: 5px 7px; border-bottom: 1px solid #e5e7eb; vertical-align: top; word-break: break-word; }
  tr.even td { background: #f9fafb; }
  .num { text-align: center; }
  .mono { font-family: monospace; font-size: 9px; }
</style>
</head><body>
<h1>Patient Records — ${esc(hospitalName)}</h1>
<p class="meta">
  Generated: ${new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" })}
  &nbsp;·&nbsp; ${patients.length} patient${patients.length !== 1 ? "s" : ""}
  ${filterParts.length ? `&nbsp;·&nbsp; ${filterParts.join(" &nbsp;·&nbsp; ")}` : ""}
</p>
<table>
  <thead><tr>
    <th>#</th><th>Name</th><th>UDID</th><th>UHID</th><th>Age</th><th>Sex</th>
    <th>Mobile</th><th>Category</th><th>Registered</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

  const pdf = await htmlToPdf(html);
  return new NextResponse(pdf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="patients_${new Date().toISOString().slice(0,10)}.pdf"`,
    },
  });
}

function esc(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
