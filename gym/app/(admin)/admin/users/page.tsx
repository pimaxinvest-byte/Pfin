'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  telegramChatId: string | null
  teacherProfile: { color: string; bio?: string } | null
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [roleFilter, setRoleFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'client', telegramChatId: '', color: '#0ea5e9' })

  async function loadUsers() {
    const params = roleFilter ? `?role=${roleFilter}` : ''
    const res = await fetch(`/api/users${params}`)
    setUsers(await res.json())
  }

  useEffect(() => { loadUsers() }, [roleFilter])

  function openCreate() {
    setEditUser(null)
    setForm({ name: '', email: '', password: '', role: 'client', telegramChatId: '', color: '#0ea5e9' })
    setShowModal(true)
  }

  function openEdit(user: User) {
    setEditUser(user)
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      telegramChatId: user.telegramChatId || '',
      color: user.teacherProfile?.color || '#0ea5e9',
    })
    setShowModal(true)
  }

  async function handleSave() {
    const body: any = { ...form }
    if (!body.password) delete body.password
    if (!body.telegramChatId) body.telegramChatId = null

    const url = editUser ? `/api/users/${editUser.id}` : '/api/users'
    const method = editUser ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast.success(editUser ? 'Usuario actualizado' : 'Usuario creado')
      setShowModal(false)
      loadUsers()
    } else {
      const d = await res.json()
      toast.error(d.error)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar usuario?')) return
    await fetch(`/api/users/${id}`, { method: 'DELETE' })
    toast.success('Usuario eliminado')
    loadUsers()
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    teacher: 'bg-sky-100 text-sky-700',
    client: 'bg-green-100 text-green-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Usuarios</h2>
        <button onClick={openCreate} className="btn-primary w-auto px-4 py-2 text-sm">+ Nuevo</button>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {['', 'admin', 'teacher', 'client'].map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0 ${
              roleFilter === r ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {r || 'Todos'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
              style={{ backgroundColor: u.teacherProfile?.color || '#94a3b8' }}>
              {u.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                  {u.role}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">{u.email}</p>
              {u.telegramChatId && <p className="text-xs text-sky-500">📱 Telegram</p>}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => openEdit(u)} className="w-8 h-8 bg-gray-100 rounded-xl text-sm">✏️</button>
              <button onClick={() => handleDelete(u.id)} className="w-8 h-8 bg-red-50 rounded-xl text-sm">🗑</button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editUser ? 'Editar usuario' : 'Nuevo usuario'}>
        <div className="space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Contraseña {editUser && '(dejar vacío para no cambiar)'}</label>
            <input type="password" className="input-field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label">Rol</label>
            <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="client">Cliente</option>
              <option value="teacher">Profesor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="label">Telegram Chat ID</label>
            <input className="input-field" placeholder="Opcional" value={form.telegramChatId} onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })} />
          </div>
          {form.role === 'teacher' && (
            <div>
              <label className="label">Color del profesor</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-12 h-12 rounded-xl cursor-pointer border-0" />
                <input className="input-field flex-1" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>
          )}
          <button onClick={handleSave} className="btn-primary">Guardar</button>
        </div>
      </Modal>
    </div>
  )
}
