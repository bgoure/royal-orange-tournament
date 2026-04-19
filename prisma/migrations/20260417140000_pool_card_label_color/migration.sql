-- CreateEnum
CREATE TYPE "PoolCardLabelColor" AS ENUM (
  'ROYAL',
  'ORANGE',
  'EMERALD',
  'SKY',
  'VIOLET',
  'ROSE',
  'AMBER',
  'TEAL',
  'INDIGO',
  'SLATE'
);

-- AlterTable
ALTER TABLE "Pool" ADD COLUMN "cardLabelColor" "PoolCardLabelColor";
