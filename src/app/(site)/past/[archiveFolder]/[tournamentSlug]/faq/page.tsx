import { redirect } from "next/navigation";
import { getArchivedPublishedTournamentByFolderAndSlug } from "@/lib/tournament-context";
import { tournamentPathFromBase, tournamentPublicBasePath } from "@/lib/tournament-public-path";

export default async function ArchivedFaqRedirectPage({
  params,
}: {
  params: Promise<{ archiveFolder: string; tournamentSlug: string }>;
}) {
  const { archiveFolder, tournamentSlug } = await params;
  const tournament = await getArchivedPublishedTournamentByFolderAndSlug(archiveFolder, tournamentSlug);
  if (!tournament) redirect("/");
  redirect(tournamentPathFromBase(tournamentPublicBasePath(tournament), "rules"));
}
