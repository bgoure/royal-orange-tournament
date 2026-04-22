-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "socialShowWebsite" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "socialShowFacebook" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "socialShowInstagram" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "socialShowX" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "socialShowYoutube" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "socialShowEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "socialWebsiteSubtext" VARCHAR(160),
ADD COLUMN     "socialFacebookSubtext" VARCHAR(160),
ADD COLUMN     "socialInstagramSubtext" VARCHAR(160),
ADD COLUMN     "socialXSubtext" VARCHAR(160),
ADD COLUMN     "socialYoutubeSubtext" VARCHAR(160),
ADD COLUMN     "socialEmailSubtext" VARCHAR(160);
