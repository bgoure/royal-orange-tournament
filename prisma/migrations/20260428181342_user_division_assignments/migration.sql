-- CreateTable
CREATE TABLE "UserDivisionAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDivisionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDivisionAssignment_userId_idx" ON "UserDivisionAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserDivisionAssignment_divisionId_idx" ON "UserDivisionAssignment"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDivisionAssignment_userId_divisionId_key" ON "UserDivisionAssignment"("userId", "divisionId");

-- AddForeignKey
ALTER TABLE "UserDivisionAssignment" ADD CONSTRAINT "UserDivisionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDivisionAssignment" ADD CONSTRAINT "UserDivisionAssignment_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;
