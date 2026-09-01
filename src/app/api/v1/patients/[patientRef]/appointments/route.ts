/**
 * GET /api/v1/patients/:patientRef/appointments
 *
 * Returns recent and upcoming appointments for the patient, scoped to the
 * token's doctor and linked hospitals. Query param ?limit=N (max 20).
 */

import { NextResponse } from "next/server";
import { getAppointments } from "@/plugin-framework/gateway/data";
import { writePluginAudit } from "@/plugin-framework/gateway/audit";
import { authorizeTokenRequest } from "../../../_lib/token-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ patientRef: string }> },
) {
  const { patientRef } = await params;

  const auth = await authorizeTokenRequest(req, "appointment.history");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  if (auth.patientRef !== patientRef) {
    return NextResponse.json({ error: "Patient not found or not accessible." }, { status: 404 });
  }

  const url = new URL(req.url);
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Math.min(Math.max(parseInt(rawLimit, 10) || 5, 1), 20) : 5;

  const appointments = await getAppointments(ctx, patientRef, { limit });

  await writePluginAudit(ctx, {
    action: "EXTERNAL_APPOINTMENTS_READ",
    entityId: patientRef,
    entityType: "PATIENT",
    metadata: { patientRef, count: appointments.length, limit },
  });

  return NextResponse.json({ appointments });
}
