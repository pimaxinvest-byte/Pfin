'use client'

import { useFormState } from 'react-dom'
import SubmitButton from '@/components/SubmitButton'
import Link from 'next/link'
import { login } from '@/lib/actions/auth'

export default function LoginPage() {
  const [state, action] = useFormState(login, null)

  return (
    <div className="page-no-nav">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="auth-brand">
          <div className="auth-brand-logo">🏋️</div>
          <div className="auth-brand-name"><span>DADDY&apos;S</span> TRAINER</div>
          <div className="auth-brand-sub">Coach Pietro · Nutrición & Culturismo</div>
        </div>
        <div className="auth-title">Bienvenido</div>
        <div className="auth-sub">Entra para gestionar tu nutrición</div>

        {state?.error && <div className="alert alert-error">{state.error}</div>}

        <form action={action}>
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
              placeholder="••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <SubmitButton pendingText="Entrando…" className="btn btn-primary">Entrar</SubmitButton>
        </form>

        <div className="auth-footer">
          ¿No tienes cuenta? <Link href="/register">Regístrate</Link>
        </div>
      </div>
    </div>
  )
}
