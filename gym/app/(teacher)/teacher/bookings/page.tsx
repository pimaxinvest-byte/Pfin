'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDate, formatTime } from '@/lib/utils'
import type { BookingWithRelations } from '@/lib/types'
import toast from 'react-hot-toast'

export default function TeacherBookingsPage() {
  const { data: session } = useSession()
  const [bookings, setBookings] = useState<BookingWithRelations[]>([])
  const [filter, setFilter] = useState('')

  async function load() {
    const res = await fetch('/api/bookings')
    setBookings(await res.json())
  }

  useEffect(() => { load() }, [])

  async function handleCancel(id: string) {
    if (!confirm('¿Cancelar esta reserva?')) return
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    toast.success('Cancelada')
    load()
  }

  const filtered = filter ? bookings.filter((b) => b.status === filter) : bookings

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Mis reservas</h2>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {['', 'available', 'booked', 'cancelled', 'completed'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0 ${
              filter === s ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s || 'Todas'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((b) => (
          <div key={b.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: b.color ?? b.teacher.teacherProfile?.color ?? '#0ea5e9' }} />
                  <p className="text-sm font-semibold text-gray-900 truncate">{b.activity.name}</p>
                </div>
                <p className="text-xs text-gray-500">{b.space.name}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {formatDate(b.startDatetime, "EEE d MMM")} · {formatTime(b.startDatetime)} – {formatTime(b.endDatetime)}
                </p>
                {b.client && <p className="text-xs text-sky-600 mt-0.5">👤 {b.client.name}</p>}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <StatusBadge status={b.status} />
                {b.status !== 'cancelled' && (
                  <button onClick={() => handleCancel(b.id)} className="text-xs text-red-500 underline">Cancelar</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p className="text-3xl mb-2">📭</p>
            <p>Sin reservas</p>
          </div>
        )}
      </div>
    </div>
  )
}
