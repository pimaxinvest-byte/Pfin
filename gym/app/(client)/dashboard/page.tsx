import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDate, formatTime } from '@/lib/utils'

async function getUpcomingBookings(userId: string) {
  return prisma.booking.findMany({
    where: {
      clientId: userId,
      startDatetime: { gte: new Date() },
      status: { in: ['booked'] },
    },
    include: {
      teacher: { select: { name: true, teacherProfile: { select: { color: true } } } },
      activity: { select: { name: true } },
      space: { select: { name: true } },
    },
    orderBy: { startDatetime: 'asc' },
    take: 5,
  })
}

export default async function ClientDashboard() {
  const session = await getSession()
  const upcoming = session?.user ? await getUpcomingBookings(session.user.id) : []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">¡Hola, {session?.user.name?.split(' ')[0]}! 👋</h2>
        <p className="text-sm text-gray-500">¿Listo para entrenar?</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/book"
          className="bg-sky-500 rounded-2xl p-4 text-white active:scale-95 transition-transform">
          <div className="text-3xl mb-2">📅</div>
          <p className="font-semibold text-sm">Reservar sesión</p>
          <p className="text-xs text-sky-100 mt-0.5">Ver disponibilidad</p>
        </Link>
        <Link href="/dashboard/my-bookings"
          className="bg-white border border-gray-100 rounded-2xl p-4 text-gray-900 active:scale-95 transition-transform shadow-sm">
          <div className="text-3xl mb-2">🗓</div>
          <p className="font-semibold text-sm">Mis reservas</p>
          <p className="text-xs text-gray-400 mt-0.5">Historial</p>
        </Link>
      </div>

      {/* Upcoming */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Próximas sesiones</h3>
          <Link href="/dashboard/my-bookings" className="text-xs text-sky-500">Ver todas</Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-3xl mb-2">🏖</p>
            <p className="text-sm text-gray-500">No tienes sesiones próximas</p>
            <Link href="/dashboard/book" className="text-sky-500 text-sm font-medium mt-2 inline-block">
              Reserva una sesión →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => (
              <div key={b.id} className="card flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: b.teacher.teacherProfile?.color ?? '#0ea5e9' }}
                >
                  <span className="text-xs font-bold">{formatDate(b.startDatetime, 'd')}</span>
                  <span className="text-xs opacity-80">{formatDate(b.startDatetime, 'MMM')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{b.activity.name}</p>
                  <p className="text-xs text-gray-500">{b.teacher.name} · {b.space.name}</p>
                  <p className="text-xs text-gray-400">{formatTime(b.startDatetime)} – {formatTime(b.endDatetime)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
