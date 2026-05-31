import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

const reserveSchema = z.object({
  bookingId: z.string().min(1)
})

export async function POST(req: Request) {
  const user = await requireUser(['client'])
  const data = reserveSchema.parse(await req.json())

  const result = await prisma.booking.updateMany({
    where: { id: data.bookingId, status: 'available', clientId: null },
    data: { status: 'booked', clientId: user.id }
  })

  if (result.count !== 1) {
    return NextResponse.json({ error: 'La franja ya no esta disponible' }, { status: 409 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    include: {
      teacher: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      space: { select: { id: true, name: true } },
      activity: { select: { id: true, name: true, color: true } }
    }
  })

  return NextResponse.json({ booking })
}
