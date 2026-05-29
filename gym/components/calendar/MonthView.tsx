'use client'

import { getMonthGrid, formatDate, DAY_NAMES_ES } from '@/lib/utils'
import type { BookingWithRelations } from '@/lib/types'
import { isSameDay, isSameMonth } from 'date-fns'
import { cn } from '@/lib/utils'

interface MonthViewProps {
  date: Date
  bookings: BookingWithRelations[]
  onDayClick: (day: Date) => void
  selectedDay?: Date | null
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function MonthView({ date, bookings, onDayClick, selectedDay }: MonthViewProps) {
  const grid = getMonthGrid(date)
  const today = new Date()

  return (
    <div className="bg-white rounded-2xl p-3">
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />
          const dayBookings = bookings.filter((b) => isSameDay(new Date(b.startDatetime), day))
          const isToday = isSameDay(day, today)
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
          const inMonth = isSameMonth(day, date)

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                'relative flex flex-col items-center py-1.5 rounded-xl text-sm transition-colors',
                isSelected ? 'bg-sky-500 text-white' :
                isToday ? 'bg-sky-50 text-sky-600 font-bold' :
                inMonth ? 'text-gray-900 hover:bg-gray-50' : 'text-gray-300'
              )}
            >
              <span className="font-medium">{formatDate(day, 'd')}</span>
              {dayBookings.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-[28px]">
                  {dayBookings.slice(0, 3).map((b) => (
                    <span
                      key={b.id}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? 'white' : (b.color ?? b.teacher.teacherProfile?.color ?? '#0ea5e9') }}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
