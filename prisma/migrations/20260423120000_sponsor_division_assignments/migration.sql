-- Many-to-many: restrict a sponsor to specific divisions (empty = all divisions on public home).
CREATE TABLE "TournamentSponsorDivision" (
    "id" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,

    CONSTRAINT "TournamentSponsorDivision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentSponsorDivision_sponsorId_divisionId_key" ON "TournamentSponsorDivision"("sponsorId", "divisionId");

CREATE INDEX "TournamentSponsorDivision_sponsorId_idx" ON "TournamentSponsorDivision"("sponsorId");

CREATE INDEX "TournamentSponsorDivision_divisionId_idx" ON "TournamentSponsorDivision"("divisionId");

ALTER TABLE "TournamentSponsorDivision" ADD CONSTRAINT "TournamentSponsorDivision_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "TournamentSponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentSponsorDivision" ADD CONSTRAINT "TournamentSponsorDivision_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;
