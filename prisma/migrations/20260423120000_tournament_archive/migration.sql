-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archiveFolder" TEXT;

-- CreateIndex
CREATE INDEX "Tournament_archiveFolder_slug_idx" ON "Tournament"("archiveFolder", "slug");
