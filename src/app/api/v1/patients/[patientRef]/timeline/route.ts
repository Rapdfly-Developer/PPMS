/**
 * GET /api/v1/patients/:patientRef/timeline
 *
 * Returns the patient's chronological clinical timeline (visits, surgeries,
 * admissions) merged and sorted newest first. Query param ?limit=N (max 40).
 */

import { NextResponse } from "next/server";
import { getPatientTimeline } from "@/plugin-framework/gateway/data";
import { writePluginAudit } from "@/plugin-framework/gateway/audit";
import { authorizeTokenRequest } from "../../../_lib/token-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ patientRef: string }> },
) {
  const { patientRef } = await params;

  const auth = await authorizeTokenRequest(req, "ai.copilot.view");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  if (auth.patientRef !== patientRef) {
    return NextResponse.json({ error: "Patient not found or not accessible." }, { status: 404 });
  }

  const url = new URL(req.url);
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Math.min(Math.max(parseInt(rawLimit, 10) || 15, 1), 40) : 15;

  const timeline = await getPatientTimeline(ctx, patientRef, { limit });

  await writePluginAudit(ctx, {
    action: "EXTERNAL_TIMELINE_READ",
    entityId: patientRef,
    entityType: "PATIENT",
    metadata: { patientRef, count: timeline.length, limit },
  });

  return NextResponse.json({ timeline });
}
