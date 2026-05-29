'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Logo } from '@/components/ui/Logo'

export default function RegisterPage() {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Las contraseñas no coinciden'); return }
    setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: 'client' }),
    })
    setLoading(false)
    if (res.ok) { toast.success('¡Cuenta creada!'); router.push('/login') }
    else { const d = await res.json(); toast.error(d.error || 'Error al registrarse') }
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* Compact hero */}
      <div
        className="flex-shrink-0 flex items-center justify-center py-10 px-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(155deg, #0f0a00 0%, #1a0d00 50%, #2a1500 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(204,0,0,0.15) 0%, transparent 70%)' }} />
        <div className="relative text-center animate-scale-in">
          <Logo size={64} className="justify-center mb-3" />
          <p className="text-white/40 text-[11px]">v1.1 · by Pietro</p>
        </div>
      </div>

      {/* Form */}
      <div
        className="flex-1 rounded-t-[32px] -mt-4 relative z-10 px-6 pt-7 pb-10"
        style={{ background: 'var(--surface)', boxShadow: '0 -8px 40px rgba(0,0,0,0.14)' }}
      >
        <h2 className="text-xl font-bold text-[var(--ink)] mb-5">Crear cuenta</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'name',     label: 'Nombre',            type: 'text',     placeholder: 'Tu nombre completo' },
            { key: 'email',    label: 'Email',             type: 'email',    placeholder: 'tu@email.com' },
            { key: 'password', label: 'Contraseña',        type: 'password', placeholder: 'Mínimo 6 caracteres' },
            { key: 'confirm',  label: 'Repetir contraseña',type: 'password', placeholder: 'Repite la contraseña' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                type={type} className="input-field"
                placeholder={placeholder}
                value={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required minLength={key === 'password' ? 6 : undefined}
              />
            </div>
          ))}

          <div className="pt-2">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creando cuenta...
                </span>
              ) : 'Crear cuenta →'}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-[var(--ink-3)] mt-5">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-semibold" style={{ color: 'var(--brand)' }}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
