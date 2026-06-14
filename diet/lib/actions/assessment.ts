'use server'

import { revalidatePath } from 'next/cache'
import { db } from '../db'
import { requireAuth } from '../auth'
import { calcBMR, calcTDEE, bodyFatYuhasz, bodyFatJP3, bodyFatNavy, goalKcalRange, macroTargets } from '../nutrition'
import type { Sex } from '../nutrition'

export type AssessmentResult =
  | { success: true; error?: undefined; bodyFatPct: number | null; bodyFatJP: number | null; bodyFatNavyPct: number | null; bmr: number; tdee: number; fatMassKg: number | null; leanMassKg: number | null }
  | { success?: false; error: string }

export async function saveAssessment(_prev: unknown, form: FormData): Promise<AssessmentResult> {
  const session = await requireAuth()

  const profile = await db.userProfile.findUnique({ where: { userId: session.id } })
  const sex = (profile?.sex ?? 'M') as Sex
  const weightKg = parseFloat(form.get('weightKg') as string) || profile?.weightKg || 75
  const heightCm = profile?.heightCm || 175
  const age = profile?.birthYear ? new Date().getFullYear() - profile.birthYear : 30
  const activityLevel = profile?.activityLevel ?? 'moderate'
  const goal = profile?.goal ?? 'maintain'

  const f = (key: string) => {
    const v = parseFloat(form.get(key) as string)
    return isNaN(v) ? null : v
  }

  const triceps = f('tricepsMm')
  const subscap = f('subscapMm')
  const abdom = f('abdomMm')
  const suprail = f('suprailMm')
  const thigh = f('thighMm')
  const waist = f('waistCm')
  const hip = f('hipCm')
  const neck = f('neckCm')

  // Body fat calculations
  let bodyFatPct: number | null = null
  let bodyFatJP: number | null = null
  let bodyFatNavyPct: number | null = null

  if (triceps != null && subscap != null && abdom != null && suprail != null && thigh != null) {
    bodyFatPct = parseFloat(bodyFatYuhasz(triceps, subscap, abdom, suprail, thigh, sex).toFixed(1))
    // JP3: Men → abdom + subscap + thigh; Women → triceps + suprail + thigh
    if (sex === 'M') {
      bodyFatJP = parseFloat(bodyFatJP3(abdom, subscap, thigh, age, sex).toFixed(1))
    } else {
      bodyFatJP = parseFloat(bodyFatJP3(triceps, suprail, thigh, age, sex).toFixed(1))
    }
  }

  if (waist != null && neck != null) {
    bodyFatNavyPct = parseFloat(bodyFatNavy(waist, hip, neck, heightCm, sex).toFixed(1))
  }

  const primaryBF = bodyFatPct ?? bodyFatNavyPct
  const fatMassKg = primaryBF != null ? parseFloat((weightKg * primaryBF / 100).toFixed(1)) : null
  const leanMassKg = fatMassKg != null ? parseFloat((weightKg - fatMassKg).toFixed(1)) : null

  const bmr = calcBMR(weightKg, heightCm, age, sex)
  const tdee = calcTDEE(bmr, activityLevel)

  const today = new Date().toISOString().slice(0, 10)

  await db.bodyAssessment.create({
    data: {
      userId: session.id,
      date: (form.get('date') as string) || today,
      weightKg,
      tricepsMm: triceps,
      subscapMm: subscap,
      abdomMm: abdom,
      suprailMm: suprail,
      thighMm: thigh,
      waistCm: waist,
      hipCm: hip,
      neckCm: neck,
      armCm: f('armCm'),
      calfCm: f('calfCm'),
      bodyFatPct,
      bodyFatJP,
      bodyFatNavy: bodyFatNavyPct,
      fatMassKg,
      leanMassKg,
      bmr,
      tdee,
    },
  })

  // Auto-update goals based on TDEE
  if (leanMassKg) {
    const kcalRange = goalKcalRange(tdee, goal)
    const kcal = Math.round((kcalRange.min + kcalRange.max) / 2)
    const macros = macroTargets(kcal, leanMassKg, goal)
    await db.userGoals.upsert({
      where: { userId: session.id },
      update: { kcal, proteinG: macros.proteinG, carbsG: macros.carbsG, fatG: macros.fatG, fiberG: macros.fiberG },
      create: { userId: session.id, kcal, proteinG: macros.proteinG, carbsG: macros.carbsG, fatG: macros.fatG, fiberG: macros.fiberG },
    })
  }

  // Update profile weight
  await db.userProfile.upsert({
    where: { userId: session.id },
    update: { weightKg },
    create: { userId: session.id, weightKg },
  })

  revalidatePath('/assessment')
  revalidatePath('/dashboard')
  revalidatePath('/profile')
  return { success: true, bodyFatPct, bodyFatJP, bodyFatNavyPct, bmr, tdee, fatMassKg, leanMassKg }
}

export async function getAssessments(userId: string) {
  return db.bodyAssessment.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 20,
  })
}

export async function deleteAssessment(id: string) {
  const session = await requireAuth()
  await db.bodyAssessment.deleteMany({ where: { id, userId: session.id } })
  revalidatePath('/assessment')
}
