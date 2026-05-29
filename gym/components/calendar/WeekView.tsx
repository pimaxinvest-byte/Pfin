'use client'

import { getWeekDays, formatDate, DAY_NAMES_ES } from '@/lib/utils'
import { BookingCard } from './BookingCard'
import type { BookingWithRelations } from '@/lib/types'
import { isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'

interface WeekViewProps {
  date: Date
  bookings: BookingWithRelations[]
  onBookingClick: (b: BookingWithRelations) => void
}

export function WeekView({ date, bookings, onBookingClick }: WeekViewProps) {
  const days  = getWeekDays(date)
  const today = new Date()

  return (
    <div className="overflow-x-auto scrollbar-hide rounded-2xl"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className="grid grid-cols-7 gap-0 min-w-[420px]">
        {days.map((day, i) => {
          const dayBookings = bookings.filter((b) => isSameDay(new Date(b.startDatetime), day))
          const isToday     = isSameDay(day, today)

          return (
            <div key={day.toISOString()} className={cn(
              'p-1.5',
              i < days.length - 1 && 'border-r border-[var(--border)]'
            )}>
              {/* Day pill */}
              <div className={cn(
                'flex flex-col items-center py-2 rounded-xl mb-1.5 transition-colors',
                isToday ? 'text-white' : 'text-[var(--ink-2)]'
              )}
                style={isToday ? { background: 'var(--brand)' } : { background: 'var(--surface-2)' }}>
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                  {DAY_NAMES_ES[day.getDay()]}
                </span>
                <span className="text-sm font-bold">{formatDate(day, 'd')}</span>
                {dayBookings.length > 0 && (
                  <span className={cn(
                    'text-[9px] font-bold mt-0.5 px-1.5 rounded-full',
                    isToday ? 'bg-white/20 text-white' : 'text-[var(--brand)]'
                  )}>
                    {dayBookings.length}
                  </span>
                )}
              </div>

              {/* Booking slots */}
              <div className="space-y-0.5">
                {dayBookings.slice(0, 3).map((b) => (
                  <BookingCard key={b.id} booking={b} onClick={onBookingClick} compact />
                ))}
                {dayBookings.length > 3 && (
                  <p className="text-[9px] font-semibold text-center text-[var(--ink-3)] py-0.5">
                    +{dayBookings.length - 3}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
