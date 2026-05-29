import { Logo } from './Logo'

export function Credits() {
  return (
    <div
      className="flex flex-col items-center gap-3 py-6 px-4"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <Logo size={40} />
      <div className="text-center">
        <p className="text-xs font-bold text-[var(--ink-2)]">GymBook</p>
        <p className="text-[10px] text-[var(--ink-3)] mt-0.5">
          versión 1.1 · hecho por{' '}
          <span className="font-semibold text-[var(--ink-2)]">Pietro</span>
        </p>
      </div>
    </div>
  )
}
