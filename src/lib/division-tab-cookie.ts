import "server-only";

import { cookies } from "next/headers";
import { DIVISION_TAB_COOKIE } from "@/lib/division-tab-utils";

/** Server-only: read division tab cookie. Do not import this file from client components. */
export async function getDivisionTabCookie(): Promise<string | null> {
  const v = (await cookies()).get(DIVISION_TAB_COOKIE)?.value;
  if (!v || v.trim() === "") return null;
  return v.trim();
}
