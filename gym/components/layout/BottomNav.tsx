'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItem { href: string; label: string; icon: string }

const clientNav: NavItem[] = [
  { href: '/dashboard',             label: 'Inicio',    icon: '⊙' },
  { href: '/dashboard/book',        label: 'Reservar',  icon: '＋' },
  { href: '/dashboard/teachers',    label: 'Profes',    icon: '◎' },
  { href: '/dashboard/my-bookings', label: 'Mis citas', icon: '▣' },
]

const teacherNav: NavItem[] = [
  { href: '/teacher',            label: 'Calendario', icon: '⊞' },
  { href: '/teacher/bookings',   label: 'Reservas',   icon: '▣' },
  { href: '/teacher/recurring',  label: 'Recurrente', icon: '↻' },
]

const adminNav: NavItem[] = [
  { href: '/admin',          label: 'Dashboard', icon: '◈' },
  { href: '/admin/calendar', label: 'Calendario', icon: '⊞' },
  { href: '/admin/users',    label: 'Usuarios',  icon: '◎' },
  { href: '/admin/spaces',   label: 'Espacios',  icon: '⬡' },
  { href: '/admin/settings', label: 'Config',    icon: '⚙' },
]

export function BottomNav({ role }: { role: 'admin' | 'teacher' | 'client' }) {
  const pathname = usePathname()
  const items = role === 'admin' ? adminNav : role === 'teacher' ? teacherNav : clientNav

  function isActive(href: string) {
    if (href === '/admin' || href === '/teacher' || href === '/dashboard') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-24px)] max-w-[calc(512px-24px)]"
      style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.14))' }}
    >
      <div className="glass rounded-[22px] border border-white/60 px-2 pt-2 bottom-nav-safe">
        <div className="flex items-center justify-around">
          {items.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 min-w-0 relative',
                  active ? 'text-[var(--brand)]' : 'text-[var(--ink-3)]'
                )}
              >
                {active && (
                  <span
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: 'rgba(99,102,241,0.1)' }}
                  />
                )}
                <span className={cn(
                  'text-xl leading-none transition-transform duration-200 relative',
                  active && 'scale-110'
                )}>
                  {item.icon}
                </span>
                <span className={cn(
                  'text-[10px] font-semibold tracking-wide truncate relative',
                  active ? 'text-[var(--brand)]' : 'text-[var(--ink-3)]'
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
