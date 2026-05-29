'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'

interface HeaderProps {
  title?: string
  subtitle?: string
  showBack?: boolean
  onBack?: () => void
  showLogout?: boolean
  transparent?: boolean
  showLogo?: boolean
  right?: React.ReactNode
}

export function Header({
  title, subtitle, showBack, onBack, showLogout,
  transparent, showLogo, right,
}: HeaderProps) {
  const router = useRouter()

  return (
    <header
      className={cn(
        'fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-40 px-4',
        'flex items-center justify-between gap-3',
        !transparent && 'glass border-b border-white/60',
      )}
      style={{ height: 'var(--header-h)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {showBack && (
          <button onClick={onBack ?? (() => router.back())} className="btn-icon flex-shrink-0">
            <span className="text-base leading-none">←</span>
          </button>
        )}

        {showLogo ? (
          <Logo size={34} withText textColor="var(--ink)" />
        ) : (
          <div className="min-w-0">
            <h1 className={cn('font-bold leading-tight truncate', subtitle ? 'text-sm' : 'text-base')}>
              {title ?? 'GymBook'}
            </h1>
            {subtitle && <p className="text-xs text-[var(--ink-3)] truncate">{subtitle}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {right}
        {showLogout && (
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="btn-icon" title="Cerrar sesión"
          >
            <span className="text-sm leading-none">⎋</span>
          </button>
        )}
      </div>
    </header>
  )
}
