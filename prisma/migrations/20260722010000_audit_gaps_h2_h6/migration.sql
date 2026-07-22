-- Horizon 2–6: byes, SCOREKEEPER, double/triple elim, orgs, API tokens

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SCOREKEEPER';
ALTER TYPE "BracketFormat" ADD VALUE IF NOT EXISTS 'DOUBLE_ELIMINATION';
ALTER TYPE "BracketFormat" ADD VALUE IF NOT EXISTS 'TRIPLE_ELIMINATION';

ALTER TABLE "BracketMatch" ADD COLUMN IF NOT EXISTS "homeIsBye" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BracketMatch" ADD COLUMN IF NOT EXISTS "awayIsBye" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "OrganizationPlan" AS ENUM ('FREE', 'STARTER', 'PRO');
CREATE TYPE "OrganizationMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandName" TEXT,
    "primaryColor" TEXT,
    "accentColor" TEXT,
    "logoUrl" TEXT,
    "pwaThemeColor" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "plan" "OrganizationPlan" NOT NULL DEFAULT 'FREE',
    "maxTournaments" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");

CREATE TABLE IF NOT EXISTS "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

CREATE TABLE IF NOT EXISTS "ApiBearerToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Expo',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiBearerToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApiBearerToken_tokenHash_key" ON "ApiBearerToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "ApiBearerToken_userId_idx" ON "ApiBearerToken"("userId");

ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "Tournament_organizationId_idx" ON "Tournament"("organizationId");

DO $$ BEGIN
  ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ApiBearerToken" ADD CONSTRAINT "ApiBearerToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
