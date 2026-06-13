'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { savePlanPatterns } from '@/lib/actions/plan'

export default function PlanSetupPage() {
  const [state, action, pending] = useActionState(savePlanPatterns, null)

  return (
    <div className="page-no-nav" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/plan" className="btn btn-ghost" style={{ width: 40, height: 40, minHeight: 40, padding: 0, fontSize: '1.2rem' }}>‹</Link>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Paso 1 de 6</div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>📋 Patrones actuales</h1>
        </div>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 20, lineHeight: 1.6 }}>
        Empieza con la realidad, no con aspiraciones. Los planes fallidos se construyen sobre suposiciones.
      </p>

      {state?.error && <div className="alert alert-error">{state.error}</div>}
      {state?.success && (
        <div className="alert alert-success">
          Guardado ✓ <Link href="/plan/goals" style={{ color: 'var(--green-dark)', fontWeight: 700 }}>→ Siguiente paso</Link>
        </div>
      )}

      <form action={action}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Comidas diarias</div>

          <div className="form-group">
            <label className="form-label">Comidas al día (número habitual)</label>
            <select name="mealsPerDay" className="form-select">
              <option value="">Seleccionar…</option>
              <option value="2">2 comidas</option>
              <option value="3">3 comidas</option>
              <option value="4">4 comidas</option>
              <option value="5">5 o más</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">¿Con qué frecuencia cocinas?</label>
            <select name="cookingFreq" className="form-select">
              <option value="">Seleccionar…</option>
              <option value="daily">Casi cada día</option>
              <option value="few">Algunos días a la semana</option>
              <option value="rarely">Rara vez</option>
              <option value="never">Casi nunca</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">¿Cuántas veces comes fuera o pides a domicilio?</label>
            <select name="eatingOut" className="form-select">
              <option value="">Seleccionar…</option>
              <option value="rarely">Menos de 1 vez/semana</option>
              <option value="1-2">1-2 veces/semana</option>
              <option value="3-5">3-5 veces/semana</option>
              <option value="daily">Casi a diario</option>
            </select>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Picoteo e hidratación</div>

          <div className="form-group">
            <label className="form-label">¿Cuándo y qué picoteas habitualmente?</label>
            <input
              type="text"
              name="snackPattern"
              className="form-input"
              placeholder="Ej: por la tarde, dulces cuando estoy estresado/a"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Agua diaria aproximada (litros)</label>
            <select name="hydrationLiters" className="form-select">
              <option value="">Seleccionar…</option>
              <option value="0.5">Menos de 1 litro</option>
              <option value="1.5">1-2 litros</option>
              <option value="2.5">2-3 litros</option>
              <option value="3.5">Más de 3 litros</option>
            </select>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Área de mejora</div>

          <div className="form-group">
            <label className="form-label">¿Cuáles son tus principales dificultades?</label>
            <input
              type="text"
              name="problemAreas"
              className="form-input"
              placeholder="Ej: comer tarde, saltarme el desayuno, azúcar"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Restricciones o intolerancias</label>
            <input
              type="text"
              name="restrictions"
              className="form-input"
              placeholder="Ej: intolerancia al gluten, vegetariano, sin lácteos"
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar y continuar'}
        </button>
        <Link href="/plan/goals" style={{ display: 'block', textAlign: 'center', marginTop: 12, color: 'var(--muted)', fontSize: '0.85rem' }}>
          Saltar por ahora →
        </Link>
      </form>
    </div>
  )
}
