import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const spaces = await prisma.space.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(spaces)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, description, capacity } = await req.json()
  const space = await prisma.space.create({
    data: { name, description: description || null, capacity: capacity || 1 },
  })
  return NextResponse.json(space, { status: 201 })
}
