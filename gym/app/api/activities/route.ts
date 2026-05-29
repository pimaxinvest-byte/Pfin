import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const activities = await prisma.activity.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(activities)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, description, duration, maxClients, color } = await req.json()
  const activity = await prisma.activity.create({
    data: {
      name,
      description: description || null,
      duration: duration || 60,
      maxClients: maxClients || 1,
      color: color || '#10b981',
    },
  })
  return NextResponse.json(activity, { status: 201 })
}
