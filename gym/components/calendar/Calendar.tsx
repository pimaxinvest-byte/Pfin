'use client'

import { useState, useCallback } from 'react'
import { addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns'
import { DayView }   from './DayView'
import { WeekView }  from './WeekView'
import { MonthView } from './MonthView'
import { BookingDetail } from './BookingDetail'
import { formatDate, MONTH_NAMES_ES } from '@/lib/utils'
import type { BookingWithRelations } from '@/lib/types'

type View = 'day' | 'week' | 'month'

interface CalendarProps {
  bookings: BookingWithRelations[]
  role?: string
  userId?: string
  onBook?:   (b: BookingWithRelations) => void
  onCancel?: (b: BookingWithRelations) => void
  onDelete?: (b: BookingWithRelations) => void
}

const VIEW_LABELS: Record<View, string> = { day: 'Día', week: 'Semana', month: 'Mes' }

export function Calendar({ bookings, role, userId, onBook, onCancel, onDelete }: CalendarProps) {
  const [view, setView]                     = useState<View>('week')
  const [date, setDate]                     = useState(new Date())
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null)
  const [selectedDay, setSelectedDay]       = useState<Date | null>(null)

  const navigate = useCallback((dir: 1 | -1) => {
    setDate((prev) =>
      view === 'day'   ? (dir === 1 ? addDays(prev, 1)    : subDays(prev, 1)) :
      view === 'week'  ? (dir === 1 ? addWeeks(prev, 1)   : subWeeks(prev, 1)) :
                         (dir === 1 ? addMonths(prev, 1)  : subMonths(prev, 1))
    )
  }, [view])

  function title() {
    if (view === 'day')   return formatDate(date, "d 'de' MMMM yyyy")
    if (view === 'week')  return `${formatDate(date, "d MMM")} – semana`
    return `${MONTH_NAMES_ES[date.getMonth()]} ${date.getFullYear()}`
  }

  function handleDayClick(day: Date) {
    setSelectedDay(day)
    setDate(day)
    setView('day')
  }

  function handleBook(b: BookingWithRelations) {
    setSelectedBooking(null)
    onBook?.(b)
  }

  function handleCancel(b: BookingWithRelations) {
    setSelectedBooking(null)
    onCancel?.(b)
  }

  function handleDelete(b: BookingWithRelations) {
    setSelectedBooking(null)
    onDelete?.(b)
  }

  return (
    <div className="space-y-3">

      {/* Controls row */}
      <div className="flex items-center gap-2">
        {/* View switcher */}
        <div className="tab-bar flex-1">
          {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`tab-item ${view === v ? 'active' : ''}`}>
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {/* Today button */}
        <button
          onClick={() => { setDate(new Date()); setSelectedDay(null) }}
          className="btn-icon text-xs font-bold flex-shrink-0"
          style={{ color: 'var(--brand)' }}
        >
          Hoy
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="btn-icon">
          <span className="text-sm font-bold">‹</span>
        </button>
        <p className="flex-1 text-center text-sm font-semibold text-[var(--ink)] capitalize">
          {title()}
        </p>
        <button onClick={() => navigate(1)} className="btn-icon">
          <span className="text-sm font-bold">›</span>
        </button>
      </div>

      {/* View */}
      <div className="animate-fade-in">
        {view === 'day'   && <DayView   date={date} bookings={bookings} onBookingClick={setSelectedBooking} />}
        {view === 'week'  && <WeekView  date={date} bookings={bookings} onBookingClick={setSelectedBooking} />}
        {view === 'month' && <MonthView date={date} bookings={bookings} onDayClick={handleDayClick} selectedDay={selectedDay} />}
      </div>

      <BookingDetail
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onBook={handleBook}
        onCancel={handleCancel}
        onDelete={handleDelete}
        role={role}
        userId={userId}
      />
    </div>
  )
}
