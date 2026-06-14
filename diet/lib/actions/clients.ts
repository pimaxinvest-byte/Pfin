'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '../db'
import { requireAuth } from '../auth'
import type { FormState } from '../form-state'
import {
  calcBMR, calcTDEE, calcTDEEEnhanced, goalKcalRange, macroTargets,
  bodyFatYuhasz, bodyFatJP3, bodyFatNavy,
} from '../nutrition'
import type { Sex, BuildingCategory } from '../nutrition'

const ClientSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  sex: z.enum(['M', 'F']).default('M'),
  occupation: z.string().optional(),
  city: z.string().optional(),
  primaryGoal: z.string().optional(),
  secondaryGoal: z.string().optional(),
  category: z.enum(['beginner', 'recreational', 'natural_comp', 'enhanced_comp', 'trt']).default('recreational'),
  competitionDate: z.string().optional(),
  isEnhanced: z.coerce.boolean().default(false),
  enhancedProtocol: z.string().optional(),
  healthCheck: z.coerce.boolean().default(false),
  medicalHistory: z.string().optional(),
  foodAllergies: z.string().optional(),
  injuries: z.string().optional(),
  medications: z.string().optional(),
  weightKg: z.coerce.number().positive().optional(),
  heightCm: z.coerce.number().positive().optional(),
  targetWeightKg: z.coerce.number().positive().optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).default('moderate'),
  trainerNotes: z.string().optional(),
})

function clean(v: string | undefined | null) {
  if (!v || v.trim() === '') return undefined
  return v.trim()
}

export async function createClient(_prev: unknown, form: FormData): Promise<FormState> {
  const session = await requireAuth()
  const raw = Object.fromEntries(form)
  raw.isEnhanced = form.get('isEnhanced') === 'on' ? 'true' : 'false'
  raw.healthCheck = form.get('healthCheck') === 'on' ? 'true' : 'false'

  const parsed = ClientSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { email, phone, birthDate, occupation, city, secondaryGoal, competitionDate,
    enhancedProtocol, medicalHistory, foodAllergies, injuries, medications, trainerNotes, ...rest } = parsed.data

  let client
  try {
    client = await db.client.create({
      data: {
        trainerId: session.id,
        email: clean(email),
        phone: clean(phone),
        birthDate: clean(birthDate),
        occupation: clean(occupation),
        city: clean(city),
        secondaryGoal: clean(secondaryGoal),
        competitionDate: clean(competitionDate),
        enhancedProtocol: clean(enhancedProtocol),
        medicalHistory: clean(medicalHistory),
        foodAllergies: clean(foodAllergies),
        injuries: clean(injuries),
        medications: clean(medications),
        trainerNotes: clean(trainerNotes),
        ...rest,
      },
    })
  } catch {
    return { error: 'No se pudo crear la ficha. Inténtalo de nuevo.' }
  }

  redirect(`/clients/${client.id}`)
}

export async function updateClient(_prev: unknown, form: FormData): Promise<FormState> {
  const session = await requireAuth()
  const id = form.get('id') as string
  const existing = await db.client.findFirst({ where: { id, trainerId: session.id } })
  if (!existing) return { error: 'Cliente no encontrado' }

  const raw = Object.fromEntries(form)
  raw.isEnhanced = form.get('isEnhanced') === 'on' ? 'true' : 'false'
  raw.healthCheck = form.get('healthCheck') === 'on' ? 'true' : 'false'
  const parsed = ClientSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { email, phone, ...rest } = parsed.data
  await db.client.update({
    where: { id },
    data: { email: clean(email), phone: clean(phone), ...rest, updatedAt: new Date() },
  })

  revalidatePath(`/clients/${id}`)
  return { success: true }
}

export async function getClients() {
  const session = await requireAuth()
  return db.client.findMany({
    where: { trainerId: session.id, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: { assessments: { orderBy: { date: 'desc' }, take: 1 } },
  })
}

export async function getClient(id: string) {
  const session = await requireAuth()
  return db.client.findFirst({
    where: { id, trainerId: session.id },
    include: { assessments: { orderBy: { date: 'desc' }, take: 10 } },
  })
}

export async function deleteClient(id: string) {
  const session = await requireAuth()
  await db.client.updateMany({ where: { id, trainerId: session.id }, data: { isActive: false } })
  revalidatePath('/clients')
  redirect('/clients')
}

export async function saveClientAssessment(_prev: unknown, form: FormData): Promise<FormState> {
  const session = await requireAuth()
  const clientId = form.get('clientId') as string
  const client = await db.client.findFirst({ where: { id: clientId, trainerId: session.id } })
  if (!client) return { error: 'Cliente no autorizado' }

  const f = (k: string) => { const v = parseFloat(form.get(k) as string); return isNaN(v) ? null : v }

  const weightKg = f('weightKg') ?? client.weightKg ?? 75
  const heightCm = f('heightCm') ?? client.heightCm ?? 175
  const sex = (client.sex ?? 'M') as Sex
  const category = (client.category ?? 'recreational') as BuildingCategory
  const age = client.birthDate ? new Date().getFullYear() - new Date(client.birthDate).getFullYear() : 30

  const tri = f('tricepsMm'), sub = f('subscapMm'), abd = f('abdomMm'), sup = f('suprailMm'), thi = f('thighMm')
  const waist = f('waistCm'), hip = f('hipCm'), neck = f('neckCm')

  let bodyFatPct: number | null = null
  let bodyFatJP: number | null = null
  let bodyFatNavyPct: number | null = null

  if (tri != null && sub != null && abd != null && sup != null && thi != null) {
    bodyFatPct = parseFloat(bodyFatYuhasz(tri, sub, abd, sup, thi, sex).toFixed(1))
    bodyFatJP = sex === 'M'
      ? parseFloat(bodyFatJP3(abd, sub, thi, age, sex).toFixed(1))
      : parseFloat(bodyFatJP3(tri, sup, thi, age, sex).toFixed(1))
  }
  if (waist != null && neck != null) {
    const navy = bodyFatNavy(waist, hip, neck, heightCm, sex)
    bodyFatNavyPct = isNaN(navy) ? null : parseFloat(navy.toFixed(1))
  }

  const primaryBF = bodyFatPct ?? bodyFatNavyPct
  const fatMassKg = primaryBF != null ? parseFloat((weightKg * primaryBF / 100).toFixed(1)) : null
  const leanMassKg = fatMassKg != null ? parseFloat((weightKg - fatMassKg).toFixed(1)) : null
  const bmi = parseFloat((weightKg / ((heightCm / 100) ** 2)).toFixed(1))

  const bmr = calcBMR(weightKg, heightCm, age, sex)
  const tdee = calcTDEEEnhanced(bmr, client.activityLevel, category)

  const goal = client.primaryGoal?.toLowerCase().includes('bajar') ? 'lose'
    : client.primaryGoal?.toLowerCase().includes('definir') ? 'lose'
    : client.primaryGoal?.toLowerCase().includes('ganar') || client.primaryGoal?.toLowerCase().includes('volumen') ? 'gain'
    : 'maintain'
  const kcalRange = goalKcalRange(tdee, goal)
  const targetKcal = Math.round((kcalRange.min + kcalRange.max) / 2)
  const macros = leanMassKg ? macroTargets(targetKcal, leanMassKg, goal, category) : null

  try {
    await db.clientAssessment.create({
      data: {
        clientId,
        date: (form.get('date') as string) || new Date().toISOString().slice(0, 10),
        weightKg,
        tricepsMm: tri,
        subscapMm: sub,
        abdomMm: abd,
        suprailMm: sup,
        thighMm: thi,
        waistCm: waist,
        hipCm: hip,
        neckCm: neck,
        armCm: f('armCm'),
        calfCm: f('calfCm'),
        chestCm: f('chestCm'),
        thighCm: f('thighCm'),
        bodyFatPct,
        bodyFatJP,
        bodyFatNavy: bodyFatNavyPct,
        fatMassKg,
        leanMassKg,
        bmi,
        bmr,
        tdee,
        targetKcal,
        proteinG: macros?.proteinG ?? null,
        carbsG: macros?.carbsG ?? null,
        fatG: macros?.fatG ?? null,
        notes: form.get('notes') as string || null,
      },
    })

    // Update client current weight
    await db.client.update({ where: { id: clientId }, data: { weightKg, updatedAt: new Date() } })
  } catch {
    return { error: 'No se pudo guardar la valoración. Inténtalo de nuevo.' }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}
