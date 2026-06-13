import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const USDA_KEY = process.env.USDA_API_KEY ?? 'DEMO_KEY'
const USDA_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'

type UsdaFood = {
  fdcId: number
  description: string
  brandOwner?: string
  foodNutrients: { nutrientId: number; value: number }[]
}

function extractNutrient(nutrients: UsdaFood['foodNutrients'], id: number): number {
  return nutrients.find((n) => n.nutrientId === id)?.value ?? 0
}

function normalizeUsdaFood(f: UsdaFood) {
  return {
    id: `usda_${f.fdcId}`,
    name: f.description
      .toLowerCase()
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .slice(0, 80),
    brand: f.brandOwner ?? null,
    kcalPer100g: Math.round(extractNutrient(f.foodNutrients, 1008)),
    proteinG: parseFloat(extractNutrient(f.foodNutrients, 1003).toFixed(1)),
    carbsG: parseFloat(extractNutrient(f.foodNutrients, 1005).toFixed(1)),
    fatG: parseFloat(extractNutrient(f.foodNutrients, 1004).toFixed(1)),
    fiberG: parseFloat(extractNutrient(f.foodNutrients, 1079).toFixed(1)),
    servingG: 100,
    verified: false,
    source: 'usda' as const,
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json([])

  try {
    const url = new URL(USDA_URL)
    url.searchParams.set('query', q)
    url.searchParams.set('api_key', USDA_KEY)
    url.searchParams.set('pageSize', '20')
    url.searchParams.set('dataType', 'Foundation,SR Legacy')

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`USDA ${res.status}`)

    const data = await res.json()
    const foods = (data.foods ?? []).map(normalizeUsdaFood).filter((f: ReturnType<typeof normalizeUsdaFood>) => f.kcalPer100g > 0)

    // Cache new foods to our local DB
    for (const f of foods.slice(0, 5)) {
      const existId = f.id
      const exists = await db.food.findFirst({ where: { name: f.name } })
      if (!exists) {
        await db.food.create({
          data: {
            name: f.name,
            brand: f.brand,
            kcalPer100g: f.kcalPer100g,
            proteinG: f.proteinG,
            carbsG: f.carbsG,
            fatG: f.fatG,
            fiberG: f.fiberG,
            servingG: f.servingG,
            verified: false,
          },
        }).catch(() => {})
      }
    }

    return NextResponse.json(foods)
  } catch {
    return NextResponse.json([])
  }
}
