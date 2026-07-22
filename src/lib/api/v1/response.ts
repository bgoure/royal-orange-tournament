import { NextResponse } from "next/server";

/** 200 JSON response with the given payload (pass `status` for 201/etc.). */
export function jsonOk<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/** `{ error: message }` JSON response. Defaults to 400; pass 401/403/404/etc. as needed. */
export function jsonError(message: string, status = 400): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status });
}
