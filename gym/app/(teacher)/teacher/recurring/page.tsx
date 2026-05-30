'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { DAY_NAMES_FULL_ES } from '@/lib/utils'

interface Space { id: string; name: string }
interface Activity { id: string; name: string }

const DAY_INDEXES = [1, 2, 3, 4, 5, 6, 0] // Mon-Sun (JS: 0=Sun)
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function RecurringPage() {
  const { data: session } = useSession()
  const [spaces, setSpaces] = useState<Space[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number; conflicts: any[] } | null>(null)
  const [form, setForm] = useState({
    spaceId: '', activityId: '',
    daysOfWeek: [] as number[],
    startDate: '', endDate: '',
    startTime: '09:00', endTime: '10:00',
    notes: '',
  })

  useEffect(() => {
    fetch('/api/spaces').then((r) => r.json()).then(setSpaces)
    fetch('/api/activities').then((r) => r.json()).then(setActivities)
  }, [])

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }))
  }

  async function handleSubmit() {
    if (!form.spaceId || !form.activityId || !form.daysOfWeek.length || !form.startDate || !form.endDate) {
      toast.error('Completa todos los campos obligatorios')
      return
    }
    setLoading(true)
    setResult(null)
    const res = await fetch('/api/bookings/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId: session?.user.id,
        ...form,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      setResult(data)
      toast.success(`${data.created} franjas creadas`)
    } else {
      toast.error(data.error || 'Error al crear')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Reserva recurrente</h2>
        <p className="text-sm text-gray-500">Genera múltiples franjas automáticamente</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label">Días de la semana</label>
          <div className="flex gap-2 flex-wrap">
            {DAY_INDEXES.map((day, idx) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  form.daysOfWeek.includes(day)
                    ? 'bg-sky-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {DAY_LABELS[idx]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Hora inicio</label>
            <input type="time" className="input-field" value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </div>
          <div>
            <label className="label">Hora fin</label>
            <input type="time" className="input-field" value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Fecha inicio</label>
            <input type="date" className="input-field" value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Fecha fin</label>
            <input type="date" className="input-field" value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
        </div>

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
          <label className="label">Notas (opcional)</label>
          <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        <button onClick={handleSubmit} disabled={loading} className="btn-primary">
          {loading ? 'Generando franjas...' : '🔁 Generar reservas recurrentes'}
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="bg-green-50 rounded-2xl p-4">
            <p className="text-green-800 font-semibold">✅ {result.created} franjas creadas</p>
            {result.skipped > 0 && (
              <p className="text-yellow-700 text-sm mt-1">⚠️ {result.skipped} omitidas por conflicto</p>
            )}
          </div>
          {result.conflicts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Conflictos:</p>
              {result.conflicts.map((c, i) => (
                <div key={i} className="bg-yellow-50 rounded-xl p-3 text-xs text-yellow-800">
                  {new Date(c.date).toLocaleString('es-ES')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
