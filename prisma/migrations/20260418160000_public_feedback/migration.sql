-- CreateTable
CREATE TABLE "PublicFeedback" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "contactEmail" TEXT,
    "userAgent" TEXT,
    "sourcePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicFeedback_tournamentId_createdAt_idx" ON "PublicFeedback"("tournamentId", "createdAt");

-- AddForeignKey
ALTER TABLE "PublicFeedback" ADD CONSTRAINT "PublicFeedback_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
