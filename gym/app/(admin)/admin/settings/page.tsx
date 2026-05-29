'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Settings {
  gymName: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  telegramBotToken: string
  telegramAdminChatId: string
  telegramNotifyAdmin: boolean
  confirmationText: string
  sessionDuration: number
}

export default function SettingsPage() {
  const [form, setForm] = useState<Settings>({
    gymName: '',
    logoUrl: '',
    primaryColor: '#0ea5e9',
    secondaryColor: '#10b981',
    telegramBotToken: '',
    telegramAdminChatId: '',
    telegramNotifyAdmin: true,
    confirmationText: '',
    sessionDuration: 60,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((d) => {
      setForm({
        gymName: d.gymName || '',
        logoUrl: d.logoUrl || '',
        primaryColor: d.primaryColor || '#0ea5e9',
        secondaryColor: d.secondaryColor || '#10b981',
        telegramBotToken: d.telegramBotToken || '',
        telegramAdminChatId: d.telegramAdminChatId || '',
        telegramNotifyAdmin: d.telegramNotifyAdmin ?? true,
        confirmationText: d.confirmationText || '',
        sessionDuration: d.sessionDuration || 60,
      })
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) toast.success('Configuración guardada')
    else toast.error('Error al guardar')
  }

  const field = (key: keyof Settings, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input-field"
        placeholder={placeholder}
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  )

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Configuración</h2>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Gimnasio</h3>
        {field('gymName', 'Nombre del gimnasio', 'text', 'Mi Gimnasio')}
        {field('logoUrl', 'URL del logo', 'url', 'https://...')}
        <div>
          <label className="label">Duración estándar de sesión (min)</label>
          <input type="number" className="input-field" value={form.sessionDuration} min={15} step={15}
            onChange={(e) => setForm({ ...form, sessionDuration: +e.target.value })} />
        </div>
        <div>
          <label className="label">Texto de confirmación</label>
          <textarea className="input-field min-h-[80px] resize-none" value={form.confirmationText}
            placeholder="Mensaje enviado al confirmar una reserva..."
            onChange={(e) => setForm({ ...form, confirmationText: e.target.value })} />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Colores</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Color principal</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="w-12 h-12 rounded-xl border-0 cursor-pointer" />
              <input className="input-field flex-1 text-sm" value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Color secundario</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.secondaryColor}
                onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                className="w-12 h-12 rounded-xl border-0 cursor-pointer" />
              <input className="input-field flex-1 text-sm" value={form.secondaryColor}
                onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Telegram</h3>
        <div className="bg-sky-50 rounded-xl p-3 text-xs text-sky-700">
          💡 Crea un bot con @BotFather y pega el token aquí. El Chat ID se obtiene hablando con @userinfobot.
        </div>
        {field('telegramBotToken', 'Token del bot', 'password', '123456:ABC...')}
        {field('telegramAdminChatId', 'Chat ID del administrador', 'text', '-100...')}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="notifyAdmin" checked={form.telegramNotifyAdmin}
            onChange={(e) => setForm({ ...form, telegramNotifyAdmin: e.target.checked })}
            className="w-5 h-5 rounded accent-sky-500" />
          <label htmlFor="notifyAdmin" className="text-sm text-gray-700">Notificar al admin en cada reserva</label>
        </div>
      </section>

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  )
}
