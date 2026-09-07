/**
 * GET /api/v1/patients/:patientRef/visits
 *
 * Returns up to 20 visits (newest first) for the patient, scoped to the
 * token's doctor and linked hospitals. Query param ?limit=N (max 20).
 */

import { NextResponse } from "next/server";
import { getVisits } from "@/plugin-framework/gateway/data";
import { writePluginAudit } from "@/plugin-framework/gateway/audit";
import { authorizeTokenRequest } from "../../../_lib/token-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ patientRef: string }> },
) {
  const { patientRef } = await params;

  const auth = await authorizeTokenRequest(req, "visit.history");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  if (auth.patientRef !== patientRef) {
    return NextResponse.json({ error: "Patient not found or not accessible." }, { status: 404 });
  }

  const url = new URL(req.url);
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Math.min(Math.max(parseInt(rawLimit, 10) || 5, 1), 20) : 5;

  const visits = await getVisits(ctx, patientRef, { limit });

  await writePluginAudit(ctx, {
    action: "EXTERNAL_VISITS_READ",
    entityId: patientRef,
    entityType: "PATIENT",
    metadata: { patientRef, count: visits.length, limit },
  });

  return NextResponse.json({ visits });
}
