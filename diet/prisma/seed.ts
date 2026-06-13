import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

// ─── Base de datos: cocina española y andaluza ─────────────────────────────
// Prevalencia de pescado azul y blanco del Atlántico/Mediterráneo
const foods = [
  // ── Pescado azul (proteína + omega-3) ───────────────────────────────────
  { name: 'Atún fresco a la plancha', kcalPer100g: 144, proteinG: 23.5, carbsG: 0, fatG: 4.9, fiberG: 0, servingG: 150, verified: true },
  { name: 'Caballa a la plancha', kcalPer100g: 191, proteinG: 18.6, carbsG: 0, fatG: 13.0, fiberG: 0, servingG: 150, verified: true },
  { name: 'Sardinas a la plancha', kcalPer100g: 208, proteinG: 24.6, carbsG: 0, fatG: 11.5, fiberG: 0, servingG: 120, verified: true },
  { name: 'Boquerones frescos fritos', kcalPer100g: 230, proteinG: 20.4, carbsG: 5.2, fatG: 14.2, fiberG: 0.2, servingG: 100, verified: true },
  { name: 'Boquerones en vinagre', kcalPer100g: 112, proteinG: 17.8, carbsG: 0.5, fatG: 4.3, fiberG: 0, servingG: 80, verified: true },
  { name: 'Salmón a la plancha', kcalPer100g: 206, proteinG: 20.1, carbsG: 0, fatG: 13.4, fiberG: 0, servingG: 150, verified: true },
  { name: 'Melva en aceite de oliva', kcalPer100g: 192, proteinG: 22.0, carbsG: 0, fatG: 11.8, fiberG: 0, servingG: 80, verified: true },
  // ── Pescado blanco (proteína magra) ─────────────────────────────────────
  { name: 'Merluza al vapor', kcalPer100g: 86, proteinG: 18.9, carbsG: 0, fatG: 1.0, fiberG: 0, servingG: 200, verified: true },
  { name: 'Dorada al horno con verduras', kcalPer100g: 96, proteinG: 18.5, carbsG: 1.5, fatG: 2.2, fiberG: 0.5, servingG: 250, verified: true },
  { name: 'Lubina a la sal', kcalPer100g: 97, proteinG: 19.2, carbsG: 0, fatG: 2.4, fiberG: 0, servingG: 200, verified: true },
  { name: 'Cazón en adobo', kcalPer100g: 178, proteinG: 18.6, carbsG: 8.4, fatG: 7.8, fiberG: 0.6, servingG: 150, verified: true },
  { name: 'Bacalao al pil-pil', kcalPer100g: 162, proteinG: 19.4, carbsG: 0.8, fatG: 9.0, fiberG: 0, servingG: 150, verified: true },
  { name: 'Rape al ajillo', kcalPer100g: 108, proteinG: 18.0, carbsG: 1.2, fatG: 3.5, fiberG: 0, servingG: 200, verified: true },
  { name: 'Corvina al horno', kcalPer100g: 95, proteinG: 19.0, carbsG: 0, fatG: 2.1, fiberG: 0, servingG: 200, verified: true },
  { name: 'Pez espada a la plancha', kcalPer100g: 121, proteinG: 20.5, carbsG: 0, fatG: 4.4, fiberG: 0, servingG: 180, verified: true },
  { name: 'Atún en lata (en agua)', kcalPer100g: 109, proteinG: 25.5, carbsG: 0, fatG: 0.5, fiberG: 0, servingG: 80, verified: true },
  // ── Marisco y moluscos ───────────────────────────────────────────────────
  { name: 'Gambas a la plancha', kcalPer100g: 99, proteinG: 20.3, carbsG: 0.5, fatG: 1.7, fiberG: 0, servingG: 150, verified: true },
  { name: 'Langostinos cocidos', kcalPer100g: 96, proteinG: 20.6, carbsG: 0.2, fatG: 1.4, fiberG: 0, servingG: 150, verified: true },
  { name: 'Pulpo a la gallega', kcalPer100g: 82, proteinG: 14.0, carbsG: 2.2, fatG: 1.0, fiberG: 0, servingG: 200, verified: true },
  { name: 'Berberechos al vapor', kcalPer100g: 74, proteinG: 12.8, carbsG: 2.0, fatG: 0.7, fiberG: 0, servingG: 100, verified: true },
  { name: 'Mejillones al vapor', kcalPer100g: 86, proteinG: 11.9, carbsG: 3.7, fatG: 2.2, fiberG: 0, servingG: 200, verified: true },
  { name: 'Calamares a la plancha', kcalPer100g: 92, proteinG: 15.6, carbsG: 3.1, fatG: 1.5, fiberG: 0, servingG: 150, verified: true },
  // ── Carnes y aves ────────────────────────────────────────────────────────
  { name: 'Pollo a la plancha', kcalPer100g: 165, proteinG: 31.0, carbsG: 0, fatG: 3.6, fiberG: 0, servingG: 150, verified: true },
  { name: 'Pechuga de pavo a la plancha', kcalPer100g: 135, proteinG: 29.9, carbsG: 0, fatG: 1.0, fiberG: 0, servingG: 150, verified: true },
  { name: 'Jamón serrano (sin grasa)', kcalPer100g: 160, proteinG: 30.5, carbsG: 0.5, fatG: 4.5, fiberG: 0, servingG: 50, verified: true },
  { name: 'Ternera a la plancha', kcalPer100g: 186, proteinG: 26.5, carbsG: 0, fatG: 9.0, fiberG: 0, servingG: 150, verified: true },
  { name: 'Huevo entero', kcalPer100g: 155, proteinG: 12.6, carbsG: 1.1, fatG: 10.6, fiberG: 0, servingG: 60, verified: true },
  { name: 'Clara de huevo', kcalPer100g: 52, proteinG: 10.9, carbsG: 0.7, fatG: 0.2, fiberG: 0, servingG: 50, verified: true },
  // ── Cocina andaluza típica ───────────────────────────────────────────────
  { name: 'Gazpacho andaluz', kcalPer100g: 42, proteinG: 1.1, carbsG: 5.8, fatG: 1.8, fiberG: 1.0, servingG: 300, unit: 'ml', verified: true },
  { name: 'Salmorejo cordobés', kcalPer100g: 87, proteinG: 2.1, carbsG: 11.2, fatG: 3.8, fiberG: 0.8, servingG: 250, unit: 'ml', verified: true },
  { name: 'Potaje de garbanzos con bacalao', kcalPer100g: 118, proteinG: 8.4, carbsG: 15.0, fatG: 2.8, fiberG: 4.2, servingG: 350, verified: true },
  { name: 'Espinacas con garbanzos', kcalPer100g: 110, proteinG: 6.5, carbsG: 12.0, fatG: 4.0, fiberG: 4.8, servingG: 300, verified: true },
  { name: 'Rabo de toro estofado', kcalPer100g: 185, proteinG: 16.5, carbsG: 3.8, fatG: 11.8, fiberG: 0.5, servingG: 250, verified: true },
  { name: 'Ensaladilla rusa', kcalPer100g: 145, proteinG: 4.2, carbsG: 12.8, fatG: 8.6, fiberG: 1.5, servingG: 150, verified: true },
  // ── Legumbres ────────────────────────────────────────────────────────────
  { name: 'Garbanzos cocidos', kcalPer100g: 164, proteinG: 8.9, carbsG: 27.4, fatG: 2.6, fiberG: 7.6, servingG: 150, verified: true },
  { name: 'Lentejas estofadas', kcalPer100g: 116, proteinG: 9.0, carbsG: 20.1, fatG: 0.4, fiberG: 7.9, servingG: 200, verified: true },
  { name: 'Habas estofadas', kcalPer100g: 88, proteinG: 6.1, carbsG: 12.0, fatG: 0.6, fiberG: 5.4, servingG: 200, verified: true },
  // ── Hidratos y cereales ──────────────────────────────────────────────────
  { name: 'Arroz blanco cocido', kcalPer100g: 130, proteinG: 2.7, carbsG: 28.2, fatG: 0.3, fiberG: 0.4, servingG: 150, verified: true },
  { name: 'Arroz integral cocido', kcalPer100g: 111, proteinG: 2.6, carbsG: 23.0, fatG: 0.9, fiberG: 1.8, servingG: 150, verified: true },
  { name: 'Pasta integral cocida', kcalPer100g: 131, proteinG: 4.5, carbsG: 25.3, fatG: 1.1, fiberG: 3.4, servingG: 150, verified: true },
  { name: 'Pan de pueblo (masa madre)', kcalPer100g: 245, proteinG: 8.0, carbsG: 47.2, fatG: 1.5, fiberG: 3.2, servingG: 60, verified: true },
  { name: 'Avena cocida', kcalPer100g: 71, proteinG: 2.5, carbsG: 12.0, fatG: 1.4, fiberG: 1.7, servingG: 250, verified: true },
  { name: 'Patata cocida', kcalPer100g: 77, proteinG: 2.0, carbsG: 17.0, fatG: 0.1, fiberG: 1.8, servingG: 200, verified: true },
  { name: 'Boniato al horno', kcalPer100g: 90, proteinG: 2.0, carbsG: 20.7, fatG: 0.1, fiberG: 3.0, servingG: 200, verified: true },
  // ── Lácteos y derivados ──────────────────────────────────────────────────
  { name: 'Yogur griego natural 0%', kcalPer100g: 57, proteinG: 9.5, carbsG: 4.0, fatG: 0.2, fiberG: 0, servingG: 150, verified: true },
  { name: 'Queso fresco Burgos', kcalPer100g: 98, proteinG: 12.0, carbsG: 3.3, fatG: 4.3, fiberG: 0, servingG: 80, verified: true },
  { name: 'Leche desnatada', kcalPer100g: 35, proteinG: 3.4, carbsG: 5.0, fatG: 0.1, fiberG: 0, servingG: 250, unit: 'ml', verified: true },
  // ── Verduras ─────────────────────────────────────────────────────────────
  { name: 'Tomate natural', kcalPer100g: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2, fiberG: 1.2, servingG: 150, verified: true },
  { name: 'Pimiento rojo asado', kcalPer100g: 32, proteinG: 1.0, carbsG: 6.3, fatG: 0.3, fiberG: 1.8, servingG: 120, verified: true },
  { name: 'Berenjenas al horno', kcalPer100g: 24, proteinG: 1.0, carbsG: 5.7, fatG: 0.2, fiberG: 3.0, servingG: 200, verified: true },
  { name: 'Espinacas rehogadas', kcalPer100g: 28, proteinG: 2.9, carbsG: 1.6, fatG: 0.7, fiberG: 2.6, servingG: 150, verified: true },
  { name: 'Brócoli al vapor', kcalPer100g: 35, proteinG: 2.4, carbsG: 7.2, fatG: 0.4, fiberG: 3.3, servingG: 200, verified: true },
  { name: 'Ensalada mixta', kcalPer100g: 15, proteinG: 1.0, carbsG: 2.5, fatG: 0.2, fiberG: 1.4, servingG: 200, verified: true },
  // ── Frutas ───────────────────────────────────────────────────────────────
  { name: 'Naranja', kcalPer100g: 47, proteinG: 0.9, carbsG: 11.8, fatG: 0.1, fiberG: 2.4, servingG: 180, verified: true },
  { name: 'Manzana', kcalPer100g: 52, proteinG: 0.3, carbsG: 13.8, fatG: 0.2, fiberG: 2.4, servingG: 150, verified: true },
  { name: 'Plátano', kcalPer100g: 89, proteinG: 1.1, carbsG: 22.8, fatG: 0.3, fiberG: 2.6, servingG: 120, verified: true },
  { name: 'Fresas', kcalPer100g: 32, proteinG: 0.7, carbsG: 7.7, fatG: 0.3, fiberG: 2.0, servingG: 150, verified: true },
  { name: 'Higos frescos', kcalPer100g: 74, proteinG: 0.8, carbsG: 19.2, fatG: 0.3, fiberG: 2.9, servingG: 80, verified: true },
  // ── Grasas saludables ────────────────────────────────────────────────────
  { name: 'Aceite de oliva virgen extra', kcalPer100g: 884, proteinG: 0, carbsG: 0, fatG: 100.0, fiberG: 0, servingG: 10, unit: 'ml', verified: true },
  { name: 'Aguacate', kcalPer100g: 160, proteinG: 2.0, carbsG: 8.5, fatG: 14.7, fiberG: 6.7, servingG: 100, verified: true },
  { name: 'Almendras tostadas', kcalPer100g: 578, proteinG: 21.2, carbsG: 21.5, fatG: 49.9, fiberG: 12.5, servingG: 30, verified: true },
  { name: 'Nueces', kcalPer100g: 654, proteinG: 15.2, carbsG: 13.7, fatG: 65.2, fiberG: 6.7, servingG: 30, verified: true },
  // ── Suplementos culturismo ───────────────────────────────────────────────
  { name: 'Proteína de suero (whey) en polvo', kcalPer100g: 370, proteinG: 75.0, carbsG: 8.0, fatG: 5.0, fiberG: 0, servingG: 30, verified: true },
  { name: 'Caseína en polvo', kcalPer100g: 360, proteinG: 77.0, carbsG: 5.0, fatG: 3.0, fiberG: 0, servingG: 30, verified: true },
  { name: 'Claras de huevo pasteurizadas (líquidas)', kcalPer100g: 52, proteinG: 10.9, carbsG: 0.7, fatG: 0.2, fiberG: 0, servingG: 200, unit: 'ml', verified: true },
]

// ─── Plan semanal tipo (cocina andaluza) ─────────────────────────────────────
// Para referencia del sistema de generación de plan
const weeklyPlanTemplate = {
  lunes:     { desayuno: 'Avena con leche desnatada + fresas', comida: 'Merluza al vapor + arroz integral + ensalada', cena: 'Gambas a la plancha + brócoli al vapor', snack: 'Yogur griego 0% + almendras' },
  martes:    { desayuno: 'Huevos revueltos + pan de pueblo', comida: 'Potaje de garbanzos con bacalao', cena: 'Lubina a la sal + pimiento rojo asado', snack: 'Plátano + proteína whey' },
  miercoles: { desayuno: 'Yogur griego 0% + naranja', comida: 'Dorada al horno + patata cocida + espinacas', cena: 'Pechuga de pavo + berenjenas al horno', snack: 'Claras de huevo + manzana' },
  jueves:    { desayuno: 'Avena + plátano + nueces', comida: 'Atún fresco a la plancha + pasta integral + tomate', cena: 'Calamares a la plancha + ensalada mixta', snack: 'Queso fresco Burgos + fresas' },
  viernes:   { desayuno: 'Huevos + jamón serrano + naranja', comida: 'Espinacas con garbanzos + sardinas', cena: 'Salmón + boniato al horno', snack: 'Yogur griego 0% + nueces' },
  sabado:    { desayuno: 'Salmorejo cordobés + huevo', comida: 'Cazón en adobo + arroz blanco + ensalada', cena: 'Pez espada a la plancha + verduras asadas', snack: 'Fruta + almendras' },
  domingo:   { desayuno: 'Gazpacho + tostada con aceite de oliva', comida: 'Lentejas estofadas + merluza', cena: 'Atún en lata + patata + ensalada', snack: 'Plátano + caseína' },
}

async function main() {
  console.log('Sembrando alimentos (cocina española y andaluza)…')
  for (const food of foods) {
    const exists = await db.food.findFirst({ where: { name: food.name } })
    if (!exists) {
      await db.food.create({ data: food })
    }
  }
  console.log(`${foods.length} alimentos añadidos.`)

  const hash = await bcrypt.hash('demo1234', 10)
  const user = await db.user.upsert({
    where: { email: 'demo@dietbook.com' },
    update: {},
    create: {
      email: 'demo@dietbook.com',
      password: hash,
      name: 'Demo',
      profile: {
        create: {
          sex: 'M',
          weightKg: 80,
          heightCm: 178,
          birthYear: 1992,
          goal: 'gain',
          activityLevel: 'active',
        },
      },
      goals: {
        create: { kcal: 2800, proteinG: 200, carbsG: 280, fatG: 80, fiberG: 35 },
      },
    },
  })

  console.log(`\nUsuario demo: ${user.email} / demo1234`)
  console.log('Plan semanal tipo guardado en referencias.')
  console.log(weeklyPlanTemplate)
}

main().catch(console.error).finally(() => db.$disconnect())
