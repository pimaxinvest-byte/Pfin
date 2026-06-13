-- CreateTable: nutrition_plans
CREATE TABLE "nutrition_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mealsPerDay" INTEGER,
    "cookingFreq" TEXT,
    "eatingOut" TEXT,
    "snackPattern" TEXT,
    "hydrationLiters" DOUBLE PRECISION,
    "problemAreas" TEXT,
    "restrictions" TEXT,
    "primaryGoal" TEXT,
    "secondaryGoal" TEXT,
    "timelineWeeks" INTEGER,
    "previousAttempt" TEXT,
    "approach" TEXT NOT NULL DEFAULT 'calorie_counting',
    "kcalMin" INTEGER,
    "kcalMax" INTEGER,
    "restaurantStrategy" TEXT,
    "alcoholRule" TEXT,
    "travelStrategy" TEXT,
    "lowWillpowerMeal" TEXT,
    "cravingStrategy" TEXT,
    "shoppingDay" TEXT,
    "prepDay" TEXT,
    "currentWeek" INTEGER NOT NULL DEFAULT 0,
    "week1Habit" TEXT,
    "week2Habit" TEXT,
    "week3Habit" TEXT,
    "week4Habit" TEXT,

    CONSTRAINT "nutrition_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable: weekly_checkins
CREATE TABLE "weekly_checkins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekDate" TEXT NOT NULL,
    "energy" INTEGER,
    "hunger" INTEGER,
    "adherence" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_checkins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nutrition_plans_userId_key" ON "nutrition_plans"("userId");
CREATE UNIQUE INDEX "weekly_checkins_userId_weekDate_key" ON "weekly_checkins"("userId", "weekDate");

ALTER TABLE "nutrition_plans" ADD CONSTRAINT "nutrition_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_checkins" ADD CONSTRAINT "weekly_checkins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
