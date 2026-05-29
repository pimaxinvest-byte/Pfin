'use client'

import { getMonthGrid, formatDate } from '@/lib/utils'
import type { BookingWithRelations } from '@/lib/types'
import { isSameDay, isSameMonth } from 'date-fns'
import { cn } from '@/lib/utils'

interface MonthViewProps {
  date: Date
  bookings: BookingWithRelations[]
  onDayClick: (d: Date) => void
  selectedDay?: Date | null
}

const WEEKDAYS = ['L','M','X','J','V','S','D']

export function MonthView({ date, bookings, onDayClick, selectedDay }: MonthViewProps) {
  const grid  = getMonthGrid(date)
  const today = new Date()

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-[var(--border)]">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 p-2 gap-1">
        {grid.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />

          const dayBookings = bookings.filter((b) => isSameDay(new Date(b.startDatetime), day))
          const isToday     = isSameDay(day, today)
          const isSelected  = selectedDay ? isSameDay(day, selectedDay) : false
          const inMonth     = isSameMonth(day, date)

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                'relative flex flex-col items-center rounded-xl py-1.5 gap-0.5 transition-all duration-150 active:scale-95',
                isSelected ? 'text-white' :
                isToday    ? 'text-[var(--brand)]' :
                inMonth    ? 'text-[var(--ink)]' : 'text-[var(--ink-3)] opacity-40',
              )}
              style={
                isSelected ? { background: 'var(--brand)' } :
                isToday    ? { background: 'var(--brand-light)' } :
                undefined
              }
            >
              <span className={cn('text-sm font-bold leading-none', isToday && !isSelected && 'text-[var(--brand)]')}>
                {formatDate(day, 'd')}
              </span>

              {/* Color dots */}
              {dayBookings.length > 0 && (
                <div className="flex gap-0.5 flex-wrap justify-center max-w-[28px]">
                  {dayBookings.slice(0, 3).map((b) => (
                    <span
                      key={b.id}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: isSelected
                          ? 'rgba(255,255,255,0.7)'
                          : (b.color ?? b.teacher.teacherProfile?.color ?? '#6366f1')
                      }}
                    />
                  ))}
                  {dayBookings.length > 3 && (
                    <span className="text-[8px] font-bold leading-none"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--ink-3)' }}>
                      +{dayBookings.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
