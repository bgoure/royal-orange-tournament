import { redirect } from "next/navigation";
import { getDefaultPublicTournamentSlug } from "@/lib/tournament-context";

export default async function SiteRootPage() {
  const slug = await getDefaultPublicTournamentSlug();
  if (!slug) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">No published tournaments</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Publish a tournament in the admin portal, then open{" "}
          <span className="font-mono text-zinc-800">/your-tournament-slug</span>.
        </p>
      </div>
    );
  }
  redirect(`/${slug}`);
}
