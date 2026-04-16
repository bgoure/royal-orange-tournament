-- PWA + public social links (per tournament, edited in admin).
ALTER TABLE "Tournament" ADD COLUMN "pwaIcon192Url" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "pwaIcon512Url" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "pwaThemeColor" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "socialWebsiteUrl" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "socialFacebookUrl" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "socialInstagramUrl" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "socialXUrl" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "socialYoutubeUrl" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "socialEmail" TEXT;
