/**
 * POST /api/v1/plugin-token
 *
 * Issues a short-lived signed token for an external plugin to call PPMS data
 * APIs on behalf of the authenticated doctor.
 *
 * Authentication: NextAuth session cookie (doctor must be signed in to PPMS).
 * Authorization: 5-layer check — session → permission → plugin enabled →
 *                license → tenant — reusing the existing gateway/auth.ts.
 *
 * The token is never placed in a URL. The caller delivers it to the external
 * plugin via postMessage so it never appears in logs, history, or referrers.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { isPluginEnabled } from "@/plugin-framework/manager";
import { checkPluginLicense } from "@/plugin-framework/license";
import { assertPatientInScope } from "@/plugin-framework/gateway/data";
import { writePluginAudit } from "@/plugin-framework/gateway/audit";
import { signPluginToken } from "@/lib/plugin-token";
import { isPluginRegistered, getPlugin } from "@/plugin-framework/registry";
import type { GatewayContext } from "@/plugin-framework/types";

export async function POST(req: Request) {
  // 1. Session — must be an authenticated PPMS user
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const user = session.user as {
    id: string;
    name?: string;
    role: string;
    profileId: string;
    doctorId?: string;
    hospitalId?: string;
    permissions?: string[];
  };

  // 2. Doctor scope — only doctors (or staff linked to a doctor) may issue tokens
  const doctorId =
    user.role === "DOCTOR" ? user.profileId : (user.doctorId ?? null);
  const hospitalId = user.hospitalId ?? null;

  if (!doctorId) {
    return NextResponse.json(
      { error: "No doctor scope available for this session." },
      { status: 403 },
    );
  }

  // 3. Parse request body
  let body: { pluginId?: string; patientRef?: string; visitId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { pluginId, patientRef, visitId } = body;

  if (!pluginId || typeof pluginId !== "string") {
    return NextResponse.json({ error: "pluginId is required." }, { status: 400 });
  }
  if (!patientRef || typeof patientRef !== "string") {
    return NextResponse.json({ error: "patientRef is required." }, { status: 400 });
  }
  if (!visitId || typeof visitId !== "string") {
    return NextResponse.json({ error: "visitId is required." }, { status: 400 });
  }

  const permissions = user.permissions ?? [];
  const userLike = {
    ...user,
    id: user.id,
    username: "",
    name: user.name ?? "",
    permissions,
  };

  // 4. Plugin must be registered in this PPMS build
  if (!isPluginRegistered(pluginId)) {
    return NextResponse.json(
      { error: `Plugin not registered: ${pluginId}` },
      { status: 400 },
    );
  }
  const pluginManifest = getPlugin(pluginId).manifest;
  const triggerPermission = pluginManifest.ui?.emrPanel?.triggerPermission;
  if (!triggerPermission) {
    return NextResponse.json(
      { error: `Plugin "${pluginId}" does not declare an EMR panel trigger permission.` },
      { status: 400 },
    );
  }

  // Permission check — doctor must hold this plugin's declared trigger permission
  if (!userCan(userLike, triggerPermission)) {
    return NextResponse.json(
      { error: `Missing permission: ${triggerPermission}` },
      { status: 403 },
    );
  }

  // 5. Plugin enabled check
  const enabled = await isPluginEnabled(pluginId, doctorId);
  if (!enabled) {
    return NextResponse.json(
      { error: `Plugin is not enabled: ${pluginId}` },
      { status: 403 },
    );
  }

  // 6. License check
  if (hospitalId) {
    const license = await checkPluginLicense(pluginId, doctorId);
    if (license.isBlocked) {
      return NextResponse.json(
        { error: `Plugin license is ${license.status}. Please renew.` },
        { status: 403 },
      );
    }
  }

  // 7. Tenant validation — hospitalId must be linked to this doctor
  if (hospitalId) {
    const linked = await prisma.doctorHospitalLink.findFirst({
      where: { doctorId, hospitalId, active: true },
      select: { id: true },
    });
    if (!linked) {
      return NextResponse.json(
        { error: "Hospital is not linked to this doctor." },
        { status: 403 },
      );
    }
  }

  // 8. Patient scope — verify this doctor can access this patient
  const ctx: GatewayContext = {
    userId: user.id,
    role: user.role,
    doctorId,
    hospitalId: hospitalId ?? "",
    permissions,
    pluginId,
  };

  let resolvedPatientId: string;
  try {
    resolvedPatientId = await assertPatientInScope(ctx, patientRef);
  } catch {
    // Do not distinguish "not found" from "not yours"
    return NextResponse.json({ error: "Patient not found or not accessible." }, { status: 404 });
  }

  // 9. Visit cross-check — visit must belong to the resolved patient
  const visit = await prisma.visit.findFirst({
    where: { id: visitId, patientId: resolvedPatientId, doctorId },
    select: { id: true },
  });
  if (!visit) {
    return NextResponse.json(
      { error: "Visit not found or does not belong to this patient." },
      { status: 404 },
    );
  }

  // 10. Issue token — no patient medical data inside the token.
  // dataScopes are derived from the manifest's requiredApis — the server
  // decides what data the plugin may access; the client never chooses.
  let token: string;
  try {
    token = signPluginToken({
      doctorId,
      hospitalId: hospitalId ?? "",
      patientRef,
      visitId,
      pluginId,
      permissions,
      dataScopes: pluginManifest.requiredApis,
    });
  } catch (err) {
    console.error("[plugin-token] signPluginToken failed:", (err as Error).message);
    return NextResponse.json(
      { error: "Token issuance failed. Check server configuration." },
      { status: 500 },
    );
  }

  // 11. Audit — metadata only, no clinical content
  await writePluginAudit(ctx, {
    action: "EXTERNAL_TOKEN_ISSUED",
    entityId: visitId,
    entityType: "VISIT",
    metadata: { pluginId, patientRef },
  });

  return NextResponse.json({ token }, { status: 200 });
}
