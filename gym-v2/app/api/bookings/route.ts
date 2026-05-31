import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

const bookingSchema = z.object({
  teacherId: z.string().optional(),
  spaceId: z.string().min(1),
  activityId: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  notes: z.string().optional()
})

export async function GET() {
  const user = await requireUser()
  const bookings = await prisma.booking.findMany({
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
    orderBy: { startsAt: 'asc' }
  })

  return NextResponse.json({ bookings })
}

export async function POST(req: Request) {
  const user = await requireUser(['admin', 'teacher'])
  const data = bookingSchema.parse(await req.json())

  const teacherId = user.role === 'teacher' ? user.id : data.teacherId
  if (!teacherId) {
    return NextResponse.json({ error: 'Falta profesor' }, { status: 400 })
  }

  const startsAt = new Date(data.startsAt)
  const endsAt = new Date(data.endsAt)
  if (startsAt >= endsAt) {
    return NextResponse.json({ error: 'La hora de fin debe ser posterior' }, { status: 400 })
  }

  const conflict = await prisma.booking.findFirst({
    where: {
      spaceId: data.spaceId,
      status: { not: 'cancelled' },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt }
    }
  })
  if (conflict) {
    return NextResponse.json({ error: 'Ya existe una reserva en ese horario y sala' }, { status: 409 })
  }

  const booking = await prisma.booking.create({
    data: {
      teacherId,
      spaceId: data.spaceId,
      activityId: data.activityId,
      startsAt,
      endsAt,
      notes: data.notes || null,
      status: 'available'
    }
  })

  return NextResponse.json({ booking }, { status: 201 })
}
