-- CreateEnum
CREATE TYPE "BuildingCategory" AS ENUM ('beginner', 'recreational', 'natural_comp', 'enhanced_comp', 'trt');

-- CreateTable: clients
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "birthDate" TEXT,
    "sex" "Sex" NOT NULL DEFAULT 'M',
    "occupation" TEXT,
    "city" TEXT,
    "primaryGoal" TEXT,
    "secondaryGoal" TEXT,
    "category" "BuildingCategory" NOT NULL DEFAULT 'recreational',
    "competitionDate" TEXT,
    "isEnhanced" BOOLEAN NOT NULL DEFAULT false,
    "enhancedProtocol" TEXT,
    "healthCheck" BOOLEAN NOT NULL DEFAULT false,
    "medicalHistory" TEXT,
    "foodAllergies" TEXT,
    "injuries" TEXT,
    "medications" TEXT,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "targetWeightKg" DOUBLE PRECISION,
    "activityLevel" "ActivityLevel" NOT NULL DEFAULT 'moderate',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trainerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable: client_assessments
CREATE TABLE "client_assessments" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
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
    "chestCm" DOUBLE PRECISION,
    "thighCm" DOUBLE PRECISION,
    "bodyFatPct" DOUBLE PRECISION,
    "bodyFatJP" DOUBLE PRECISION,
    "bodyFatNavy" DOUBLE PRECISION,
    "fatMassKg" DOUBLE PRECISION,
    "leanMassKg" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "bmr" INTEGER,
    "tdee" INTEGER,
    "targetKcal" INTEGER,
    "proteinG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clients_trainerId_idx" ON "clients"("trainerId");
CREATE INDEX "client_assessments_clientId_date_idx" ON "client_assessments"("clientId", "date");

ALTER TABLE "clients" ADD CONSTRAINT "clients_trainerId_fkey"
    FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_assessments" ADD CONSTRAINT "client_assessments_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
