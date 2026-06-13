'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { register } from '@/lib/actions/auth'

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, null)

  return (
    <div className="page-no-nav">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="auth-logo">🥗</div>
        <div className="auth-title">Crear cuenta</div>
        <div className="auth-sub">Empieza a llevar tu dieta hoy</div>

        {state?.error && <div className="alert alert-error">{state.error}</div>}

        <form action={action}>
          <div className="form-group">
            <label className="form-label">Nombre</label>
            <input
              type="text"
              name="name"
              className="form-input"
              placeholder="Tu nombre"
              autoComplete="name"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder="tu@email.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              name="password"
              className="form-input"
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <div className="auth-footer">
          ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
        </div>
      </div>
    </div>
  )
}
