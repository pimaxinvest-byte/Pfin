-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('M', 'F');

-- AlterTable: add sex to user_profiles
ALTER TABLE "user_profiles" ADD COLUMN "sex" "Sex";

-- CreateTable: body_assessments
CREATE TABLE "body_assessments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "tricepsMm" DOUBLE PRECISION,
    "subscapMm" DOUBLE PRECISION,
    "abdomMm" DOUBLE PRECISION,
    "suprailMm" DOUBLE PRECISION,
    "thighMm" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipCm" DOUBLE PRECISION,
    "neckCm" DOUBLE PRECISION,
    "armCm" DOUBLE PRECISION,
    "calfCm" DOUBLE PRECISION,
    "bodyFatPct" DOUBLE PRECISION,
    "bodyFatJP" DOUBLE PRECISION,
    "bodyFatNavy" DOUBLE PRECISION,
    "fatMassKg" DOUBLE PRECISION,
    "leanMassKg" DOUBLE PRECISION,
    "bmr" INTEGER,
    "tdee" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "body_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "body_assessments_userId_date_idx" ON "body_assessments"("userId", "date");

ALTER TABLE "body_assessments"
    ADD CONSTRAINT "body_assessments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
