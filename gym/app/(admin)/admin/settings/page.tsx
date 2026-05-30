'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Credits } from '@/components/ui/Credits'

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
  telegramBotTokenSet?: boolean
}

const DEFAULT: Settings = {
  gymName: '', logoUrl: '', primaryColor: '#0ea5e9', secondaryColor: '#10b981',
  telegramBotToken: '', telegramAdminChatId: '', telegramNotifyAdmin: true,
  confirmationText: '', sessionDuration: 60,
}

export default function SettingsPage() {
  const [form, setForm]     = useState<Settings>(DEFAULT)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [tokenSet, setTokenSet] = useState(false)
  const [testChatId, setTestChatId] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setTokenSet(!!d.telegramBotTokenSet)
      setForm({
        gymName:             d.gymName             ?? '',
        logoUrl:             d.logoUrl             ?? '',
        primaryColor:        d.primaryColor        ?? '#0ea5e9',
        secondaryColor:      d.secondaryColor      ?? '#10b981',
        telegramBotToken:    '',   // never pre-filled (masked server-side)
        telegramAdminChatId: d.telegramAdminChatId ?? '',
        telegramNotifyAdmin: d.telegramNotifyAdmin ?? true,
        confirmationText:    d.confirmationText    ?? '',
        sessionDuration:     d.sessionDuration     ?? 60,
      })
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    const body: any = { ...form }
    // Only send token if admin typed a new one
    if (!body.telegramBotToken) delete body.telegramBotToken
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) { toast.success('Configuración guardada ✓'); setTokenSet(!!form.telegramBotToken || tokenSet) }
    else toast.error('Error al guardar')
  }

  async function handleTest() {
    setTesting(true)
    const res = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: testChatId || undefined }),
    })
    const data = await res.json()
    setTesting(false)
    if (res.ok) toast.success(`✅ Mensaje enviado (ID ${data.messageId})`)
    else        toast.error(`❌ ${data.error}`)
  }

  const f = (key: keyof Settings, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type} className="input-field"
        placeholder={placeholder}
        value={form[key] as string}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  )

  return (
    <div className="space-y-7">
      <div>
        <p className="section-title mb-1">Administración</p>
        <h2 className="text-2xl font-extrabold text-[var(--ink)] tracking-tight">Configuración</h2>
      </div>

      {/* Gimnasio */}
      <section className="space-y-4">
        <p className="section-title">🏋️ Gimnasio</p>
        {f('gymName', 'Nombre del gimnasio', 'text', 'Mi Gimnasio')}
        {f('logoUrl', 'URL del logo', 'url', 'https://...')}
        <div>
          <label className="label">Duración estándar de sesión (min)</label>
          <input type="number" className="input-field" value={form.sessionDuration}
            min={15} step={15}
            onChange={e => setForm({ ...form, sessionDuration: +e.target.value })} />
        </div>
        <div>
          <label className="label">Texto de confirmación</label>
          <textarea className="input-field resize-none" rows={3}
            placeholder="Mensaje al confirmar una reserva..."
            value={form.confirmationText}
            onChange={e => setForm({ ...form, confirmationText: e.target.value })} />
        </div>
      </section>

      {/* Colores */}
      <section className="space-y-4">
        <p className="section-title">🎨 Colores</p>
        <div className="grid grid-cols-2 gap-3">
          {([
            ['primaryColor',   'Color principal'],
            ['secondaryColor', 'Color secundario'],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  className="w-12 h-12 rounded-xl border-0 cursor-pointer flex-shrink-0" />
                <input className="input-field flex-1 text-sm font-mono" value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Telegram */}
      <section className="space-y-4">
        <p className="section-title">✈️ Telegram</p>

        {/* Status pill */}
        <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${tokenSet ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
          <span className="text-xl">{tokenSet ? '✅' : '⚠️'}</span>
          <div>
            <p className={`text-sm font-bold ${tokenSet ? 'text-emerald-700' : 'text-amber-700'}`}>
              {tokenSet ? 'Bot configurado' : 'Bot no configurado'}
            </p>
            <p className={`text-xs ${tokenSet ? 'text-emerald-600' : 'text-amber-600'}`}>
              {tokenSet
                ? 'Las notificaciones están activas'
                : 'Introduce el token para activar las notificaciones'}
            </p>
          </div>
        </div>

        {/* How-to */}
        <div className="rounded-2xl p-4 space-y-2 text-xs"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="font-bold text-[var(--ink)]">Cómo configurar</p>
          <ol className="space-y-1.5 text-[var(--ink-2)] list-decimal list-inside">
            <li>Habla con <strong>@BotFather</strong> en Telegram → <code>/newbot</code></li>
            <li>Copia el token y pégalo abajo</li>
            <li>Obtén tu Chat ID hablando con <strong>@userinfobot</strong></li>
            <li>Pulsa <em>Guardar</em> y luego <em>Enviar prueba</em></li>
          </ol>
        </div>

        <div>
          <label className="label">
            Token del bot
            {tokenSet && <span className="ml-2 badge badge-green normal-case">activo</span>}
          </label>
          <input
            type="password" className="input-field font-mono text-sm"
            placeholder={tokenSet ? '••••••••  (dejar vacío para no cambiar)' : '123456789:ABCdefGHI...'}
            value={form.telegramBotToken}
            onChange={e => setForm({ ...form, telegramBotToken: e.target.value })}
          />
        </div>

        {f('telegramAdminChatId', 'Chat ID del administrador', 'text', '-100xxxxxxxxxx')}

        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input type="checkbox" className="sr-only"
              checked={form.telegramNotifyAdmin}
              onChange={e => setForm({ ...form, telegramNotifyAdmin: e.target.checked })} />
            <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${form.telegramNotifyAdmin ? 'bg-[var(--brand)]' : 'bg-gray-200'}`} />
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${form.telegramNotifyAdmin ? 'translate-x-5' : ''}`} />
          </div>
          <span className="text-sm font-medium text-[var(--ink)]">Notificar al admin en cada reserva</span>
        </label>

        {/* Test panel */}
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-bold text-[var(--ink)]">Enviar mensaje de prueba</p>
          <div>
            <label className="label">Chat ID de destino (opcional)</label>
            <input className="input-field text-sm" placeholder="Usa el Chat ID del admin por defecto"
              value={testChatId} onChange={e => setTestChatId(e.target.value)} />
          </div>
          <button
            onClick={handleTest}
            disabled={testing || !tokenSet}
            className="btn w-full py-3.5 text-sm font-bold rounded-full text-white transition-all"
            style={{
              background: tokenSet
                ? 'linear-gradient(135deg,#0088cc,#006aaa)'
                : 'var(--surface)',
              color: tokenSet ? 'white' : 'var(--ink-3)',
              border: tokenSet ? 'none' : '1.5px solid var(--border)',
              boxShadow: tokenSet ? '0 4px 14px rgba(0,136,204,0.35)' : 'none',
            }}
          >
            {testing ? (
              <span className="flex items-center gap-2 justify-center">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enviando...
              </span>
            ) : (
              <span className="flex items-center gap-2 justify-center">
                ✈️ Enviar mensaje de prueba
              </span>
            )}
          </button>
          {!tokenSet && (
            <p className="text-xs text-center text-[var(--ink-3)]">
              Configura el token y guarda primero
            </p>
          )}
        </div>
      </section>

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? (
          <span className="flex items-center gap-2 justify-center">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Guardando...
          </span>
        ) : 'Guardar configuración'}
      </button>

      <Credits />
    </div>
  )
}
