'use client'

import { formatDate } from '@/lib/utils'
import { BookingCard } from './BookingCard'
import type { BookingWithRelations } from '@/lib/types'
import { isSameDay } from 'date-fns'

interface DayViewProps {
  date: Date
  bookings: BookingWithRelations[]
  onBookingClick: (b: BookingWithRelations) => void
}

export function DayView({ date, bookings, onBookingClick }: DayViewProps) {
  const dayBookings = [...bookings]
    .filter((b) => isSameDay(new Date(b.startDatetime), date))
    .sort((a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime())

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {/* Day header */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)]">
            {formatDate(date, 'EEEE')}
          </p>
          <p className="text-xl font-bold text-[var(--ink)] leading-tight">
            {formatDate(date, "d 'de' MMMM")}
          </p>
        </div>
        {dayBookings.length > 0 && (
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-bold text-white"
            style={{ background: 'var(--brand)' }}>
            {dayBookings.length}
          </div>
        )}
      </div>

      {/* Bookings */}
      {dayBookings.length === 0 ? (
        <div className="py-14 text-center bg-white">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm font-medium text-[var(--ink-3)]">Sin reservas este día</p>
        </div>
      ) : (
        <div className="bg-white p-3">
          {dayBookings.map((b) => (
            <BookingCard key={b.id} booking={b} onClick={onBookingClick} />
          ))}
        </div>
      )}
    </div>
  )
}
