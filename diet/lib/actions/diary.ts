'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '../db'
import { requireAuth, todayStr } from '../auth'
import type { FormState } from '../form-state'

const AddEntrySchema = z.object({
  foodId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  quantityG: z.coerce.number().positive(),
})

export async function addDiaryEntry(_prev: unknown, form: FormData): Promise<FormState> {
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
