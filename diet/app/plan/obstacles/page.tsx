'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { savePlanObstacles } from '@/lib/actions/plan'

export default function ObstaclesPage() {
  const [state, action, pending] = useActionState(savePlanObstacles, null)

  return (
    <div className="page-no-nav" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/plan" className="btn btn-ghost" style={{ width: 40, height: 40, minHeight: 40, padding: 0, fontSize: '1.2rem' }}>‹</Link>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Paso 4 de 6</div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>🛡️ Plan para obstáculos</h1>
        </div>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>
        Los planes de dieta mueren en restaurantes, fiestas y a las 22h sin fuerza de voluntad. Planifica ahora.
      </p>

      {state?.error && <div className="alert alert-error">{state.error}</div>}
      {state?.success && (
        <div className="alert alert-success">
          Guardado ✓ <Link href="/plan/shopping" style={{ color: 'var(--green-dark)', fontWeight: 700 }}>→ Siguiente paso</Link>
        </div>
      )}

      <form action={action}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Comer fuera / Eventos sociales</div>

          <div className="form-group">
            <label className="form-label">Estrategia en restaurantes</label>
            <input
              type="text"
              name="restaurantStrategy"
              className="form-input"
              placeholder="Ej: proteína + verdura, evito el pan de inicio"
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>
              Sugerencia: busca la opción con más proteína y menos fritos
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Regla con alcohol (si aplica)</label>
            <input
              type="text"
              name="alcoholRule"
              className="form-input"
              placeholder="Ej: máx 2 copas, sin mezclas azucaradas, solo fines de semana"
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Viajes</div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Estrategia cuando viajas</label>
            <input
              type="text"
              name="travelStrategy"
              className="form-input"
              placeholder="Ej: llevo frutos secos y proteínas, busco supermercado"
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Bajón de fuerza de voluntad</div>

          <div className="form-group">
            <label className="form-label">Tu &quot;comida mínima viable&quot; cuando todo falla</label>
            <input
              type="text"
              name="lowWillpowerMeal"
              className="form-input"
              placeholder="Ej: huevos revueltos + tostada integral, yogur griego + fruta"
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>
              Elige algo sano, rápido y disponible que no requiera esfuerzo mental
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Estrategia ante antojos</label>
            <select name="cravingStrategy" className="form-select">
              <option value="">Seleccionar…</option>
              <option value="delay">Retrasar 20 min — si sigo queriendo, entonces decido</option>
              <option value="substitute">Tener alternativa preparada (fruta, yogur, frutos secos)</option>
              <option value="allow">Indulgencia controlada planificada: 1 vez/semana</option>
              <option value="distract">Salir a caminar o beber agua primero</option>
            </select>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar estrategias'}
        </button>
        <Link href="/plan/shopping" style={{ display: 'block', textAlign: 'center', marginTop: 12, color: 'var(--muted)', fontSize: '0.85rem' }}>
          Saltar por ahora →
        </Link>
      </form>
    </div>
  )
}
