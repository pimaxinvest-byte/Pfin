import type { Prisma } from '@prisma/client'

export type DayEntry = Prisma.DiaryEntryGetPayload<{ include: { food: true } }>

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
