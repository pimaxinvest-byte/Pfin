'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDate, formatTime } from '@/lib/utils'
import type { BookingWithRelations } from '@/lib/types'
import toast from 'react-hot-toast'

export default function MyBookingsPage() {
  const { data: session } = useSession()
  const [bookings, setBookings] = useState<BookingWithRelations[]>([])
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/bookings')
    const all: BookingWithRelations[] = await res.json()
    setBookings(all.filter((b) => b.status !== 'available'))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCancel(id: string) {
    if (!confirm('¿Cancelar esta reserva?')) return
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (res.ok) { toast.success('Reserva cancelada'); load() }
    else toast.error('Error al cancelar')
  }

  const now = new Date()
  const filtered = bookings.filter((b) => {
    if (filter === 'upcoming') return new Date(b.startDatetime) >= now && b.status === 'booked'
    if (filter === 'past') return new Date(b.startDatetime) < now
    return true
  })

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Mis reservas</h2>

      <div className="flex gap-2">
        {(['upcoming', 'all', 'past'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f === 'upcoming' ? 'Próximas' : f === 'all' ? 'Todas' : 'Pasadas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm text-gray-500">Sin reservas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <div key={b.id} className="card">
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-white flex-shrink-0 text-center"
                  style={{ backgroundColor: b.color ?? b.teacher.teacherProfile?.color ?? '#0ea5e9' }}
                >
                  <span className="text-xs font-bold">{formatDate(b.startDatetime, 'd')}</span>
                  <span className="text-xs opacity-80">{formatDate(b.startDatetime, 'MMM')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{b.activity.name}</p>
                  <p className="text-xs text-gray-500">{b.teacher.name} · {b.space.name}</p>
                  <p className="text-xs text-gray-400">{formatTime(b.startDatetime)} – {formatTime(b.endDatetime)}</p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <StatusBadge status={b.status} />
                  {b.status === 'booked' && new Date(b.startDatetime) > now && (
                    <button onClick={() => handleCancel(b.id)} className="text-xs text-red-500 underline">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
