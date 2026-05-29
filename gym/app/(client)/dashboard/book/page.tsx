'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Calendar } from '@/components/calendar/Calendar'
import toast from 'react-hot-toast'
import type { BookingWithRelations } from '@/lib/types'
import { Modal } from '@/components/ui/Modal'
import { formatDateTimeDisplay, formatTime } from '@/lib/utils'

export default function BookPage() {
  const { data: session } = useSession()
  const [bookings, setBookings] = useState<BookingWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmBooking, setConfirmBooking] = useState<BookingWithRelations | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [teacherFilter, setTeacherFilter] = useState('')
  const [activityFilter, setActivityFilter] = useState('')
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([])
  const [activities, setActivities] = useState<{ id: string; name: string }[]>([])

  async function loadAvailable() {
    const params = new URLSearchParams({ status: 'available' })
    if (teacherFilter) params.set('teacherId', teacherFilter)
    if (activityFilter) params.set('activityId', activityFilter)
    const res = await fetch(`/api/bookings?${params}`)
    setBookings(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    loadAvailable()
    fetch('/api/users?role=teacher').then((r) => r.json()).then(setTeachers)
    fetch('/api/activities').then((r) => r.json()).then(setActivities)
  }, [teacherFilter, activityFilter])

  async function handleBook(booking: BookingWithRelations) {
    setConfirmBooking(booking)
  }

  async function confirmReservation() {
    if (!confirmBooking) return
    setConfirming(true)
    const res = await fetch(`/api/bookings/${confirmBooking.id}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    setConfirming(false)
    if (res.ok) {
      toast.success('¡Reserva confirmada! 🎉')
      setConfirmBooking(null)
      loadAvailable()
    } else {
      const d = await res.json()
      toast.error(d.error || 'Error al reservar')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Reservar sesión</h2>
        <p className="text-sm text-gray-500">Elige una franja disponible</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select className="input-field text-sm" value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}>
          <option value="">Todos los profesores</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="input-field text-sm" value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value)}>
          <option value="">Todas las actividades</option>
          {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Cargando disponibilidad...</div>
      ) : (
        <Calendar
          bookings={bookings}
          role={session?.user.role}
          userId={session?.user.id}
          onBook={handleBook}
        />
      )}

      {/* Confirmation modal */}
      <Modal open={!!confirmBooking} onClose={() => setConfirmBooking(null)} title="Confirmar reserva">
        {confirmBooking && (
          <div className="space-y-4">
            <div className="bg-sky-50 rounded-2xl p-4 space-y-3">
              <p className="text-sm"><span className="text-gray-500">Profesor:</span> <strong>{confirmBooking.teacher.name}</strong></p>
              <p className="text-sm"><span className="text-gray-500">Actividad:</span> <strong>{confirmBooking.activity.name}</strong></p>
              <p className="text-sm"><span className="text-gray-500">Espacio:</span> <strong>{confirmBooking.space.name}</strong></p>
              <p className="text-sm"><span className="text-gray-500">Día:</span> <strong>{formatDateTimeDisplay(confirmBooking.startDatetime)}</strong></p>
              <p className="text-sm"><span className="text-gray-500">Hora:</span> <strong>{formatTime(confirmBooking.startDatetime)} – {formatTime(confirmBooking.endDatetime)}</strong></p>
            </div>
            <button onClick={confirmReservation} disabled={confirming} className="btn-primary">
              {confirming ? 'Reservando...' : '✅ Confirmar reserva'}
            </button>
            <button onClick={() => setConfirmBooking(null)} className="btn-secondary">Cancelar</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
