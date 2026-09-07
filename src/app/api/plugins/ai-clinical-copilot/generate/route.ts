/**
 * POST /api/plugins/ai-clinical-copilot/generate
 *
 * Non-streaming Copilot request. A thin transport wrapper: every check,
 * every audit row and every error message comes from the plugin service.
 */

import { NextResponse } from "next/server";
import "@/plugins";
import {
  parseCopilotRequest,
  isCopilotFailure,
  prepareRequest,
  runCopilot,
} from "@/plugins/ai-clinical-copilot/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body.", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const parsed = parseCopilotRequest(body);
  if (isCopilotFailure(parsed)) {
    return NextResponse.json(
      { error: parsed.message, code: parsed.code },
      { status: parsed.status },
    );
  }

  const prepared = await prepareRequest(parsed);
  if (!prepared.ok) {
    return NextResponse.json(
      { error: prepared.message, code: prepared.code },
      { status: prepared.status },
    );
  }

  const result = await runCopilot(prepared);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: result.status },
    );
  }

  return NextResponse.json(result);
}
