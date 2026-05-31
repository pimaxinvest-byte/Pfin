'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'

export function AuthForm({ mode }: { mode: 'login' | 'setup' }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(form.entries())
    const res = await fetch(mode === 'login' ? '/api/auth/login' : '/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'No se pudo continuar')
      return
    }

    const role = data.user?.role
    window.location.href = role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/client'
  }

  return (
    <form className="auth-box stack" onSubmit={submit}>
      <div>
        <div className="brand">GymBook</div>
        <p className="muted">
          {mode === 'login' ? 'Accede a tu panel' : 'Crea el primer administrador'}
        </p>
      </div>
      {mode === 'setup' && (
        <label className="field">
          <span className="label">Nombre</span>
          <input className="input" name="name" required minLength={2} />
        </label>
      )}
      <label className="field">
        <span className="label">Email</span>
        <input className="input" name="email" type="email" required />
      </label>
      <label className="field">
        <span className="label">Contrasena</span>
        <input className="input" name="password" type="password" required minLength={mode === 'setup' ? 6 : 1} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="button" disabled={loading}>
        {loading ? 'Un momento...' : mode === 'login' ? 'Entrar' : 'Crear admin'}
      </button>
    </form>
  )
}
