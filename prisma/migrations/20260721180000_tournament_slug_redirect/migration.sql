-- Former public URLs redirect to the tournament’s current slug.
CREATE TABLE "TournamentSlugRedirect" (
    "id" TEXT NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentSlugRedirect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentSlugRedirect_fromSlug_key" ON "TournamentSlugRedirect"("fromSlug");

CREATE INDEX "TournamentSlugRedirect_tournamentId_idx" ON "TournamentSlugRedirect"("tournamentId");

ALTER TABLE "TournamentSlugRedirect" ADD CONSTRAINT "TournamentSlugRedirect_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
