import { NextResponse } from "next/server";
import { HttpError, requireStaff } from "@/lib/rbac/require-role";

/**
 * Sanity check for RBAC: requires POWER_USER or ADMIN (middleware + explicit session check).
 */
export async function GET() {
  try {
    const session = await requireStaff();
    return NextResponse.json({
      ok: true,
      userId: session.user.id,
      role: session.user.role,
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
