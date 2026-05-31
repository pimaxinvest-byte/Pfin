import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

const adminActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('teacher'),
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6)
  }),
  z.object({
    type: z.literal('space'),
    name: z.string().min(2),
    capacity: z.coerce.number().int().min(1).default(1)
  }),
  z.object({
    type: z.literal('activity'),
    name: z.string().min(2),
    duration: z.coerce.number().int().min(15).default(60),
    color: z.string().default('#2563eb')
  })
])

export async function GET() {
  const user = await requireUser()

  const [teachers, clients, spaces, activities, bookings] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'teacher', isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' }
    }),
    user.role === 'admin'
      ? prisma.user.findMany({
          where: { role: 'client', isActive: true },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: 'asc' }
        })
      : Promise.resolve([]),
    prisma.space.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.activity.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.booking.findMany({
      where:
        user.role === 'teacher'
          ? { teacherId: user.id }
          : user.role === 'client'
            ? { OR: [{ clientId: user.id }, { status: 'available' }] }
            : {},
      include: {
        teacher: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        space: { select: { id: true, name: true } },
        activity: { select: { id: true, name: true, color: true } }
      },
      orderBy: { startsAt: 'asc' },
      take: 100
    })
  ])

  return NextResponse.json({ user, teachers, clients, spaces, activities, bookings })
}

export async function POST(req: Request) {
  await requireUser(['admin'])
  const data = adminActionSchema.parse(await req.json())

  if (data.type === 'teacher') {
    const password = await bcrypt.hash(data.password, 12)
    const teacher = await prisma.user.create({
      data: { name: data.name, email: data.email, password, role: 'teacher' },
      select: { id: true, name: true, email: true, role: true }
    })
    return NextResponse.json({ teacher }, { status: 201 })
  }

  if (data.type === 'space') {
    const space = await prisma.space.create({
      data: { name: data.name, capacity: data.capacity }
    })
    return NextResponse.json({ space }, { status: 201 })
  }

  const activity = await prisma.activity.create({
    data: { name: data.name, duration: data.duration, color: data.color }
  })
  return NextResponse.json({ activity }, { status: 201 })
}
