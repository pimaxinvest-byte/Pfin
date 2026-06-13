import { NextRequest, NextResponse } from 'next/server'
import { searchFoods } from '@/lib/actions/foods'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  const foods = await searchFoods(q)
  return NextResponse.json(foods)
}
