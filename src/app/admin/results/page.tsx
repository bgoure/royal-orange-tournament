import { redirect } from "next/navigation";

/** Public site uses /results; directors sometimes expect the same under /admin. */
export default function AdminResultsAliasPage() {
  redirect("/admin/standings");
}
