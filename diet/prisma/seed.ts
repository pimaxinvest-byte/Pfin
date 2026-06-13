import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const foods = [
  { name: 'Pollo a la plancha', kcalPer100g: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0, verified: true },
  { name: 'Arroz blanco cocido', kcalPer100g: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4, verified: true },
  { name: 'Huevo entero', kcalPer100g: 155, proteinG: 13, carbsG: 1.1, fatG: 11, fiberG: 0, servingG: 60, verified: true },
  { name: 'Leche entera', kcalPer100g: 61, proteinG: 3.2, carbsG: 4.8, fatG: 3.3, fiberG: 0, unit: 'ml', verified: true },
  { name: 'Pan integral', kcalPer100g: 247, proteinG: 8.5, carbsG: 41, fatG: 3.4, fiberG: 6.5, servingG: 30, verified: true },
  { name: 'Avena', kcalPer100g: 389, proteinG: 17, carbsG: 66, fatG: 7, fiberG: 10.6, servingG: 40, verified: true },
  { name: 'Manzana', kcalPer100g: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2, fiberG: 2.4, servingG: 150, verified: true },
  { name: 'Platano', kcalPer100g: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3, fiberG: 2.6, servingG: 120, verified: true },
  { name: 'Lentejas cocidas', kcalPer100g: 116, proteinG: 9, carbsG: 20, fatG: 0.4, fiberG: 7.9, verified: true },
  { name: 'Salmon a la plancha', kcalPer100g: 206, proteinG: 20, carbsG: 0, fatG: 13, fiberG: 0, verified: true },
  { name: 'Yogur griego natural', kcalPer100g: 97, proteinG: 9, carbsG: 4, fatG: 5, fiberG: 0, servingG: 150, verified: true },
  { name: 'Almendras', kcalPer100g: 579, proteinG: 21, carbsG: 22, fatG: 50, fiberG: 12.5, servingG: 30, verified: true },
  { name: 'Brocoli cocido', kcalPer100g: 35, proteinG: 2.4, carbsG: 7.2, fatG: 0.4, fiberG: 3.3, verified: true },
  { name: 'Tomate', kcalPer100g: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2, fiberG: 1.2, servingG: 100, verified: true },
  { name: 'Pasta cocida', kcalPer100g: 131, proteinG: 4.5, carbsG: 25, fatG: 1.1, fiberG: 1.8, verified: true },
  { name: 'Pechuga de pavo', kcalPer100g: 135, proteinG: 30, carbsG: 0, fatG: 1, fiberG: 0, verified: true },
  { name: 'Aceite de oliva', kcalPer100g: 884, proteinG: 0, carbsG: 0, fatG: 100, fiberG: 0, servingG: 10, unit: 'ml', verified: true },
  { name: 'Naranja', kcalPer100g: 47, proteinG: 0.9, carbsG: 12, fatG: 0.1, fiberG: 2.4, servingG: 150, verified: true },
  { name: 'Queso fresco', kcalPer100g: 98, proteinG: 12, carbsG: 3.3, fatG: 4.3, fiberG: 0, servingG: 50, verified: true },
  { name: 'Atun en lata', kcalPer100g: 116, proteinG: 25.5, carbsG: 0, fatG: 1, fiberG: 0, servingG: 80, verified: true },
]

async function main() {
  for (const food of foods) {
    await db.food.upsert({
      where: { id: food.name },
      update: food,
      create: { ...food, id: undefined },
    })
  }

  const hash = await bcrypt.hash('demo1234', 10)
  const user = await db.user.upsert({
    where: { email: 'demo@dietbook.com' },
    update: {},
    create: {
      email: 'demo@dietbook.com',
      password: hash,
      name: 'Demo',
      profile: {
        create: { weightKg: 75, heightCm: 175, birthYear: 1990, goal: 'lose', activityLevel: 'moderate' },
      },
      goals: {
        create: { kcal: 1800, proteinG: 140, carbsG: 180, fatG: 60, fiberG: 30 },
      },
    },
  })

  console.log(`Seed complete. Demo user: ${user.email} / demo1234`)
}

main().catch(console.error).finally(() => db.$disconnect())
