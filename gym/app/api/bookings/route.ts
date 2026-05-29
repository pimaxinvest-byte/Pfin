import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { notifyBookingCreated } from '@/lib/telegram'
import type { FilterParams } from '@/lib/types'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const filters: FilterParams = {
    teacherId: searchParams.get('teacherId') ?? undefined,
    clientId: searchParams.get('clientId') ?? undefined,
    activityId: searchParams.get('activityId') ?? undefined,
    spaceId: searchParams.get('spaceId') ?? undefined,
    status: (() => {
    const s = searchParams.get('status')
    const valid = ['available', 'booked', 'cancelled', 'completed', 'blocked'] as const
    return valid.includes(s as any) ? (s as typeof valid[number]) : undefined
  })(),
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
  }

  // Clients can only see their own bookings and available slots
  if (session.user.role === 'client') {
    filters.clientId = session.user.id
  }
  // Teachers can only see their own bookings
  if (session.user.role === 'teacher') {
    filters.teacherId = session.user.id
  }

  const where: any = {}
  if (filters.teacherId) where.teacherId = filters.teacherId
  if (filters.clientId) where.clientId = filters.clientId
  if (filters.activityId) where.activityId = filters.activityId
  if (filters.spaceId) where.spaceId = filters.spaceId
  if (filters.status) where.status = filters.status
  if (filters.startDate || filters.endDate) {
    where.startDatetime = {}
    if (filters.startDate) where.startDatetime.gte = new Date(filters.startDate)
    if (filters.endDate) where.startDatetime.lte = new Date(filters.endDate)
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      teacher: { select: { id: true, name: true, email: true, telegramChatId: true, teacherProfile: { select: { color: true } } } },
      client: { select: { id: true, name: true, email: true, telegramChatId: true } },
      space: { select: { id: true, name: true } },
      activity: { select: { id: true, name: true, color: true } },
    },
    orderBy: { startDatetime: 'asc' },
  })

  return NextResponse.json(bookings)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { teacherId, clientId, spaceId, activityId, startDatetime, endDatetime, status, notes } = body

    if (!teacherId || !spaceId || !activityId || !startDatetime || !endDatetime) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    // Role enforcement: teacher can only create for themselves
    if (session.user.role === 'teacher' && teacherId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    // Client can only book (not create availability slots)
    if (session.user.role === 'client' && status === 'available') {
      return NextResponse.json({ error: 'Los clientes no pueden crear disponibilidad' }, { status: 403 })
    }

    // Validate teacher exists
    const teacherUser = await prisma.user.findUnique({ where: { id: teacherId } })
    if (!teacherUser || teacherUser.role !== 'teacher') {
      return NextResponse.json({ error: 'Profesor no válido' }, { status: 400 })
    }

    const start = new Date(startDatetime)
    const end = new Date(endDatetime)

    if (start >= end) {
      return NextResponse.json({ error: 'La hora de inicio debe ser anterior a la hora de fin' }, { status: 400 })
    }

    // Check for overlapping bookings on the same space
    const overlap = await prisma.booking.findFirst({
      where: {
        spaceId,
        status: { notIn: ['cancelled', 'blocked'] },
        OR: [
          { startDatetime: { lt: end }, endDatetime: { gt: start } },
        ],
      },
    })

    if (overlap) {
      return NextResponse.json({
        error: 'Conflicto de horario',
        message: `Ya existe una reserva en este espacio de ${overlap.startDatetime.toISOString()} a ${overlap.endDatetime.toISOString()}`,
        conflict: overlap,
      }, { status: 409 })
    }

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    })

    const booking = await prisma.booking.create({
      data: {
        teacherId,
        clientId: clientId || null,
        spaceId,
        activityId,
        startDatetime: start,
        endDatetime: end,
        status: status || 'available',
        color: teacher?.teacherProfile?.color ?? null,
        notes: notes || null,
        createdBy: session.user.id,
      },
      include: {
        teacher: { select: { id: true, name: true, email: true, telegramChatId: true, teacherProfile: { select: { color: true } } } },
        client: { select: { id: true, name: true, email: true, telegramChatId: true } },
        space: { select: { id: true, name: true } },
        activity: { select: { id: true, name: true, color: true } },
      },
    })

    // Send Telegram notifications
    notifyBookingCreated({
      bookingId: booking.id,
      teacherName: booking.teacher.name,
      teacherChatId: booking.teacher.telegramChatId,
      clientName: booking.client?.name,
      clientChatId: booking.client?.telegramChatId,
      activityName: booking.activity.name,
      spaceName: booking.space.name,
      startDatetime: booking.startDatetime,
      endDatetime: booking.endDatetime,
      status: booking.status,
      notes: booking.notes,
    }).catch(console.error)

    return NextResponse.json(booking, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error al crear reserva' }, { status: 500 })
  }
}
