'use server'

import { db } from '../db'
import { requireTrainer } from '../auth'

// Lista de todas las cuentas registradas (solo trainers). Cada usuario que se
// registra y mete sus datos aparece aquí para que el entrenador lo vea todo.
export async function getAllUsers() {
  await requireTrainer()
  return db.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      profile: true,
      goals: true,
      _count: { select: { diaryEntries: true, assessments: true } },
    },
  })
}

export async function getUserDetail(id: string) {
  await requireTrainer()
  return db.user.findUnique({
    where: { id },
    include: {
      profile: true,
      goals: true,
      assessments: { orderBy: { date: 'desc' }, take: 5 },
    },
  })
}
