'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: string
}

const clientNav: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠' },
  { href: '/dashboard/book', label: 'Reservar', icon: '📅' },
  { href: '/dashboard/teachers', label: 'Profesores', icon: '👨‍🏫' },
  { href: '/dashboard/my-bookings', label: 'Mis reservas', icon: '🗓' },
]

const teacherNav: NavItem[] = [
  { href: '/teacher', label: 'Calendario', icon: '📅' },
  { href: '/teacher/bookings', label: 'Reservas', icon: '🗓' },
  { href: '/teacher/recurring', label: 'Recurrente', icon: '🔁' },
]

const adminNav: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/calendar', label: 'Calendario', icon: '📅' },
  { href: '/admin/users', label: 'Usuarios', icon: '👥' },
  { href: '/admin/spaces', label: 'Espacios', icon: '🏢' },
  { href: '/admin/settings', label: 'Config', icon: '⚙️' },
]

interface BottomNavProps {
  role: 'admin' | 'teacher' | 'client'
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname()
  const items = role === 'admin' ? adminNav : role === 'teacher' ? teacherNav : clientNav

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== '/admin' && item.href !== '/teacher' && item.href !== '/dashboard' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors min-w-0',
              active ? 'text-sky-600' : 'text-gray-400'
            )}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className={cn('text-xs font-medium truncate', active ? 'text-sky-600' : 'text-gray-400')}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
