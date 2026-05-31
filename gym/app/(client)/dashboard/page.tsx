import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDate, formatTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

async function getUpcomingBookings(userId: string) {
  return prisma.booking.findMany({
    where: { clientId: userId, startDatetime: { gte: new Date() }, status: 'booked' },
    include: {
      teacher: { select: { name: true, teacherProfile: { select: { color: true } } } },
      activity: { select: { name: true } },
      space:    { select: { name: true } },
    },
    orderBy: { startDatetime: 'asc' },
    take: 4,
  })
}

export default async function ClientDashboard() {
  const session  = await getSession()
  const upcoming = session?.user ? await getUpcomingBookings(session.user.id) : []
  const firstName = session?.user.name?.split(' ')[0] ?? ''

  return (
    <div className="space-y-6 animate-slide-up">

      {/* Greeting */}
      <div>
        <p className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-0.5">
          Bienvenido
        </p>
        <h2 className="text-2xl font-extrabold text-[var(--ink)] tracking-tight">
          Hola, {firstName} 👋
        </h2>
      </div>

      {/* Hero CTA */}
      <Link href="/dashboard/book"
        className="relative flex items-center gap-4 rounded-3xl p-5 overflow-hidden active:scale-98 transition-transform"
        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 60%, #818cf8 100%)',
                 boxShadow: '0 8px 28px rgba(99,102,241,0.4)' }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-15"
          style={{ background: 'white', transform: 'translate(30%, -30%)', filter: 'blur(20px)' }} />
        <div className="text-4xl">⚡</div>
        <div>
          <p className="text-white font-bold text-base">Reservar sesión</p>
          <p className="text-indigo-200 text-xs mt-0.5">Ver disponibilidad ahora</p>
        </div>
        <span className="ml-auto text-white/60 text-xl">›</span>
      </Link>

      {/* Quick grid */}
      <div className="grid grid-cols-2 gap-3 stagger">
        <QuickCard href="/dashboard/my-bookings" icon="🗓" label="Mis reservas" sub="Historial" color="#0ea5e9" />
        <QuickCard href="/dashboard/teachers"    icon="👥" label="Profesores"   sub="Ver todos" color="#10b981" />
      </div>

      {/* Upcoming */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title">Próximas sesiones</p>
          <Link href="/dashboard/my-bookings" className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>
            Ver todas →
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="card text-center py-10 animate-fade-in">
            <p className="text-4xl mb-3">🏖</p>
            <p className="text-sm font-semibold text-[var(--ink-2)]">Sin sesiones próximas</p>
            <p className="text-xs text-[var(--ink-3)] mt-1">¡Reserva una sesión y empieza!</p>
            <Link href="/dashboard/book"
              className="inline-block mt-4 text-sm font-bold px-5 py-2.5 rounded-full text-white"
              style={{ background: 'var(--brand)' }}>
              Reservar ahora
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5 stagger">
            {upcoming.map((b) => (
              <div key={b.id} className="card-interactive flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-white flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${b.teacher.teacherProfile?.color ?? '#6366f1'}, ${b.teacher.teacherProfile?.color ?? '#6366f1'}cc)`,
                    boxShadow: `0 4px 12px ${b.teacher.teacherProfile?.color ?? '#6366f1'}50`,
                  }}
                >
                  <span className="text-[11px] font-bold leading-none">{formatDate(b.startDatetime, 'd')}</span>
                  <span className="text-[9px] opacity-80 uppercase">{formatDate(b.startDatetime, 'MMM')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--ink)] truncate">{b.activity.name}</p>
                  <p className="text-xs text-[var(--ink-3)]">{b.teacher.name} · {b.space.name}</p>
                  <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--brand)' }}>
                    {formatTime(b.startDatetime)} – {formatTime(b.endDatetime)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function QuickCard({ href, icon, label, sub, color }: { href: string; icon: string; label: string; sub: string; color: string }) {
  return (
    <Link href={href} className="card-interactive animate-slide-up">
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl mb-3"
        style={{ background: `${color}18` }}>
        {icon}
      </div>
      <p className="text-sm font-bold text-[var(--ink)]">{label}</p>
      <p className="text-xs text-[var(--ink-3)]">{sub}</p>
    </Link>
  )
}
