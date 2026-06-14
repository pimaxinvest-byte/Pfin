'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '../db'
import { requireAuth } from '../auth'
import type { FormState } from '../form-state'

const FoodSchema = z.object({
  name: z.string().min(2).max(100),
  brand: z.string().optional(),
  kcalPer100g: z.coerce.number().min(0),
  proteinG: z.coerce.number().min(0),
  carbsG: z.coerce.number().min(0),
  fatG: z.coerce.number().min(0),
  fiberG: z.coerce.number().min(0).default(0),
  servingG: z.coerce.number().min(1).default(100),
})

export async function createFood(_prev: unknown, form: FormData): Promise<FormState> {
  await requireAuth()
  const parsed = FoodSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  await db.food.create({ data: parsed.data })
  revalidatePath('/foods')
  return { success: true }
}

export async function searchFoods(q: string) {
  if (!q || q.length < 2) return []
  return db.food.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    orderBy: [{ verified: 'desc' }, { name: 'asc' }],
    take: 30,
  })
}

export type FoodResult = Awaited<ReturnType<typeof searchFoods>>[number]

const GoalsSchema = z.object({
  kcal: z.coerce.number().min(800).max(9000),
  proteinG: z.coerce.number().min(0),
  carbsG: z.coerce.number().min(0),
  fatG: z.coerce.number().min(0),
  fiberG: z.coerce.number().min(0),
})

export async function saveGoals(_prev: unknown, form: FormData): Promise<FormState> {
  const session = await requireAuth()
  const parsed = GoalsSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  await db.userGoals.upsert({
    where: { userId: session.id },
    update: parsed.data,
    create: { userId: session.id, ...parsed.data },
  })
  revalidatePath('/profile')
  return { success: true }
}

const ProfileSchema = z.object({
  weightKg: z.coerce.number().min(20).max(500).optional(),
  heightCm: z.coerce.number().min(100).max(300).optional(),
  birthYear: z.coerce.number().min(1920).max(2010).optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  goal: z.enum(['lose', 'maintain', 'gain']),
})

export async function saveProfile(_prev: unknown, form: FormData): Promise<FormState> {
  const session = await requireAuth()
  const parsed = ProfileSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  await db.userProfile.upsert({
    where: { userId: session.id },
    update: parsed.data,
    create: { userId: session.id, ...parsed.data },
  })
  revalidatePath('/profile')
  return { success: true }
}
