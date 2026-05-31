import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function getTeachers() {
  return prisma.user.findMany({
    where: { role: 'teacher', isActive: true },
    select: {
      id: true, name: true, email: true,
      teacherProfile: { select: { color: true, bio: true, specialties: true } },
      _count: { select: { teacherBookings: { where: { status: { in: ['available', 'booked'] } } } } },
    },
    orderBy: { name: 'asc' },
  })
}

export default async function TeachersPage() {
  const teachers = await getTeachers()

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Profesores</h2>
        <p className="text-sm text-gray-500">{teachers.length} disponibles</p>
      </div>

      <div className="space-y-3">
        {teachers.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard/book?teacherId=${t.id}`}
            className="card flex items-center gap-4 active:scale-95 transition-transform"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
              style={{ backgroundColor: t.teacherProfile?.color ?? '#0ea5e9' }}
            >
              {t.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{t.name}</p>
              {t.teacherProfile?.specialties && (
                <p className="text-xs text-gray-500 truncate">{t.teacherProfile.specialties}</p>
              )}
              {t.teacherProfile?.bio && (
                <p className="text-xs text-gray-400 truncate mt-0.5">{t.teacherProfile.bio}</p>
              )}
              <p className="text-xs text-sky-500 mt-1">
                {t._count.teacherBookings} sesiones disponibles
              </p>
            </div>
            <span className="text-gray-300 flex-shrink-0">›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
