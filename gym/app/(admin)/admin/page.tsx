import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns'
import Link from 'next/link'

async function getStats() {
  const now = new Date()
  const [today, thisWeek, thisMonth, total, teachers, clients] = await Promise.all([
    prisma.booking.count({ where: { startDatetime: { gte: startOfDay(now), lte: endOfDay(now) } } }),
    prisma.booking.count({ where: { startDatetime: { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) } } }),
    prisma.booking.count({ where: { startDatetime: { gte: startOfMonth(now), lte: endOfMonth(now) } } }),
    prisma.booking.count(),
    prisma.user.count({ where: { role: 'teacher' } }),
    prisma.user.count({ where: { role: 'client' } }),
  ])
  return { today, thisWeek, thisMonth, total, teachers, clients }
}

async function getRecentBookings() {
  return prisma.booking.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      teacher: { select: { name: true } },
      client: { select: { name: true } },
      activity: { select: { name: true } },
      space: { select: { name: true } },
    },
  })
}

export default async function AdminDashboard() {
  const [stats, recent] = await Promise.all([getStats(), getRecentBookings()])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500">Resumen del gimnasio</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon="📅" label="Hoy" value={stats.today} color="bg-sky-50 text-sky-700" />
        <StatCard icon="📆" label="Esta semana" value={stats.thisWeek} color="bg-purple-50 text-purple-700" />
        <StatCard icon="🗓" label="Este mes" value={stats.thisMonth} color="bg-green-50 text-green-700" />
        <StatCard icon="📊" label="Total" value={stats.total} color="bg-orange-50 text-orange-700" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon="👨‍🏫" label="Profesores" value={stats.teachers} color="bg-indigo-50 text-indigo-700" />
        <StatCard icon="👤" label="Clientes" value={stats.clients} color="bg-pink-50 text-pink-700" />
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Acciones rápidas</h3>
        <div className="grid grid-cols-2 gap-2">
          <QuickLink href="/admin/users" icon="👥" label="Gestionar usuarios" />
          <QuickLink href="/admin/calendar" icon="📅" label="Ver calendario" />
          <QuickLink href="/admin/spaces" icon="🏢" label="Espacios" />
          <QuickLink href="/admin/settings" icon="⚙️" label="Configuración" />
        </div>
      </div>

      {/* Recent bookings */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Últimas reservas</h3>
        <div className="space-y-2">
          {recent.map((b) => (
            <div key={b.id} className="card flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                🏋️
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{b.activity.name}</p>
                <p className="text-xs text-gray-500">{b.teacher.name} · {b.space.name}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                b.status === 'available' ? 'bg-green-100 text-green-700' :
                b.status === 'booked' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }`}>{b.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className={`rounded-2xl p-4 ${color}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium opacity-80">{label}</div>
    </div>
  )
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="card flex items-center gap-3 active:scale-95 transition-transform">
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </Link>
  )
}
