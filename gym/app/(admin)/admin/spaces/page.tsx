'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

interface Space { id: string; name: string; description: string | null; capacity: number; isActive: boolean }

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Space | null>(null)
  const [form, setForm] = useState({ name: '', description: '', capacity: 1 })

  async function load() {
    const res = await fetch('/api/spaces')
    setSpaces(await res.json())
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setEditItem(null)
    setForm({ name: '', description: '', capacity: 1 })
    setShowModal(true)
  }
  function openEdit(s: Space) {
    setEditItem(s)
    setForm({ name: s.name, description: s.description || '', capacity: s.capacity })
    setShowModal(true)
  }

  async function handleSave() {
    const url = editItem ? `/api/spaces/${editItem.id}` : '/api/spaces'
    const method = editItem ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) { toast.success('Guardado'); setShowModal(false); load() }
    else { const d = await res.json(); toast.error(d.error) }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Desactivar espacio?')) return
    await fetch(`/api/spaces/${id}`, { method: 'DELETE' })
    toast.success('Espacio desactivado')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Espacios</h2>
        <button onClick={openCreate} className="btn-primary w-auto px-4 py-2 text-sm">+ Nuevo</button>
      </div>

      <div className="space-y-2">
        {spaces.map((s) => (
          <div key={s.id} className="card flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🏢</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{s.name}</p>
              <p className="text-xs text-gray-500">{s.description} · Cap: {s.capacity}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => openEdit(s)} className="w-8 h-8 bg-gray-100 rounded-xl text-sm">✏️</button>
              <button onClick={() => handleDelete(s.id)} className="w-8 h-8 bg-red-50 rounded-xl text-sm">🗑</button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Editar espacio' : 'Nuevo espacio'}>
        <div className="space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Descripción</label>
            <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Capacidad</label>
            <input type="number" className="input-field" value={form.capacity} min={1} onChange={(e) => setForm({ ...form, capacity: +e.target.value })} />
          </div>
          <button onClick={handleSave} className="btn-primary">Guardar</button>
        </div>
      </Modal>
    </div>
  )
}
