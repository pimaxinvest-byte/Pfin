'use client'

import { signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'

interface HeaderProps {
  title?: string
  showBack?: boolean
  onBack?: () => void
  showLogout?: boolean
}

export function Header({ title, showBack, onBack, showLogout }: HeaderProps) {
  const { data: session } = useSession()

  return (
    <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
            ←
          </button>
        )}
        <div>
          <h1 className="text-base font-semibold text-gray-900">{title || '🏋️ GymBook'}</h1>
          {session?.user && (
            <p className="text-xs text-gray-400">{session.user.name}</p>
          )}
        </div>
      </div>
      {showLogout && (
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl"
        >
          Salir
        </button>
      )}
    </header>
  )
}
