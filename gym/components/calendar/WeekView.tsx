'use client'

import { getWeekDays, formatDate, DAY_NAMES_ES } from '@/lib/utils'
import { BookingCard } from './BookingCard'
import type { BookingWithRelations } from '@/lib/types'
import { isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'

interface WeekViewProps {
  date: Date
  bookings: BookingWithRelations[]
  onBookingClick: (booking: BookingWithRelations) => void
}

export function WeekView({ date, bookings, onBookingClick }: WeekViewProps) {
  const days = getWeekDays(date)
  const today = new Date()

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="grid grid-cols-7 gap-1 min-w-[560px]">
        {days.map((day) => {
          const dayBookings = bookings.filter((b) => isSameDay(new Date(b.startDatetime), day))
          const isToday = isSameDay(day, today)

          return (
            <div key={day.toISOString()} className="min-w-0">
              <div className={cn(
                'text-center py-1.5 mb-1 rounded-xl',
                isToday ? 'bg-sky-500 text-white' : 'bg-gray-50 text-gray-600'
              )}>
                <div className="text-xs font-medium">{DAY_NAMES_ES[(day.getDay())]}</div>
                <div className="text-sm font-bold">{formatDate(day, 'd')}</div>
                {dayBookings.length > 0 && (
                  <div className={cn(
                    'text-xs mt-0.5',
                    isToday ? 'text-sky-100' : 'text-sky-500'
                  )}>{dayBookings.length}</div>
                )}
              </div>

              <div className="space-y-0.5">
                {dayBookings.slice(0, 4).map((b) => (
                  <BookingCard key={b.id} booking={b} onClick={onBookingClick} compact />
                ))}
                {dayBookings.length > 4 && (
                  <p className="text-xs text-gray-400 text-center">+{dayBookings.length - 4} más</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
