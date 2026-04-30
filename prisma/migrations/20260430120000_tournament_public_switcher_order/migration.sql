-- Order for public site default tournament and switcher listing (lower = first).
ALTER TABLE "Tournament" ADD COLUMN "publicSwitcherOrder" INTEGER NOT NULL DEFAULT 100;
