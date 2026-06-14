'use client'

import { useFormState } from 'react-dom'
import SubmitButton from '@/components/SubmitButton'
import Link from 'next/link'
import { register } from '@/lib/actions/auth'

export default function RegisterPage() {
  const [state, action] = useFormState(register, null)

  return (
    <div className="page-no-nav">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="auth-brand">
          <div className="auth-brand-logo">🏋️</div>
          <div className="auth-brand-name"><span>DADDY&apos;S</span> TRAINER</div>
          <div className="auth-brand-sub">Coach Pietro · Nutrición & Culturismo</div>
        </div>
        <div className="auth-title">Crear cuenta</div>
        <div className="auth-sub">Empieza tu transformación hoy</div>

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
          <SubmitButton pendingText="Creando cuenta…" className="btn btn-primary">Crear cuenta</SubmitButton>
        </form>

        <div className="auth-footer">
          ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
        </div>
      </div>
    </div>
  )
}
