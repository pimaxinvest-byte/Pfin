import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { notifyBookingCreated } from '@/lib/telegram'

const bookingInclude = {
  teacher: { select: { id: true, name: true, email: true, telegramChatId: true, teacherProfile: { select: { color: true } } } },
  client: { select: { id: true, name: true, email: true, telegramChatId: true } },
  space: { select: { id: true, name: true } },
  activity: { select: { id: true, name: true, color: true } },
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'client') {
    return NextResponse.json({ error: 'Solo los clientes pueden reservar' }, { status: 403 })
  }

  const exists = await prisma.booking.findUnique({ where: { id: params.id } })
  if (!exists) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

  const { notes } = await req.json().catch(() => ({}))

  try {
    // Transactional check-and-update prevents race conditions
    const updated = await prisma.$transaction(async (tx) => {
      const fresh = await tx.booking.findUnique({ where: { id: params.id } })
      if (!fresh || fresh.status !== 'available') {
        throw new Error('SLOT_NOT_AVAILABLE')
      }
      return tx.booking.update({
        where: { id: params.id },
        data: { clientId: session.user.id, status: 'booked', notes: notes || fresh.notes },
        include: bookingInclude,
      })
    })

    notifyBookingCreated({
      bookingId: updated.id,
      teacherName: updated.teacher.name,
      teacherChatId: updated.teacher.telegramChatId,
      clientName: updated.client?.name,
      clientChatId: updated.client?.telegramChatId,
      activityName: updated.activity.name,
      spaceName: updated.space.name,
      startDatetime: updated.startDatetime,
      endDatetime: updated.endDatetime,
      status: updated.status,
      notes: updated.notes,
    }).catch(console.error)

    return NextResponse.json(updated)
  } catch (e: any) {
    if (e.message === 'SLOT_NOT_AVAILABLE') {
      return NextResponse.json({ error: 'Esta franja ya no está disponible' }, { status: 409 })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
