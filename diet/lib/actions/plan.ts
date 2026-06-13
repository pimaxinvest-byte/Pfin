'use server'

import { revalidatePath } from 'next/cache'
import { db } from '../db'
import { requireAuth } from '../auth'

export async function getUserPlan(userId: string) {
  return db.nutritionPlan.findUnique({ where: { userId } })
}

export async function savePlanPatterns(_prev: unknown, form: FormData) {
  const session = await requireAuth()
  const data = {
    mealsPerDay: form.get('mealsPerDay') ? Number(form.get('mealsPerDay')) : null,
    cookingFreq: (form.get('cookingFreq') as string) || null,
    eatingOut: (form.get('eatingOut') as string) || null,
    snackPattern: (form.get('snackPattern') as string) || null,
    hydrationLiters: form.get('hydrationLiters') ? Number(form.get('hydrationLiters')) : null,
    problemAreas: (form.get('problemAreas') as string) || null,
    restrictions: (form.get('restrictions') as string) || null,
  }
  await db.nutritionPlan.upsert({
    where: { userId: session.id },
    update: data,
    create: { userId: session.id, ...data },
  })
  revalidatePath('/plan')
  return { success: true }
}

export async function savePlanGoals(_prev: unknown, form: FormData) {
  const session = await requireAuth()
  const weightKg = await db.userProfile.findUnique({ where: { userId: session.id } }).then(p => p?.weightKg ?? 75)

  const primaryGoal = (form.get('primaryGoal') as string) || null
  const timelineWeeks = form.get('timelineWeeks') ? Number(form.get('timelineWeeks')) : null
  const approach = (form.get('approach') as string) || 'calorie_counting'

  // Step 3: estimate ranges using Harris-Benedict + activity
  const userGoals = await db.userGoals.findUnique({ where: { userId: session.id } })
  const kcalBase = userGoals?.kcal ?? 2000
  let kcalMin = kcalBase - 200
  let kcalMax = kcalBase + 100
  if (primaryGoal?.includes('perder') || primaryGoal?.includes('lose')) {
    kcalMin = kcalBase - 500
    kcalMax = kcalBase - 200
  } else if (primaryGoal?.includes('ganar') || primaryGoal?.includes('gain') || primaryGoal?.includes('músculo')) {
    kcalMin = kcalBase + 200
    kcalMax = kcalBase + 400
  }

  await db.nutritionPlan.upsert({
    where: { userId: session.id },
    update: { primaryGoal, secondaryGoal: form.get('secondaryGoal') as string || null, timelineWeeks, previousAttempt: form.get('previousAttempt') as string || null, approach, kcalMin, kcalMax },
    create: { userId: session.id, primaryGoal, secondaryGoal: form.get('secondaryGoal') as string || null, timelineWeeks, previousAttempt: form.get('previousAttempt') as string || null, approach, kcalMin, kcalMax },
  })
  revalidatePath('/plan')
  return { success: true }
}

export async function savePlanObstacles(_prev: unknown, form: FormData) {
  const session = await requireAuth()
  await db.nutritionPlan.upsert({
    where: { userId: session.id },
    update: {
      restaurantStrategy: form.get('restaurantStrategy') as string || null,
      alcoholRule: form.get('alcoholRule') as string || null,
      travelStrategy: form.get('travelStrategy') as string || null,
      lowWillpowerMeal: form.get('lowWillpowerMeal') as string || null,
      cravingStrategy: form.get('cravingStrategy') as string || null,
    },
    create: {
      userId: session.id,
      restaurantStrategy: form.get('restaurantStrategy') as string || null,
      alcoholRule: form.get('alcoholRule') as string || null,
      travelStrategy: form.get('travelStrategy') as string || null,
      lowWillpowerMeal: form.get('lowWillpowerMeal') as string || null,
      cravingStrategy: form.get('cravingStrategy') as string || null,
    },
  })
  revalidatePath('/plan')
  return { success: true }
}

export async function savePlanShopping(_prev: unknown, form: FormData) {
  const session = await requireAuth()
  await db.nutritionPlan.upsert({
    where: { userId: session.id },
    update: {
      shoppingDay: form.get('shoppingDay') as string || null,
      prepDay: form.get('prepDay') as string || null,
    },
    create: {
      userId: session.id,
      shoppingDay: form.get('shoppingDay') as string || null,
      prepDay: form.get('prepDay') as string || null,
    },
  })
  revalidatePath('/plan')
  return { success: true }
}

export async function savePlanHabits(_prev: unknown, form: FormData) {
  const session = await requireAuth()
  await db.nutritionPlan.upsert({
    where: { userId: session.id },
    update: {
      week1Habit: form.get('week1Habit') as string || null,
      week2Habit: form.get('week2Habit') as string || null,
      week3Habit: form.get('week3Habit') as string || null,
      week4Habit: form.get('week4Habit') as string || null,
    },
    create: {
      userId: session.id,
      week1Habit: form.get('week1Habit') as string || null,
      week2Habit: form.get('week2Habit') as string || null,
      week3Habit: form.get('week3Habit') as string || null,
      week4Habit: form.get('week4Habit') as string || null,
    },
  })
  revalidatePath('/plan')
  return { success: true }
}

export async function advanceWeek() {
  const session = await requireAuth()
  const plan = await db.nutritionPlan.findUnique({ where: { userId: session.id } })
  if (!plan) return
  await db.nutritionPlan.update({
    where: { userId: session.id },
    data: { currentWeek: Math.min(3, plan.currentWeek + 1) },
  })
  revalidatePath('/plan')
}

export async function saveCheckin(_prev: unknown, form: FormData) {
  const session = await requireAuth()
  const weekDate = new Date().toISOString().slice(0, 10).slice(0, 7) + '-01'
  await db.weeklyCheckin.upsert({
    where: { userId_weekDate: { userId: session.id, weekDate } },
    update: {
      energy: form.get('energy') ? Number(form.get('energy')) : null,
      hunger: form.get('hunger') ? Number(form.get('hunger')) : null,
      adherence: form.get('adherence') ? Number(form.get('adherence')) : null,
      notes: form.get('notes') as string || null,
    },
    create: {
      userId: session.id,
      weekDate,
      energy: form.get('energy') ? Number(form.get('energy')) : null,
      hunger: form.get('hunger') ? Number(form.get('hunger')) : null,
      adherence: form.get('adherence') ? Number(form.get('adherence')) : null,
      notes: form.get('notes') as string || null,
    },
  })
  revalidatePath('/plan')
  return { success: true }
}
