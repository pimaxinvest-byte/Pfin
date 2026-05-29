'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Calendar } from '@/components/calendar/Calendar'
import toast from 'react-hot-toast'
import type { BookingWithRelations } from '@/lib/types'

export default function AdminCalendarPage() {
  const { data: session } = useSession()
  const [bookings, setBookings] = useState<BookingWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ teacherId: '', status: '' })

  const loadBookings = useCallback(async () => {
    const params = new URLSearchParams()
    if (filters.teacherId) params.set('teacherId', filters.teacherId)
    if (filters.status) params.set('status', filters.status)
    const res = await fetch(`/api/bookings?${params}`)
    const data = await res.json()
    setBookings(data)
    setLoading(false)
  }, [filters])

  useEffect(() => { loadBookings() }, [loadBookings])

  async function handleDelete(booking: BookingWithRelations) {
    if (!confirm('¿Eliminar esta reserva?')) return
    await fetch(`/api/bookings/${booking.id}`, { method: 'DELETE' })
    toast.success('Reserva eliminada')
    loadBookings()
  }

  async function handleCancel(booking: BookingWithRelations) {
    await fetch(`/api/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    toast.success('Reserva cancelada')
    loadBookings()
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Calendario</h2>

      <div className="grid grid-cols-2 gap-2">
        <select
          className="input-field text-sm"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">Todos los estados</option>
          <option value="available">Disponible</option>
          <option value="booked">Reservado</option>
          <option value="cancelled">Cancelado</option>
          <option value="completed">Completado</option>
        </select>
        <button onClick={loadBookings} className="btn-secondary text-sm py-2">
          🔄 Actualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Cargando...</div>
      ) : (
        <Calendar
          bookings={bookings}
          role={session?.user.role}
          userId={session?.user.id}
          onCancel={handleCancel}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
