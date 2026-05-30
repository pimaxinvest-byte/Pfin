import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { generateRecurringDates } from '@/lib/utils'
import { notifyRecurringCreated } from '@/lib/telegram'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'client') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const { teacherId, spaceId, activityId, daysOfWeek, startDate, endDate, startTime, endTime, notes } = body

    if (!teacherId || !spaceId || !activityId || !daysOfWeek?.length || !startDate || !endDate || !startTime || !endTime) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    if (session.user.role === 'teacher' && teacherId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    const dates = generateRecurringDates(daysOfWeek, start, end)

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    })
    const activity = await prisma.activity.findUnique({ where: { id: activityId } })

    // Create the recurrence rule
    const rule = await prisma.bookingRecurrenceRule.create({
      data: {
        teacherId,
        spaceId,
        activityId,
        daysOfWeek,
        startDate: start,
        endDate: end,
        startTime,
        endTime,
        notes: notes || null,
      },
    })

    const created: any[] = []
    const conflicts: any[] = []

    for (const date of dates) {
      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)

      const bookingStart = new Date(date)
      bookingStart.setHours(sh, sm, 0, 0)

      const bookingEnd = new Date(date)
      bookingEnd.setHours(eh, em, 0, 0)

      // Check for overlaps
      const overlap = await prisma.booking.findFirst({
        where: {
          spaceId,
          status: { notIn: ['cancelled', 'blocked'] },
          OR: [{ startDatetime: { lt: bookingEnd }, endDatetime: { gt: bookingStart } }],
        },
        include: { space: { select: { name: true } }, teacher: { select: { name: true } } },
      })

      if (overlap) {
        conflicts.push({
          date: bookingStart.toISOString(),
          conflict: { id: overlap.id, start: overlap.startDatetime, end: overlap.endDatetime },
        })
        continue
      }

      const booking = await prisma.booking.create({
        data: {
          teacherId,
          spaceId,
          activityId,
          startDatetime: bookingStart,
          endDatetime: bookingEnd,
          status: 'available',
          color: teacher?.teacherProfile?.color ?? null,
          notes: notes || null,
          recurrenceId: rule.id,
          createdBy: session.user.id,
        },
      })
      created.push(booking)
    }

    // Notify teacher via Telegram
    if (created.length > 0) {
      notifyRecurringCreated(
        teacher?.telegramChatId,
        created.length,
        activity?.name ?? '',
        start,
        end
      ).catch(console.error)
    }

    return NextResponse.json({
      created: created.length,
      skipped: conflicts.length,
      conflicts,
      ruleId: rule.id,
    }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
