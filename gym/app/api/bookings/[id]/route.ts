import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { notifyBookingCancelled, notifyBookingModified } from '@/lib/telegram'

const bookingInclude = {
  teacher: { select: { id: true, name: true, email: true, telegramChatId: true, teacherProfile: { select: { color: true } } } },
  client: { select: { id: true, name: true, email: true, telegramChatId: true } },
  space: { select: { id: true, name: true } },
  activity: { select: { id: true, name: true, color: true } },
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const booking = await prisma.booking.findUnique({ where: { id: params.id }, include: bookingInclude })
  if (!booking) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return NextResponse.json(booking)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.booking.findUnique({ where: { id: params.id }, include: bookingInclude })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Role-based access control
  if (session.user.role === 'teacher' && existing.teacherId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (session.user.role === 'client') {
    // Clients can only cancel their own booking - nothing else
    if (existing.clientId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  try {
    const body = await req.json()
    const { status, clientId, notes, startDatetime, endDatetime } = body

    // Clients can only set status to cancelled - no other modifications allowed
    if (session.user.role === 'client') {
      if (status !== 'cancelled') {
        return NextResponse.json({ error: 'Los clientes solo pueden cancelar reservas' }, { status: 403 })
      }
      const cancelled = await prisma.booking.update({
        where: { id: params.id },
        data: { status: 'cancelled' },
        include: bookingInclude,
      })
      notifyBookingCancelled({
        bookingId: cancelled.id,
        teacherName: cancelled.teacher.name,
        teacherChatId: cancelled.teacher.telegramChatId,
        clientName: cancelled.client?.name,
        clientChatId: cancelled.client?.telegramChatId,
        activityName: cancelled.activity.name,
        spaceName: cancelled.space.name,
        startDatetime: cancelled.startDatetime,
        endDatetime: cancelled.endDatetime,
        status: cancelled.status,
        notes: cancelled.notes,
      }).catch(console.error)
      return NextResponse.json(cancelled)
    }

    // Check for time conflicts if rescheduling
    if (startDatetime || endDatetime) {
      const newStart = startDatetime ? new Date(startDatetime) : existing.startDatetime
      const newEnd = endDatetime ? new Date(endDatetime) : existing.endDatetime
      const conflict = await prisma.booking.findFirst({
        where: {
          spaceId: existing.spaceId,
          id: { not: params.id },
          status: { notIn: ['cancelled', 'blocked'] },
          OR: [{ startDatetime: { lt: newEnd }, endDatetime: { gt: newStart } }],
        },
      })
      if (conflict) {
        return NextResponse.json({ error: 'Conflicto de horario con otra reserva' }, { status: 409 })
      }
    }

    const updated = await prisma.booking.update({
      where: { id: params.id },
      data: {
        ...(status !== undefined && { status }),
        ...(clientId !== undefined && { clientId }),
        ...(notes !== undefined && { notes }),
        ...(startDatetime && { startDatetime: new Date(startDatetime) }),
        ...(endDatetime && { endDatetime: new Date(endDatetime) }),
      },
      include: bookingInclude,
    })

    const notifyData = {
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
    }

    if (updated.status === 'cancelled') {
      notifyBookingCancelled(notifyData).catch(console.error)
    } else {
      notifyBookingModified(notifyData).catch(console.error)
    }

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'client') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const existing = await prisma.booking.findUnique({ where: { id: params.id }, include: bookingInclude })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (session.user.role === 'teacher' && existing.teacherId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  await prisma.booking.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
