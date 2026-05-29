'use client'

import { formatTime, hexToRgba } from '@/lib/utils'
import type { BookingWithRelations } from '@/lib/types'

interface BookingCardProps {
  booking: BookingWithRelations
  onClick: (b: BookingWithRelations) => void
  compact?: boolean
}

const STATUS_ICON: Record<string, string> = {
  available: '○',
  booked:    '●',
  cancelled: '✕',
  completed: '✓',
  blocked:   '⊘',
}

export function BookingCard({ booking, onClick, compact }: BookingCardProps) {
  const color = booking.color ?? booking.teacher.teacherProfile?.color ?? '#6366f1'

  return (
    <button
      onClick={() => onClick(booking)}
      className="w-full text-left rounded-2xl px-3 py-2.5 mb-1.5
                 transition-all duration-150 active:scale-95 border border-white/60"
      style={{
        background: hexToRgba(color, 0.10),
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
          {formatTime(booking.startDatetime)}
          {!compact && ` – ${formatTime(booking.endDatetime)}`}
        </span>
        <span className="text-[10px]" style={{ color }}>
          {STATUS_ICON[booking.status] ?? '○'}
        </span>
      </div>
      <p className="text-xs font-semibold text-[var(--ink)] truncate leading-tight">
        {compact ? booking.teacher.name.split(' ')[0] : booking.activity.name}
      </p>
      {!compact && (
        <p className="text-[10px] text-[var(--ink-3)] truncate mt-0.5">
          {booking.teacher.name}
          {booking.client && ` · ${booking.client.name}`}
        </p>
      )}
    </button>
  )
}
