'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

interface Activity { id: string; name: string; description: string | null; duration: number; maxClients: number; color: string }

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Activity | null>(null)
  const [form, setForm] = useState({ name: '', description: '', duration: 60, maxClients: 1, color: '#10b981' })

  async function load() {
    const res = await fetch('/api/activities')
    setActivities(await res.json())
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setEditItem(null)
    setForm({ name: '', description: '', duration: 60, maxClients: 1, color: '#10b981' })
    setShowModal(true)
  }
  function openEdit(a: Activity) {
    setEditItem(a)
    setForm({ name: a.name, description: a.description || '', duration: a.duration, maxClients: a.maxClients, color: a.color })
    setShowModal(true)
  }

  async function handleSave() {
    const url = editItem ? `/api/activities/${editItem.id}` : '/api/activities'
    const method = editItem ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) { toast.success('Guardado'); setShowModal(false); load() }
    else { const d = await res.json(); toast.error(d.error) }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Desactivar actividad?')) return
    await fetch(`/api/activities/${id}`, { method: 'DELETE' })
    toast.success('Actividad desactivada')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Actividades</h2>
        <button onClick={openCreate} className="btn-primary w-auto px-4 py-2 text-sm">+ Nueva</button>
      </div>

      <div className="space-y-2">
        {activities.map((a) => (
          <div key={a.id} className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: a.color + '20' }}>
              🏋️
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{a.name}</p>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
              </div>
              <p className="text-xs text-gray-500">{a.duration} min · Max {a.maxClients} clientes</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => openEdit(a)} className="w-8 h-8 bg-gray-100 rounded-xl text-sm">✏️</button>
              <button onClick={() => handleDelete(a.id)} className="w-8 h-8 bg-red-50 rounded-xl text-sm">🗑</button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Editar actividad' : 'Nueva actividad'}>
        <div className="space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Descripción</label>
            <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Duración (min)</label>
              <input type="number" className="input-field" value={form.duration} min={15} step={15} onChange={(e) => setForm({ ...form, duration: +e.target.value })} />
            </div>
            <div>
              <label className="label">Max clientes</label>
              <input type="number" className="input-field" value={form.maxClients} min={1} onChange={(e) => setForm({ ...form, maxClients: +e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-12 h-12 rounded-xl cursor-pointer border-0" />
              <input className="input-field flex-1" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
          <button onClick={handleSave} className="btn-primary">Guardar</button>
        </div>
      </Modal>
    </div>
  )
}
