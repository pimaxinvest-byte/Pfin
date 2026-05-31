'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { formatDateTime, toInputDateTime } from '@/lib/format'

type Data = {
  user: { id: string; name: string; role: string }
  teachers: Array<{ id: string; name: string; email: string }>
  clients: Array<{ id: string; name: string; email: string }>
  spaces: Array<{ id: string; name: string }>
  activities: Array<{ id: string; name: string; color: string }>
  bookings: Array<{
    id: string
    startsAt: string
    endsAt: string
    status: string
    teacher: { id: string; name: string }
    client: { id: string; name: string } | null
    space: { id: string; name: string }
    activity: { id: string; name: string; color: string }
  }>
}

export function DashboardClient({ initialData }: { initialData: Data }) {
  const [data, setData] = useState(initialData)
  const [message, setMessage] = useState('')

  async function refresh() {
    const res = await fetch('/api/dashboard')
    const next = await res.json()
    setData(next)
  }

  async function post(url: string, body: Record<string, unknown>) {
    setMessage('')
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(result.error || 'No se pudo guardar')
      return
    }
    setMessage('Guardado')
    await refresh()
  }

  async function submitAdmin(event: FormEvent<HTMLFormElement>, type: string) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await post('/api/dashboard', { type, ...Object.fromEntries(form.entries()) })
    event.currentTarget.reset()
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const startsAt = new Date(String(form.get('startsAt')))
    const endsAt = new Date(startsAt)
    endsAt.setMinutes(endsAt.getMinutes() + 60)
    await post('/api/bookings', {
      teacherId: form.get('teacherId'),
      spaceId: form.get('spaceId'),
      activityId: form.get('activityId'),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      notes: form.get('notes')
    })
  }

  async function reserve(bookingId: string) {
    await post('/api/bookings/reserve', { bookingId })
  }

  return (
    <div className="stack">
      {message && <p className={message === 'Guardado' ? 'muted' : 'error'}>{message}</p>}

      {data.user.role === 'admin' && (
        <div className="grid">
          <form className="panel stack" onSubmit={(event) => submitAdmin(event, 'teacher')}>
            <h2>Nuevo profesor</h2>
            <input className="input" name="name" placeholder="Nombre" required />
            <input className="input" name="email" placeholder="Email" type="email" required />
            <input className="input" name="password" placeholder="Contrasena inicial" minLength={6} required />
            <button className="button">Crear profesor</button>
          </form>
          <form className="panel stack" onSubmit={(event) => submitAdmin(event, 'space')}>
            <h2>Nueva sala</h2>
            <input className="input" name="name" placeholder="Nombre" required />
            <input className="input" name="capacity" type="number" min="1" defaultValue="1" />
            <button className="button">Crear sala</button>
          </form>
          <form className="panel stack" onSubmit={(event) => submitAdmin(event, 'activity')}>
            <h2>Nueva actividad</h2>
            <input className="input" name="name" placeholder="Nombre" required />
            <input className="input" name="duration" type="number" min="15" defaultValue="60" />
            <input className="input" name="color" type="color" defaultValue="#2563eb" />
            <button className="button">Crear actividad</button>
          </form>
        </div>
      )}

      {(data.user.role === 'admin' || data.user.role === 'teacher') && (
        <form className="panel stack" onSubmit={submitBooking}>
          <h2>Crear disponibilidad</h2>
          <div className="grid">
            {data.user.role === 'admin' && (
              <select className="input" name="teacherId" required>
                <option value="">Profesor</option>
                {data.teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                ))}
              </select>
            )}
            <select className="input" name="spaceId" required>
              <option value="">Sala</option>
              {data.spaces.map((space) => (
                <option key={space.id} value={space.id}>{space.name}</option>
              ))}
            </select>
            <select className="input" name="activityId" required>
              <option value="">Actividad</option>
              {data.activities.map((activity) => (
                <option key={activity.id} value={activity.id}>{activity.name}</option>
              ))}
            </select>
            <input className="input" name="startsAt" type="datetime-local" defaultValue={toInputDateTime()} required />
          </div>
          <textarea className="input" name="notes" placeholder="Notas" />
          <button className="button">Publicar franja</button>
        </form>
      )}

      <section className="panel">
        <div className="row">
          <h2>Reservas</h2>
          <span className="muted">{data.bookings.length} registros</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Actividad</th>
              <th>Profesor</th>
              <th>Sala</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.bookings.map((booking) => (
              <tr key={booking.id}>
                <td>{formatDateTime(booking.startsAt)}</td>
                <td>{booking.activity.name}</td>
                <td>{booking.teacher.name}</td>
                <td>{booking.space.name}</td>
                <td><span className={`badge ${booking.status}`}>{booking.status}</span></td>
                <td>
                  {data.user.role === 'client' && booking.status === 'available' && (
                    <button className="button" onClick={() => reserve(booking.id)}>Reservar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
