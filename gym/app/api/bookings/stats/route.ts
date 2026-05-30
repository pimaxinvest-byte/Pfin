import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'teacher'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const teacherFilter = session.user.role === 'teacher' ? { teacherId: session.user.id } : {}

  const [today, thisWeek, thisMonth, byTeacher, byActivity] = await Promise.all([
    prisma.booking.count({
      where: { ...teacherFilter, startDatetime: { gte: startOfDay(now), lte: endOfDay(now) } },
    }),
    prisma.booking.count({
      where: { ...teacherFilter, startDatetime: { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) } },
    }),
    prisma.booking.count({
      where: { ...teacherFilter, startDatetime: { gte: startOfMonth(now), lte: endOfMonth(now) } },
    }),
    session.user.role === 'admin'
      ? prisma.booking.groupBy({
          by: ['teacherId'],
          _count: { id: true },
          where: { startDatetime: { gte: startOfMonth(now) } },
        })
      : Promise.resolve([]),
    prisma.booking.groupBy({
      by: ['activityId'],
      _count: { id: true },
      where: { ...teacherFilter, startDatetime: { gte: startOfMonth(now) } },
    }),
  ])

  return NextResponse.json({ today, thisWeek, thisMonth, byTeacher, byActivity })
}
