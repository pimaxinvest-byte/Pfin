'use client'

import { formatTime, hexToRgba } from '@/lib/utils'
import type { BookingWithRelations } from '@/lib/types'

interface BookingCardProps {
  booking: BookingWithRelations
  onClick: (booking: BookingWithRelations) => void
  compact?: boolean
}

export function BookingCard({ booking, onClick, compact }: BookingCardProps) {
  const color = booking.color ?? booking.teacher.teacherProfile?.color ?? '#0ea5e9'
  const bg = hexToRgba(color, 0.15)

  return (
    <button
      onClick={() => onClick(booking)}
      className="w-full text-left rounded-xl px-2 py-1.5 mb-1 border-l-4 transition-all active:scale-95"
      style={{ backgroundColor: bg, borderColor: color }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-semibold truncate" style={{ color }}>
          {formatTime(booking.startDatetime)} - {formatTime(booking.endDatetime)}
        </span>
        {!compact && (
          <span className="text-xs text-gray-500 truncate">{booking.activity.name}</span>
        )}
      </div>
      <p className="text-xs text-gray-700 truncate">{booking.teacher.name}</p>
      {booking.client && (
        <p className="text-xs text-gray-500 truncate">👤 {booking.client.name}</p>
      )}
    </button>
  )
}
