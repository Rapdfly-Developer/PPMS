/**
 * GET /api/files?ref=<stored file reference>
 *
 * The only way the browser opens an uploaded clinical file. Requires a
 * session, checks the file belongs to a patient the user may see (see
 * canReadFile), then streams it from storage. Private blobs are fetched with
 * the server-side token, which never reaches the browser.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { canReadFile } from "@/lib/file-access";
import { readStoredFile } from "@/lib/file-storage";

export async function GET(req: NextRequest) {
  const user = await requireUser();

  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref || ref.length > 2048) return new NextResponse("Missing file reference", { status: 400 });

  // Not-found and not-allowed look the same, so file existence is not revealed.
  if (!(await canReadFile(user, ref))) return new NextResponse("Not found", { status: 404 });
  const file = await readStoredFile(ref);
  if (!file) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(file.body as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
