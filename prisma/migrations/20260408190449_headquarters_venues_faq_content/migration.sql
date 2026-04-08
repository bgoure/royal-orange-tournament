-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "headquartersAddress" TEXT,
ADD COLUMN     "headquartersLatitude" DOUBLE PRECISION,
ADD COLUMN     "headquartersLongitude" DOUBLE PRECISION,
ADD COLUMN     "headquartersName" TEXT,
ADD COLUMN     "headquartersVenueId" TEXT;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "address" TEXT,
ADD COLUMN     "mapLink" TEXT;

-- CreateIndex
CREATE INDEX "Tournament_headquartersVenueId_idx" ON "Tournament"("headquartersVenueId");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_headquartersVenueId_fkey" FOREIGN KEY ("headquartersVenueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
