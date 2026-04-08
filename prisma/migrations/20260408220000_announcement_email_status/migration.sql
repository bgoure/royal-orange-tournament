-- CreateEnum
CREATE TYPE "AnnouncementEmailStatus" AS ENUM ('NOT_SENT', 'SENDING', 'SENT', 'FAILED', 'SKIPPED_NO_SUBSCRIBERS', 'SKIPPED_NO_API_KEY');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN "emailDeliveryStatus" "AnnouncementEmailStatus" NOT NULL DEFAULT 'NOT_SENT';
ALTER TABLE "Announcement" ADD COLUMN "emailSentAt" TIMESTAMP(3);
ALTER TABLE "Announcement" ADD COLUMN "emailError" TEXT;
