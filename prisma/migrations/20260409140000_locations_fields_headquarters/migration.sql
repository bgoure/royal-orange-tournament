-- Location model (replaces Venue), Field.locationId, tournament HQ as Location.isHeadquarters

-- CreateTable Location
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isHeadquarters" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "mapLink" TEXT,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Location_tournamentId_idx" ON "Location"("tournamentId");
CREATE INDEX "Location_tournamentId_sortOrder_idx" ON "Location"("tournamentId", "sortOrder");

ALTER TABLE "Location" ADD CONSTRAINT "Location_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate Venue -> Location (preserve ids for stable references)
INSERT INTO "Location" ("id", "tournamentId", "name", "address", "latitude", "longitude", "isHeadquarters", "sortOrder", "mapLink")
SELECT
  v."id",
  v."tournamentId",
  v."name",
  NULLIF(TRIM(BOTH ' ' FROM COALESCE(
    NULLIF(TRIM(v."address"), ''),
    NULLIF(TRIM(BOTH ' ' FROM CONCAT_WS(', ',
      NULLIF(NULLIF(TRIM(v."street"), ''), ''),
      NULLIF(TRIM(CONCAT_WS(', ', NULLIF(TRIM(v."city"), ''), NULLIF(TRIM(v."state"), ''))), ''),
      NULLIF(NULLIF(TRIM(v."postalCode"), ''), '')
    )), '')
  )), ''),
  v."latitude",
  v."longitude",
  false,
  v."sortOrder",
  v."mapLink"
FROM "Venue" v;

-- Mark former tournament HQ venue
UPDATE "Location" l
SET "isHeadquarters" = true
FROM "Tournament" t
WHERE t."headquartersVenueId" IS NOT NULL
  AND t."headquartersVenueId" = l."id";

-- Tournament-level HQ fields when no linked venue row was HQ
INSERT INTO "Location" ("id", "tournamentId", "name", "address", "latitude", "longitude", "isHeadquarters", "sortOrder", "mapLink")
SELECT
  'hq_' || t."id",
  t."id",
  COALESCE(NULLIF(TRIM(t."headquartersName"), ''), 'Tournament headquarters'),
  NULLIF(TRIM(t."headquartersAddress"), ''),
  t."headquartersLatitude",
  t."headquartersLongitude",
  true,
  -100,
  NULL
FROM "Tournament" t
WHERE NOT EXISTS (
  SELECT 1 FROM "Location" l WHERE l."tournamentId" = t."id" AND l."isHeadquarters" = true
)
AND (
  NULLIF(TRIM(COALESCE(t."headquartersName", '')), '') IS NOT NULL
  OR NULLIF(TRIM(COALESCE(t."headquartersAddress", '')), '') IS NOT NULL
  OR t."headquartersLatitude" IS NOT NULL
  OR t."headquartersLongitude" IS NOT NULL
);

-- Tournaments with no Location rows yet: create HQ from legacy tournament fields
INSERT INTO "Location" ("id", "tournamentId", "name", "address", "latitude", "longitude", "isHeadquarters", "sortOrder")
SELECT
  'locfallback_' || t."id",
  t."id",
  COALESCE(NULLIF(TRIM(t."locationLabel"), ''), 'Tournament site'),
  NULL,
  t."latitude",
  t."longitude",
  true,
  0
FROM "Tournament" t
WHERE NOT EXISTS (SELECT 1 FROM "Location" l WHERE l."tournamentId" = t."id");

-- Ensure exactly one HQ per tournament (clear extras before unique partial index)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "tournamentId"
      ORDER BY CASE WHEN "isHeadquarters" THEN 0 ELSE 1 END, "sortOrder", "id"
    ) AS rn
  FROM "Location"
  WHERE "isHeadquarters" = true
)
UPDATE "Location" l
SET "isHeadquarters" = false
FROM ranked r
WHERE l.id = r.id AND r.rn > 1;

-- Any tournament still missing an HQ flag: mark first location
UPDATE "Location" l
SET "isHeadquarters" = true
FROM (
  SELECT DISTINCT ON ("tournamentId") "id"
  FROM "Location"
  WHERE "tournamentId" NOT IN (SELECT "tournamentId" FROM "Location" WHERE "isHeadquarters" = true)
  ORDER BY "tournamentId", "sortOrder" ASC, "id" ASC
) pick
WHERE l."id" = pick."id";

-- Field -> Location
ALTER TABLE "Field" ADD COLUMN "locationId" TEXT;

UPDATE "Field" f
SET "locationId" = sub."id"
FROM (
  SELECT DISTINCT ON ("tournamentId") "id", "tournamentId"
  FROM "Location"
  WHERE "isHeadquarters" = true
  ORDER BY "tournamentId", "sortOrder" ASC, "id" ASC
) sub
WHERE f."tournamentId" = sub."tournamentId";

UPDATE "Field" f
SET "locationId" = (
  SELECT l."id" FROM "Location" l
  WHERE l."tournamentId" = f."tournamentId"
  ORDER BY l."sortOrder" ASC, l."id" ASC
  LIMIT 1
)
WHERE f."locationId" IS NULL;

ALTER TABLE "Field" ALTER COLUMN "locationId" SET NOT NULL;

CREATE INDEX "Field_locationId_idx" ON "Field"("locationId");

ALTER TABLE "Field" ADD CONSTRAINT "Field_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop legacy tournament HQ + Venue
ALTER TABLE "Tournament" DROP CONSTRAINT IF EXISTS "Tournament_headquartersVenueId_fkey";
DROP INDEX IF EXISTS "Tournament_headquartersVenueId_idx";

ALTER TABLE "Tournament" DROP COLUMN IF EXISTS "headquartersVenueId";
ALTER TABLE "Tournament" DROP COLUMN IF EXISTS "headquartersName";
ALTER TABLE "Tournament" DROP COLUMN IF EXISTS "headquartersAddress";
ALTER TABLE "Tournament" DROP COLUMN IF EXISTS "headquartersLatitude";
ALTER TABLE "Tournament" DROP COLUMN IF EXISTS "headquartersLongitude";

DROP TABLE IF EXISTS "Venue";

-- At most one headquarters location per tournament
CREATE UNIQUE INDEX "Location_one_headquarters_per_tournament" ON "Location"("tournamentId") WHERE "isHeadquarters" = true;
