import { prisma } from '@/lib/prisma'
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
    prisma.user.count({ where: { role: 'client'  } }),
  ])
  return { today, thisWeek, thisMonth, total, teachers, clients }
}

async function getRecentBookings() {
  return prisma.booking.findMany({
    take: 4, orderBy: { createdAt: 'desc' },
    include: {
      teacher:  { select: { name: true, teacherProfile: { select: { color: true } } } },
      client:   { select: { name: true } },
      activity: { select: { name: true } },
      space:    { select: { name: true } },
    },
  })
}

export default async function AdminDashboard() {
  const [stats, recent] = await Promise.all([getStats(), getRecentBookings()])

  return (
    <div className="space-y-6 animate-slide-up">

      <div>
        <p className="section-title mb-1">Panel de control</p>
        <h2 className="text-2xl font-extrabold text-[var(--ink)] tracking-tight">Dashboard</h2>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 stagger">
        <StatCard icon="📅" label="Hoy"         value={stats.today}    gradient="135deg,#6366f1,#4f46e5" glow="#6366f150" />
        <StatCard icon="📆" label="Esta semana" value={stats.thisWeek}  gradient="135deg,#8b5cf6,#7c3aed" glow="#8b5cf650" />
        <StatCard icon="🗓" label="Este mes"    value={stats.thisMonth} gradient="135deg,#10b981,#059669" glow="#10b98150" />
        <StatCard icon="📊" label="Total"       value={stats.total}    gradient="135deg,#f59e0b,#d97706" glow="#f59e0b50" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SmallStat icon="👨‍🏫" label="Profesores" value={stats.teachers} />
        <SmallStat icon="👤"  label="Clientes"    value={stats.clients} />
      </div>

      {/* Quick actions */}
      <div>
        <p className="section-title mb-3">Acciones rápidas</p>
        <div className="grid grid-cols-2 gap-2.5 stagger">
          {[
            { href: '/admin/users',      icon: '👥', label: 'Usuarios' },
            { href: '/admin/calendar',   icon: '📅', label: 'Calendario' },
            { href: '/admin/spaces',     icon: '🏢', label: 'Espacios' },
            { href: '/admin/activities', icon: '🏋️', label: 'Actividades' },
          ].map(({ href, icon, label }) => (
            <Link key={href} href={href} className="card-interactive flex items-center gap-3 animate-slide-up">
              <span className="text-xl">{icon}</span>
              <span className="text-sm font-semibold text-[var(--ink)]">{label}</span>
              <span className="ml-auto text-[var(--ink-3)]">›</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title">Últimas reservas</p>
          <Link href="/admin/calendar" className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>Ver todas →</Link>
        </div>
        <div className="space-y-2.5">
          {recent.map((b) => (
            <div key={b.id} className="card flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: b.teacher.teacherProfile?.color ?? '#6366f1' }}>
                {b.teacher.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--ink)] truncate">{b.activity.name}</p>
                <p className="text-xs text-[var(--ink-3)]">{b.teacher.name} · {b.space.name}</p>
              </div>
              <span className={`badge ${
                b.status === 'available' ? 'badge-green' :
                b.status === 'booked'    ? 'badge-blue' :
                b.status === 'cancelled' ? 'badge-red'  : 'badge-gray'
              }`}>{b.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, gradient, glow }: { icon: string; label: string; value: number; gradient: string; glow: string }) {
  return (
    <div className="rounded-2xl p-4 text-white relative overflow-hidden"
      style={{ background: `linear-gradient(${gradient})`, boxShadow: `0 6px 20px ${glow}` }}>
      <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-20"
        style={{ background: 'white', transform: 'translate(30%,-30%)', filter: 'blur(12px)' }} />
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-3xl font-extrabold leading-none">{value}</div>
      <div className="text-xs font-semibold opacity-80 mt-1">{label}</div>
    </div>
  )
}

function SmallStat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="card flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xl font-extrabold text-[var(--ink)]">{value}</p>
        <p className="text-xs text-[var(--ink-3)]">{label}</p>
      </div>
    </div>
  )
}
