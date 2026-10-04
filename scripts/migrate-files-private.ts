/**
 * Move existing clinical files from the public Vercel Blob store into the
 * private one, and point the records at the new copies.
 *
 *   npx tsx --env-file=.env scripts/migrate-files-private.ts            # dry run
 *   npx tsx --env-file=.env scripts/migrate-files-private.ts --apply    # copy + update records
 *   npx tsx --env-file=.env scripts/migrate-files-private.ts --apply --delete-public
 *
 * Needs DATABASE_URL, BLOB_READ_WRITE_TOKEN (public store) and
 * BLOB_PRIVATE_READ_WRITE_TOKEN (private store). Safe to re-run: refs that
 * already point at the private store are skipped. Public copies are only
 * deleted with --delete-public, after every record has been updated.
 */
import { put, del } from "@vercel/blob";
import { prisma } from "../src/lib/prisma";
import { isPrivateRef } from "../src/lib/file-storage";

const APPLY = process.argv.includes("--apply");
const DELETE_PUBLIC = process.argv.includes("--delete-public");

const PRIVATE = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
const PUBLIC = process.env.BLOB_READ_WRITE_TOKEN;
if (APPLY && !PRIVATE) throw new Error("BLOB_PRIVATE_READ_WRITE_TOKEN is not set.");

const isPublicBlob = (ref: string | null | undefined): ref is string =>
  !!ref && /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(ref) && !isPrivateRef(ref);

const moved = new Map<string, string>(); // old public URL -> new private URL

async function moveFile(url: string): Promise<string> {
  const done = moved.get(url);
  if (done) return done;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status} for ${url}`);
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const name = new URL(url).pathname.split("/").pop() ?? "file";
  const blob = await put(`clinical/migrated/${name}`, Buffer.from(await res.arrayBuffer()), {
    access: "private",
    contentType,
    token: PRIVATE,
    addRandomSuffix: true,
  });
  moved.set(url, blob.url);
  return blob.url;
}

async function main() {
  console.log(APPLY ? "APPLY mode" : "DRY RUN (pass --apply to copy files and update records)");
  let planned = 0;

  const plan = async (label: string, url: string, save: (next: string) => Promise<unknown>) => {
    planned++;
    if (!APPLY) { console.log(`  would move ${label}`); return; }
    const next = await moveFile(url);
    await save(next);
    console.log(`  moved ${label}`);
  };

  for (const p of await prisma.patient.findMany({ select: { id: true, photoUrl: true, aadhaarPhotoUrl: true } })) {
    if (isPublicBlob(p.photoUrl)) await plan(`Patient ${p.id} photo`, p.photoUrl, (u) => prisma.patient.update({ where: { id: p.id }, data: { photoUrl: u } }));
    if (isPublicBlob(p.aadhaarPhotoUrl)) await plan(`Patient ${p.id} Aadhaar`, p.aadhaarPhotoUrl, (u) => prisma.patient.update({ where: { id: p.id }, data: { aadhaarPhotoUrl: u } }));
  }
  for (const v of await prisma.pastExternalVisit.findMany({ select: { id: true, scanFileRef: true } })) {
    if (isPublicBlob(v.scanFileRef)) await plan(`PastExternalVisit ${v.id}`, v.scanFileRef, (u) => prisma.pastExternalVisit.update({ where: { id: v.id }, data: { scanFileRef: u } }));
  }
  for (const o of await prisma.investigationOrder.findMany({ where: { resultRef: { not: null } }, select: { id: true, resultRef: true } })) {
    if (isPublicBlob(o.resultRef)) await plan(`InvestigationOrder ${o.id}`, o.resultRef, (u) => prisma.investigationOrder.update({ where: { id: o.id }, data: { resultRef: u } }));
  }
  for (const c of await prisma.patientInsurance.findMany({ where: { cardImageUrl: { not: null } }, select: { id: true, cardImageUrl: true } })) {
    if (isPublicBlob(c.cardImageUrl)) await plan(`PatientInsurance ${c.id}`, c.cardImageUrl, (u) => prisma.patientInsurance.update({ where: { id: c.id }, data: { cardImageUrl: u } }));
  }
  for (const d of await prisma.insuranceClaimDocument.findMany({ select: { id: true, fileUrl: true } })) {
    if (isPublicBlob(d.fileUrl)) await plan(`InsuranceClaimDocument ${d.id}`, d.fileUrl, (u) => prisma.insuranceClaimDocument.update({ where: { id: d.id }, data: { fileUrl: u } }));
  }
  // AR slips live inside the refraction JSON strings.
  const urlRe = /https:\/\/[^"\s]+\.public\.blob\.vercel-storage\.com\/[^"\s]+/g;
  for (const r of await prisma.refractiveCorrection.findMany({ select: { id: true, re: true, le: true, extraCorrections: true } })) {
    for (const field of ["re", "le", "extraCorrections"] as const) {
      const text = r[field];
      for (const url of text?.match(urlRe) ?? []) {
        if (!isPublicBlob(url)) continue;
        await plan(`RefractiveCorrection ${r.id}.${field}`, url, async (u) => {
          const fresh = await prisma.refractiveCorrection.findUnique({ where: { id: r.id }, select: { [field]: true } }) as Record<string, string | null> | null;
          await prisma.refractiveCorrection.update({ where: { id: r.id }, data: { [field]: (fresh?.[field] ?? "").split(url).join(u) } });
        });
      }
    }
  }

  console.log(`${planned} file reference(s) ${APPLY ? "moved" : "to move"}.`);
  if (APPLY && DELETE_PUBLIC && moved.size > 0) {
    if (!PUBLIC) throw new Error("BLOB_READ_WRITE_TOKEN is needed to delete the public copies.");
    await del([...moved.keys()], { token: PUBLIC });
    console.log(`Deleted ${moved.size} public cop${moved.size === 1 ? "y" : "ies"}.`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
