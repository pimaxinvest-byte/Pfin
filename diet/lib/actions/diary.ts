'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '../db'
import { requireAuth, todayStr } from '../auth'

const AddEntrySchema = z.object({
  foodId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  quantityG: z.coerce.number().positive(),
})

export async function addDiaryEntry(_prev: unknown, form: FormData) {
  const session = await requireAuth()
  const parsed = AddEntrySchema.safeParse({
    foodId: form.get('foodId'),
    date: form.get('date') ?? todayStr(),
    mealType: form.get('mealType'),
    quantityG: form.get('quantityG'),
  })
  if (!parsed.success) return { error: 'Datos inválidos' }

  await db.diaryEntry.create({
    data: { userId: session.id, ...parsed.data },
  })

  revalidatePath('/diary')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteDiaryEntry(id: string) {
  const session = await requireAuth()
  await db.diaryEntry.deleteMany({ where: { id, userId: session.id } })
  revalidatePath('/diary')
  revalidatePath('/dashboard')
}

export async function getDayEntries(userId: string, date: string) {
  return db.diaryEntry.findMany({
    where: { userId, date },
    include: { food: true },
    orderBy: [{ mealType: 'asc' }, { createdAt: 'asc' }],
  })
}

export type DayEntry = Awaited<ReturnType<typeof getDayEntries>>[number]

export function computeMacros(entries: DayEntry[]) {
  return entries.reduce(
    (acc, e) => {
      const r = e.quantityG / 100
      acc.kcal += e.food.kcalPer100g * r
      acc.protein += e.food.proteinG * r
      acc.carbs += e.food.carbsG * r
      acc.fat += e.food.fatG * r
      acc.fiber += e.food.fiberG * r
      return acc
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  )
}
