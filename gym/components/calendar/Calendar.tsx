'use client'

import { useState, useCallback } from 'react'
import { addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns'
import { DayView } from './DayView'
import { WeekView } from './WeekView'
import { MonthView } from './MonthView'
import { BookingDetail } from './BookingDetail'
import { formatDate, MONTH_NAMES_ES } from '@/lib/utils'
import type { BookingWithRelations } from '@/lib/types'

type CalendarView = 'day' | 'week' | 'month'

interface CalendarProps {
  bookings: BookingWithRelations[]
  role?: string
  userId?: string
  onBook?: (booking: BookingWithRelations) => void
  onCancel?: (booking: BookingWithRelations) => void
  onDelete?: (booking: BookingWithRelations) => void
}

export function Calendar({ bookings, role, userId, onBook, onCancel, onDelete }: CalendarProps) {
  const [view, setView] = useState<CalendarView>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const navigate = useCallback((dir: 1 | -1) => {
    setCurrentDate((prev) => {
      if (view === 'day') return dir === 1 ? addDays(prev, 1) : subDays(prev, 1)
      if (view === 'week') return dir === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1)
      return dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1)
    })
  }, [view])

  function getTitle() {
    if (view === 'day') return formatDate(currentDate, "d 'de' MMMM yyyy")
    if (view === 'week') return `Semana del ${formatDate(currentDate, "d MMM")}`
    return `${MONTH_NAMES_ES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  }

  function handleDayClick(day: Date) {
    setSelectedDay(day)
    setCurrentDate(day)
    setView('day')
  }

  return (
    <div className="space-y-3">
      {/* View switcher */}
      <div className="flex bg-gray-100 rounded-2xl p-1">
        {(['day', 'week', 'month'] as CalendarView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${
              view === v ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Mes'}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600"
        >
          ‹
        </button>
        <button
          onClick={() => { setCurrentDate(new Date()); setSelectedDay(null) }}
          className="text-sm font-semibold text-gray-900 px-3 py-1.5 rounded-xl hover:bg-gray-100 capitalize"
        >
          {getTitle()}
        </button>
        <button
          onClick={() => navigate(1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600"
        >
          ›
        </button>
      </div>

      {/* Calendar view */}
      {view === 'day' && (
        <DayView date={currentDate} bookings={bookings} onBookingClick={setSelectedBooking} />
      )}
      {view === 'week' && (
        <WeekView date={currentDate} bookings={bookings} onBookingClick={setSelectedBooking} />
      )}
      {view === 'month' && (
        <MonthView
          date={currentDate}
          bookings={bookings}
          onDayClick={handleDayClick}
          selectedDay={selectedDay}
        />
      )}

      <BookingDetail
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onBook={onBook}
        onCancel={onCancel}
        onDelete={onDelete}
        role={role}
        userId={userId}
      />
    </div>
  )
}
