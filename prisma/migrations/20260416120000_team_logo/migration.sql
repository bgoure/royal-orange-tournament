-- CreateTable
CREATE TABLE "TeamLogo" (
    "teamId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamLogo_pkey" PRIMARY KEY ("teamId")
);

-- AddForeignKey
ALTER TABLE "TeamLogo" ADD CONSTRAINT "TeamLogo_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
