import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardClient } from '@/components/DashboardClient'
import { LogoutButton } from '@/components/LogoutButton'
import { serializeBookings } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const user = await requireUser(['admin']).catch(() => null)
  if (!user) redirect('/login')

  const [teachers, clients, spaces, activities, bookings] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'teacher', isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' }
    }),
    prisma.user.findMany({
      where: { role: 'client', isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' }
    }),
    prisma.space.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.activity.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.booking.findMany({
      include: {
        teacher: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        space: { select: { id: true, name: true } },
        activity: { select: { id: true, name: true, color: true } }
      },
      orderBy: { startsAt: 'asc' }
    })
  ])

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">GymBook Admin</div>
          <p className="muted">Hola, {user.name}</p>
        </div>
        <LogoutButton />
      </header>
      <DashboardClient initialData={{ user, teachers, clients, spaces, activities, bookings: serializeBookings(bookings) }} />
    </main>
  )
}
