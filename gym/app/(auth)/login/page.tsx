'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Logo } from '@/components/ui/Logo'

export default function LoginPage() {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm]       = useState({ email: '', password: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const result = await signIn('credentials', { ...form, redirect: false })
    setLoading(false)
    if (result?.error) toast.error('Email o contraseña incorrectos')
    else { router.push('/'); router.refresh() }
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* Hero */}
      <div
        className="flex-shrink-0 flex flex-col items-center justify-end pb-10 pt-16 px-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(155deg, #0f0a00 0%, #1a0d00 35%, #2a1500 65%, #1a0800 100%)',
          minHeight: '44dvh',
        }}
      >
        {/* Glow blobs */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(204,0,0,0.18) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-32 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(255,200,0,0.12) 0%, transparent 70%)' }} />

        <div className="relative text-center animate-scale-in">
          <Logo size={88} className="justify-center mb-5" />
          <h1 className="text-3xl font-extrabold text-white tracking-tight">GymBook</h1>
          <p className="text-amber-400/70 text-sm mt-1 font-medium">Tu gimnasio, siempre organizado</p>
          <p className="text-white/30 text-[11px] mt-1">v1.1 · by Pietro</p>
        </div>
      </div>

      {/* Form card */}
      <div
        className="flex-1 rounded-t-[32px] -mt-6 relative z-10 px-6 pt-8 pb-10 flex flex-col"
        style={{ background: 'var(--surface)', boxShadow: '0 -8px 40px rgba(0,0,0,0.14)' }}
      >
        <h2 className="text-xl font-bold text-[var(--ink)] mb-6">Bienvenido de vuelta</h2>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div>
            <label className="label">Email</label>
            <input
              type="email" className="input-field"
              placeholder="tu@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required autoComplete="email"
            />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input
              type="password" className="input-field"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required autoComplete="current-password"
            />
          </div>
          <div className="pt-2">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : 'Entrar →'}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-[var(--ink-3)] mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="font-semibold" style={{ color: 'var(--brand)' }}>
            Regístrate gratis
          </Link>
        </p>
      </div>
    </div>
  )
}
