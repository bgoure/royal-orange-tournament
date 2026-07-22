-- Expo push token registration for /api/v1

CREATE TABLE IF NOT EXISTS "ExpoPushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpoPushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExpoPushToken_token_key" ON "ExpoPushToken"("token");
CREATE INDEX IF NOT EXISTS "ExpoPushToken_userId_idx" ON "ExpoPushToken"("userId");

ALTER TABLE "ExpoPushToken" DROP CONSTRAINT IF EXISTS "ExpoPushToken_userId_fkey";
ALTER TABLE "ExpoPushToken" ADD CONSTRAINT "ExpoPushToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
