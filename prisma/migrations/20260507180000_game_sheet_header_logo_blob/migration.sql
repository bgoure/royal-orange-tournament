-- CreateTable
CREATE TABLE "GameSheetHeaderLogo" (
    "tournamentId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSheetHeaderLogo_pkey" PRIMARY KEY ("tournamentId")
);

-- AddForeignKey
ALTER TABLE "GameSheetHeaderLogo" ADD CONSTRAINT "GameSheetHeaderLogo_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
