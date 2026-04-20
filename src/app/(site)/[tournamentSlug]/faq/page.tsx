import { redirect } from "next/navigation";
import { tournamentPath } from "@/lib/tournament-public-path";

/** Legacy FAQ URL; content now lives under Rules and Resources. */
export default async function FaqRedirectPage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  redirect(tournamentPath(tournamentSlug, "rules"));
}
