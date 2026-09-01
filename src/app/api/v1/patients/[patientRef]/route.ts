/**
 * GET /api/v1/patients/:patientRef
 *
 * Returns PII-safe patient demographics to an authenticated external plugin.
 * Authentication: Bearer plugin token (signed by PPMS Core).
 *
 * patientRef may be a udid, database id, or uhid — resolved by the gateway.
 * Returns 404 for all access failures to avoid leaking patient existence.
 */

import { NextResponse } from "next/server";
import { getPatient } from "@/plugin-framework/gateway/data";
import { writePluginAudit } from "@/plugin-framework/gateway/audit";
import { authorizeTokenRequest } from "../../_lib/token-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ patientRef: string }> },
) {
  const { patientRef } = await params;

  const auth = await authorizeTokenRequest(req, "patient.demographics");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  // Enforce: token's patientRef must match the URL parameter
  if (auth.patientRef !== patientRef) {
    return NextResponse.json({ error: "Patient not found or not accessible." }, { status: 404 });
  }

  const patient = await getPatient(ctx, patientRef);
  if (!patient) {
    return NextResponse.json({ error: "Patient not found or not accessible." }, { status: 404 });
  }

  await writePluginAudit(ctx, {
    action: "EXTERNAL_PATIENT_READ",
    entityId: patient.patientId,
    entityType: "PATIENT",
    metadata: { patientRef },
  });

  return NextResponse.json({ patient });
}
