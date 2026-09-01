/**
 * GET /api/v1/patients/:patientRef/visits/:visitId
 *
 * Returns a single visit in full detail.
 *
 * Security: verifies that the visit belongs to the resolved patient.
 * A valid token for patientRef=A with visitId belonging to patientRef=B
 * will always return 404 — never patient B's data.
 */

import { NextResponse } from "next/server";
import { getVisits, assertPatientInScope } from "@/plugin-framework/gateway/data";
import { writePluginAudit } from "@/plugin-framework/gateway/audit";
import { authorizeTokenRequest } from "../../../../_lib/token-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ patientRef: string; visitId: string }> },
) {
  const { patientRef, visitId } = await params;

  const auth = await authorizeTokenRequest(req, "ai.copilot.view");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  if (auth.patientRef !== patientRef) {
    return NextResponse.json({ error: "Patient not found or not accessible." }, { status: 404 });
  }

  // Resolve patient and enforce scope
  let resolvedPatientId: string;
  try {
    resolvedPatientId = await assertPatientInScope(ctx, patientRef);
  } catch {
    return NextResponse.json({ error: "Patient not found or not accessible." }, { status: 404 });
  }

  // Critical: verify the visitId belongs to the resolved patient
  // This prevents patientRef=A + visitId=B-visit from returning patient B's data
  const visitBelongsToPatient = await prisma.visit.findFirst({
    where: { id: visitId, patientId: resolvedPatientId },
    select: { id: true },
  });
  if (!visitBelongsToPatient) {
    return NextResponse.json({ error: "Visit not found or not accessible." }, { status: 404 });
  }

  const visits = await getVisits(ctx, patientRef, { visitId, limit: 1 });
  const visit = visits[0] ?? null;

  if (!visit) {
    return NextResponse.json({ error: "Visit not found or not accessible." }, { status: 404 });
  }

  await writePluginAudit(ctx, {
    action: "EXTERNAL_VISIT_READ",
    entityId: visitId,
    entityType: "VISIT",
    metadata: { patientRef, visitId },
  });

  return NextResponse.json({ visit });
}
