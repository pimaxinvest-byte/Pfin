'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Calendar } from '@/components/calendar/Calendar'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import type { BookingWithRelations } from '@/lib/types'
import { format } from 'date-fns'

interface Space { id: string; name: string }
interface Activity { id: string; name: string }

export default function TeacherCalendarPage() {
  const { data: session } = useSession()
  const [bookings, setBookings] = useState<BookingWithRelations[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    spaceId: '', activityId: '',
    startDatetime: '', endDatetime: '', notes: '',
  })

  const loadBookings = useCallback(async () => {
    const res = await fetch('/api/bookings')
    setBookings(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    loadBookings()
    fetch('/api/spaces').then((r) => r.json()).then(setSpaces)
    fetch('/api/activities').then((r) => r.json()).then(setActivities)
  }, [loadBookings])

  async function handleCreate() {
    if (!form.spaceId || !form.activityId || !form.startDatetime || !form.endDatetime) {
      toast.error('Completa todos los campos')
      return
    }
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId: session?.user.id,
        spaceId: form.spaceId,
        activityId: form.activityId,
        startDatetime: form.startDatetime,
        endDatetime: form.endDatetime,
        status: 'available',
        notes: form.notes,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Reserva creada')
      setShowCreate(false)
      loadBookings()
    } else if (res.status === 409) {
      toast.error(`Conflicto: ${data.message}`)
    } else {
      toast.error(data.error)
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Mi calendario</h2>
          <p className="text-xs text-gray-400">Hola, {session?.user.name}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary w-auto px-4 py-2 text-sm">
          + Franja
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
        />
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nueva franja horaria">
        <div className="space-y-4">
          <div>
            <label className="label">Espacio</label>
            <select className="input-field" value={form.spaceId} onChange={(e) => setForm({ ...form, spaceId: e.target.value })}>
              <option value="">Selecciona espacio</option>
              {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Actividad</label>
            <select className="input-field" value={form.activityId} onChange={(e) => setForm({ ...form, activityId: e.target.value })}>
              <option value="">Selecciona actividad</option>
              {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Inicio</label>
            <input type="datetime-local" className="input-field" value={form.startDatetime} onChange={(e) => setForm({ ...form, startDatetime: e.target.value })} />
          </div>
          <div>
            <label className="label">Fin</label>
            <input type="datetime-local" className="input-field" value={form.endDatetime} onChange={(e) => setForm({ ...form, endDatetime: e.target.value })} />
          </div>
          <div>
            <label className="label">Notas (opcional)</label>
            <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button onClick={handleCreate} className="btn-primary">Crear franja</button>
        </div>
      </Modal>
    </div>
  )
}
