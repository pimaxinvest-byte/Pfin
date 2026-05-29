'use client'

import { formatDate } from '@/lib/utils'
import { BookingCard } from './BookingCard'
import type { BookingWithRelations } from '@/lib/types'
import { isSameDay } from 'date-fns'

interface DayViewProps {
  date: Date
  bookings: BookingWithRelations[]
  onBookingClick: (booking: BookingWithRelations) => void
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7am to 8pm

export function DayView({ date, bookings, onBookingClick }: DayViewProps) {
  const dayBookings = bookings.filter((b) => isSameDay(new Date(b.startDatetime), date))
  const sortedBookings = [...dayBookings].sort(
    (a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime()
  )

  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <div className="bg-sky-50 px-4 py-3 border-b border-sky-100">
        <h3 className="font-semibold text-sky-900 capitalize">{formatDate(date, "EEEE d 'de' MMMM")}</h3>
        <p className="text-sm text-sky-600">{dayBookings.length} reserva{dayBookings.length !== 1 ? 's' : ''}</p>
      </div>

      {sortedBookings.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm">Sin reservas este día</p>
        </div>
      ) : (
        <div className="p-3 space-y-1">
          {sortedBookings.map((b) => (
            <BookingCard key={b.id} booking={b} onClick={onBookingClick} />
          ))}
        </div>
      )}
    </div>
  )
}
